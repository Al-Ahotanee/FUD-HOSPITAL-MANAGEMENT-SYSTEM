import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// ============================================================================
// DATABASE POOL
// ============================================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Standard consultation / lab fees used to auto-generate billing invoices.
// In a full production deployment these would live in a `service_fees` table
// editable by Admin; kept as constants here to respect the 10-file ceiling.
const FEES = {
  CONSULTATION: 1000,
  LAB_TEST: 1500
};

// Transaction wrapper: injects the acting user's id into the Postgres session
// (`app.current_user_id`) so the DB-level audit triggers in schema.sql can
// attribute every INSERT/UPDATE/DELETE to a real person automatically.
const withTransaction = async (userId, callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userId) {
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', String(userId)]);
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================================
// MIDDLEWARE
// ============================================================================
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired token.' });
  }
};

const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized access for your role.' });
  }
  next();
};

// ============================================================================
// AUTO-INIT DEFAULT ADMIN
// ============================================================================
const initializeSystem = async () => {
  try {
    const res = await pool.query("SELECT * FROM users WHERE role = 'admin'");
    if (res.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', await bcrypt.genSalt(10));
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'admin')",
        ['System Administrator', 'admin@fud.edu.ng', hash]
      );
      console.log('✅ Default Admin account created (admin@fud.edu.ng / admin123)');
    }
  } catch (err) {
    console.error('Database Init Error:', err.message);
  }
};
initializeSystem();

// Helper: create a billing invoice inside an existing transaction client
const createInvoice = async (client, { patient_id, generated_by, total_amount, purpose, reference_type, reference_id }) => {
  await client.query(
    `INSERT INTO billing_invoices (patient_id, generated_by, total_amount, purpose, reference_type, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [patient_id, generated_by, total_amount, purpose, reference_type, reference_id]
  );
};

// ================================ API ROUTES ================================

// --- 1. AUTHENTICATION -------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  try {
    const hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'patient')",
      [name, email, hash]
    );
    res.status(201).json({ message: 'Registration successful! You can now log in.' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists.' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = TRUE', [email]);
    if (userRes.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials or inactive account.' });

    const user = userRes.rows[0];
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '12h' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, is_active FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 2. USER & STAFF MANAGEMENT (Admin) -------------------------------------
app.get('/api/users', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', authenticate, authorize(['admin']), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields are required.' });
  try {
    await withTransaction(req.user.id, async (client) => {
      const hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
      await client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        [name, email, hash, role]
      );
    });
    res.status(201).json({ message: 'Staff account created successfully.' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists.' });
    res.status(500).json({ error: err.message });
  }
});

// Activate / deactivate a staff account (soft-lock instead of deletion, to
// preserve referential integrity with historical clinical records)
app.patch('/api/users/:id/status', authenticate, authorize(['admin']), async (req, res) => {
  const { is_active } = req.body;
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, req.params.id]);
    });
    res.json({ message: `Account ${is_active ? 'activated' : 'deactivated'} successfully.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lightweight roster used by Receptionist/Nurse to assign a doctor at check-in
app.get('/api/staff/doctors', authenticate, authorize(['admin', 'receptionist', 'nurse']), async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name FROM users WHERE role = 'doctor' AND is_active = TRUE ORDER BY name");
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 3. PATIENTS (Receptionist / Admin) -------------------------------------
app.post('/api/patients', authenticate, authorize(['admin', 'receptionist']), async (req, res) => {
  const { university_id, patient_type, full_name, dob, gender, blood_group, genotype, allergies, phone, address } = req.body;
  if (!full_name || !patient_type) return res.status(400).json({ error: 'Full name and patient type are required.' });
  try {
    const result = await withTransaction(req.user.id, async (client) => {
      return await client.query(
        `INSERT INTO patients (university_id, patient_type, full_name, dob, gender, blood_group, genotype, allergies, phone, address, registered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [university_id || null, patient_type, full_name, dob || null, gender || null, blood_group || null, genotype || null, allergies || null, phone || null, address || null, req.user.id]
      );
    });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/patients', authenticate, async (req, res) => {
  const { search } = req.query;
  try {
    let query = 'SELECT * FROM patients ORDER BY created_at DESC LIMIT 50';
    let params = [];
    if (search) {
      query = 'SELECT * FROM patients WHERE full_name ILIKE $1 OR university_id ILIKE $1 ORDER BY created_at DESC LIMIT 50';
      params = [`%${search}%`];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Full demographic profile for a single patient (used by Doctor/Nurse EMR panel)
app.get('/api/patients/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found.' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4. QUEUE MANAGEMENT -----------------------------------------------------
app.post('/api/queue', authenticate, authorize(['receptionist', 'nurse', 'admin']), async (req, res) => {
  const { patient_id, assigned_doctor_id, priority } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'A patient must be selected.' });
  try {
    // Prevent double check-in: a patient already active in the pipeline shouldn't be re-queued
    const existing = await pool.query("SELECT id FROM patient_queue WHERE patient_id = $1 AND status != 'completed'", [patient_id]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'This patient already has an active visit in the queue.' });

    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO patient_queue (patient_id, assigned_doctor_id, status, priority) VALUES ($1, $2, $3, $4)',
        [patient_id, assigned_doctor_id || null, 'waiting_triage', priority || 'normal']
      );
    });
    res.json({ message: 'Patient checked in and sent to Triage.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/queue/active', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT q.id, q.patient_id, q.status, q.priority, q.check_in_time, q.assigned_doctor_id,
             p.full_name as patient_name, p.patient_type, p.university_id, p.blood_group, p.gender,
             d.name as doctor_name
      FROM patient_queue q
      JOIN patients p ON q.patient_id = p.id
      LEFT JOIN users d ON q.assigned_doctor_id = d.id
      WHERE q.status != 'completed'
      ORDER BY q.priority DESC, q.check_in_time ASC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/queue/:id/status', authenticate, authorize(['doctor', 'nurse', 'receptionist', 'admin']), async (req, res) => {
  const { status } = req.body;
  const valid = ['waiting_triage', 'waiting_doctor', 'waiting_lab', 'waiting_pharmacy', 'completed'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid queue status.' });
  try {
    await withTransaction(req.user.id, async (client) => {
      const query = status === 'completed'
        ? 'UPDATE patient_queue SET status = $1, check_out_time = CURRENT_TIMESTAMP WHERE id = $2'
        : 'UPDATE patient_queue SET status = $1 WHERE id = $2';
      await client.query(query, [status, req.params.id]);
    });
    res.json({ message: `Queue status updated to ${status.replace('_', ' ')}.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 5. CLINICAL RECORDS & EMR ----------------------------------------------
app.post('/api/vitals', authenticate, authorize(['nurse', 'doctor', 'admin']), async (req, res) => {
  const { patient_id, blood_pressure, temperature, weight, heart_rate } = req.body;
  if (!patient_id || !blood_pressure || !temperature || !weight || !heart_rate) {
    return res.status(400).json({ error: 'All vitals fields are required.' });
  }
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO vitals (patient_id, nurse_id, blood_pressure, temperature, weight, heart_rate) VALUES ($1, $2, $3, $4, $5, $6)',
        [patient_id, req.user.id, blood_pressure, temperature, weight, heart_rate]
      );
      // Deep workflow: vitals logged during triage automatically advance the patient to the Doctor's queue
      await client.query("UPDATE patient_queue SET status = 'waiting_doctor' WHERE patient_id = $1 AND status = 'waiting_triage'", [patient_id]);
    });
    res.json({ message: 'Vitals logged successfully. Patient moved to Doctor queue.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/consultations', authenticate, authorize(['doctor']), async (req, res) => {
  const { patient_id, chief_complaint, diagnosis, treatment_plan, notes } = req.body;
  if (!patient_id || !chief_complaint || !diagnosis) return res.status(400).json({ error: 'Chief complaint and diagnosis are required.' });
  try {
    const result = await withTransaction(req.user.id, async (client) => {
      const consult = await client.query(
        'INSERT INTO consultations (patient_id, doctor_id, chief_complaint, diagnosis, treatment_plan, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [patient_id, req.user.id, chief_complaint, diagnosis, treatment_plan || null, notes || null]
      );
      const consultationId = consult.rows[0].id;

      // Deep workflow: every consultation automatically raises a billing
      // invoice for the Receptionist to collect payment for.
      await createInvoice(client, {
        patient_id, generated_by: req.user.id, total_amount: FEES.CONSULTATION,
        purpose: 'Consultation Fee', reference_type: 'consultation', reference_id: consultationId
      });

      return consultationId;
    });
    res.json({ message: 'Consultation saved. Invoice auto-generated for Reception.', consultation_id: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Consolidated EMR timeline — everything a clinician needs about a patient
// in one call: vitals, consultations, lab history, prescriptions + items,
// certificates, immunizations, and billing history.
app.get('/api/emr/history/:patient_id', authenticate, authorize(['doctor', 'nurse', 'admin', 'lab_tech', 'pharmacist']), async (req, res) => {
  const pid = req.params.patient_id;
  try {
    const [consultations, vitals, labRequests, prescriptions, certificates, immunizations, invoices] = await Promise.all([
      pool.query('SELECT c.*, u.name as doctor_name FROM consultations c JOIN users u ON c.doctor_id = u.id WHERE c.patient_id = $1 ORDER BY c.created_at DESC', [pid]),
      pool.query('SELECT v.*, u.name as nurse_name FROM vitals v JOIN users u ON v.nurse_id = u.id WHERE v.patient_id = $1 ORDER BY v.recorded_at DESC', [pid]),
      pool.query('SELECT l.*, d.name as doctor_name FROM lab_requests l JOIN consultations c ON l.consultation_id = c.id JOIN users d ON c.doctor_id = d.id WHERE l.patient_id = $1 ORDER BY l.requested_at DESC', [pid]),
      pool.query('SELECT p.*, u.name as doctor_name FROM prescriptions p JOIN users u ON p.doctor_id = u.id WHERE p.patient_id = $1 ORDER BY p.created_at DESC', [pid]),
      pool.query('SELECT ce.*, u.name as doctor_name FROM certificates ce JOIN users u ON ce.doctor_id = u.id WHERE ce.patient_id = $1 ORDER BY ce.created_at DESC', [pid]),
      pool.query('SELECT im.*, u.name as nurse_name FROM immunizations im JOIN users u ON im.nurse_id = u.id WHERE im.patient_id = $1 ORDER BY im.administered_at DESC', [pid]),
      pool.query('SELECT * FROM billing_invoices WHERE patient_id = $1 ORDER BY created_at DESC', [pid])
    ]);

    // Attach line items to each prescription
    for (const rx of prescriptions.rows) {
      const items = await pool.query(
        'SELECT pi.*, i.item_name, i.unit_price FROM prescription_items pi JOIN inventory i ON pi.inventory_id = i.id WHERE pi.prescription_id = $1',
        [rx.id]
      );
      rx.items = items.rows;
    }

    res.json({
      consultations: consultations.rows,
      vitals: vitals.rows,
      lab_requests: labRequests.rows,
      prescriptions: prescriptions.rows,
      certificates: certificates.rows,
      immunizations: immunizations.rows,
      invoices: invoices.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 6. LABORATORY -----------------------------------------------------------
app.post('/api/lab/request', authenticate, authorize(['doctor']), async (req, res) => {
  const { consultation_id, patient_id, test_name } = req.body;
  if (!consultation_id || !patient_id || !test_name) return res.status(400).json({ error: 'Consultation, patient and test name are required.' });
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO lab_requests (consultation_id, patient_id, test_name) VALUES ($1, $2, $3)',
        [consultation_id, patient_id, test_name]
      );
      // Deep workflow: requesting a lab test also raises the lab fee invoice
      await createInvoice(client, {
        patient_id, generated_by: req.user.id, total_amount: FEES.LAB_TEST,
        purpose: `Lab Test — ${test_name}`, reference_type: 'lab_request', reference_id: null
      });
    });
    res.json({ message: 'Lab test requested and billed to Reception.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/lab/pending', authenticate, authorize(['lab_tech', 'doctor', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, p.full_name as patient_name, p.university_id, d.name as doctor_name
      FROM lab_requests l
      JOIN patients p ON l.patient_id = p.id
      JOIN consultations c ON l.consultation_id = c.id
      JOIN users d ON c.doctor_id = d.id
      WHERE l.status = 'pending' ORDER BY l.requested_at ASC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/lab/completed', authenticate, authorize(['lab_tech', 'doctor', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, p.full_name as patient_name, p.university_id, d.name as doctor_name
      FROM lab_requests l
      JOIN patients p ON l.patient_id = p.id
      JOIN consultations c ON l.consultation_id = c.id
      JOIN users d ON c.doctor_id = d.id
      WHERE l.status = 'completed' ORDER BY l.completed_at DESC LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/lab/results/:id', authenticate, authorize(['lab_tech']), async (req, res) => {
  const { result_data } = req.body;
  if (!result_data) return res.status(400).json({ error: 'Result data is required.' });
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        "UPDATE lab_requests SET status = 'completed', lab_tech_id = $1, result_data = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3",
        [req.user.id, JSON.stringify(result_data), req.params.id]
      );
    });
    res.json({ message: 'Lab results submitted and attached to the patient EMR.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 7. PHARMACY & INVENTORY -------------------------------------------------
app.post('/api/prescriptions', authenticate, authorize(['doctor']), async (req, res) => {
  const { consultation_id, patient_id, items } = req.body; // items: [{inventory_id, dosage, quantity_prescribed}]
  if (!consultation_id || !patient_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one medication item is required.' });
  }
  try {
    await withTransaction(req.user.id, async (client) => {
      const rxResult = await client.query(
        'INSERT INTO prescriptions (consultation_id, patient_id, doctor_id) VALUES ($1, $2, $3) RETURNING id',
        [consultation_id, patient_id, req.user.id]
      );
      const rxId = rxResult.rows[0].id;

      for (const item of items) {
        await client.query(
          'INSERT INTO prescription_items (prescription_id, inventory_id, dosage, quantity_prescribed) VALUES ($1, $2, $3, $4)',
          [rxId, item.inventory_id, item.dosage, item.quantity_prescribed]
        );
      }
    });
    res.json({ message: 'E-Prescription generated and sent to Pharmacy.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/pharmacy/queue', authenticate, authorize(['pharmacist', 'admin']), async (req, res) => {
  try {
    const rx = await pool.query(`
      SELECT p.id, p.patient_id, pat.full_name as patient_name, d.name as doctor_name, p.status, p.created_at
      FROM prescriptions p JOIN patients pat ON p.patient_id = pat.id JOIN users d ON p.doctor_id = d.id
      WHERE p.status = 'pending' ORDER BY p.created_at ASC
    `);
    for (const r of rx.rows) {
      const items = await pool.query(
        `SELECT pi.*, i.item_name, i.unit_price, i.quantity as stock_available
         FROM prescription_items pi JOIN inventory i ON pi.inventory_id = i.id WHERE pi.prescription_id = $1`,
        [r.id]
      );
      r.items = items.rows;
    }
    res.json(rx.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/pharmacy/dispense/:id', authenticate, authorize(['pharmacist']), async (req, res) => {
  try {
    const message = await withTransaction(req.user.id, async (client) => {
      const items = await client.query(
        `SELECT pi.inventory_id, pi.quantity_prescribed, i.item_name, i.quantity as stock, i.unit_price
         FROM prescription_items pi JOIN inventory i ON pi.inventory_id = i.id WHERE pi.prescription_id = $1`,
        [req.params.id]
      );
      if (items.rows.length === 0) throw new Error('Prescription has no line items.');

      // Guard against negative stock — fail the whole transaction if any item is short
      for (const item of items.rows) {
        if (item.stock < item.quantity_prescribed) {
          throw new Error(`Insufficient stock for ${item.item_name}: only ${item.stock} unit(s) available.`);
        }
      }

      let total = 0;
      for (const item of items.rows) {
        await client.query('UPDATE inventory SET quantity = quantity - $1 WHERE id = $2', [item.quantity_prescribed, item.inventory_id]);
        total += Number(item.unit_price) * item.quantity_prescribed;
      }

      const rx = await client.query('SELECT patient_id FROM prescriptions WHERE id = $1', [req.params.id]);
      const patientId = rx.rows[0].patient_id;

      await client.query("UPDATE prescriptions SET status = 'dispensed', pharmacist_id = $1, dispensed_at = CURRENT_TIMESTAMP WHERE id = $2", [req.user.id, req.params.id]);
      await client.query("UPDATE prescription_items SET dispensed = TRUE WHERE prescription_id = $1", [req.params.id]);

      // Deep workflow: dispensing automatically raises a pharmacy invoice for Reception
      await createInvoice(client, {
        patient_id: patientId, generated_by: req.user.id, total_amount: total,
        purpose: `Pharmacy — Prescription #${req.params.id}`, reference_type: 'prescription', reference_id: Number(req.params.id)
      });

      return `Dispensed successfully. Inventory deducted and a ₦${total.toLocaleString()} invoice was sent to Reception.`;
    });
    res.json({ message });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/inventory', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY category, item_name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory', authenticate, authorize(['pharmacist', 'admin']), async (req, res) => {
  const { item_name, category, quantity, unit_price } = req.body;
  if (!item_name || !category || quantity === undefined || unit_price === undefined) {
    return res.status(400).json({ error: 'All inventory fields are required.' });
  }
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        `INSERT INTO inventory (item_name, category, quantity, unit_price) VALUES ($1, $2, $3, $4)
         ON CONFLICT (item_name) DO UPDATE SET quantity = inventory.quantity + $3, unit_price = $4, last_restocked_at = CURRENT_TIMESTAMP`,
        [item_name, category, quantity, unit_price]
      );
    });
    res.json({ message: 'Inventory updated successfully.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 8. BILLING --------------------------------------------------------------
app.get('/api/billing/unpaid', authenticate, authorize(['receptionist', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, p.full_name as patient_name, p.university_id
      FROM billing_invoices b JOIN patients p ON b.patient_id = p.id
      WHERE b.status = 'unpaid' ORDER BY b.created_at ASC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/billing/recent', authenticate, authorize(['receptionist', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, p.full_name as patient_name, p.university_id
      FROM billing_invoices b JOIN patients p ON b.patient_id = p.id
      WHERE b.status = 'paid' ORDER BY b.paid_at DESC LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/billing', authenticate, authorize(['receptionist', 'admin']), async (req, res) => {
  const { patient_id, total_amount, purpose } = req.body;
  if (!patient_id || !total_amount || !purpose) return res.status(400).json({ error: 'Patient, amount and purpose are required.' });
  try {
    await withTransaction(req.user.id, async (client) => {
      await createInvoice(client, { patient_id, generated_by: req.user.id, total_amount, purpose, reference_type: 'manual', reference_id: null });
    });
    res.json({ message: 'Ad-hoc invoice generated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/billing/:id/pay', authenticate, authorize(['receptionist', 'admin']), async (req, res) => {
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query("UPDATE billing_invoices SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
    });
    res.json({ message: 'Payment recorded and receipt generated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 9. CERTIFICATES & IMMUNIZATION ------------------------------------------
app.post('/api/certificates', authenticate, authorize(['doctor']), async (req, res) => {
  const { patient_id, certificate_type, start_date, end_date, remarks } = req.body;
  if (!patient_id || !certificate_type || !start_date || !end_date) return res.status(400).json({ error: 'All certificate fields are required.' });
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO certificates (patient_id, doctor_id, certificate_type, start_date, end_date, remarks) VALUES ($1, $2, $3, $4, $5, $6)',
        [patient_id, req.user.id, certificate_type, start_date, end_date, remarks || null]
      );
    });
    res.json({ message: 'Medical certificate generated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/immunizations', authenticate, authorize(['nurse', 'admin']), async (req, res) => {
  const { patient_id, vaccine_name, dose_number, next_due_date } = req.body;
  if (!patient_id || !vaccine_name || !dose_number) return res.status(400).json({ error: 'Patient, vaccine and dose are required.' });
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO immunizations (patient_id, nurse_id, vaccine_name, dose_number, next_due_date) VALUES ($1, $2, $3, $4, $5)',
        [patient_id, req.user.id, vaccine_name, dose_number, next_due_date || null]
      );
    });
    res.json({ message: 'Immunization record saved.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/immunizations/:patient_id', authenticate, authorize(['nurse', 'doctor', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT im.*, u.name as nurse_name FROM immunizations im JOIN users u ON im.nurse_id = u.id WHERE im.patient_id = $1 ORDER BY im.administered_at DESC',
      [req.params.patient_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 10. SYSTEM ANALYTICS & AUDIT LOGS ---------------------------------------
app.get('/api/analytics', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const [totalPatients, consultationsToday, pendingLabs, lowStockItems, revenue, roleBreakdown, weeklyRegistrations] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM patients'),
      pool.query('SELECT COUNT(*) FROM consultations WHERE DATE(created_at) = CURRENT_DATE'),
      pool.query("SELECT COUNT(*) FROM lab_requests WHERE status = 'pending'"),
      pool.query('SELECT id, item_name, quantity, reorder_level FROM inventory WHERE quantity <= reorder_level ORDER BY quantity ASC'),
      pool.query("SELECT COALESCE(SUM(total_amount),0) as total FROM billing_invoices WHERE status = 'paid'"),
      pool.query('SELECT role, COUNT(*) FROM users GROUP BY role'),
      pool.query("SELECT DATE(created_at) as day, COUNT(*) FROM patients WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY DATE(created_at) ORDER BY day")
    ]);
    res.json({
      totalPatients: totalPatients.rows[0].count,
      consultationsToday: consultationsToday.rows[0].count,
      pendingLabs: pendingLabs.rows[0].count,
      lowStock: lowStockItems.rows.length,
      lowStockItems: lowStockItems.rows,
      revenue: revenue.rows[0].total,
      roleBreakdown: roleBreakdown.rows,
      weeklyRegistrations: weeklyRegistrations.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/audit-logs', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.name as acting_user
      FROM audit_logs a LEFT JOIN users u ON a.changed_by = u.id
      ORDER BY a.created_at DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================================
// FRONTEND SERVING (production build)
// ============================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 FUD HIMS Server running on port ${PORT}`));
