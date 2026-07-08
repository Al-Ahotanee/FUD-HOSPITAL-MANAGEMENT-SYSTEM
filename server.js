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

// ── Database Connection ─────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Transaction wrapper — uses parameterised query to set session variable ──
const withTransaction = async (userId, callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userId) {
      // Parameterised to avoid SQL injection
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_user_id',
        String(userId),
      ]);
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

// ── Middleware ──────────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_fud_hims_2024');
    next();
  } catch {
    res.status(400).json({ error: 'Invalid or expired token.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.flat().includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorised: insufficient role privileges.' });
  }
  next();
};

// ── Auto-initialise default admin ──────────────────────────────────────────
const initializeSystem = async () => {
  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = 'admin@fud.edu.ng'");
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'admin')",
        ['System Administrator', 'admin@fud.edu.ng', hash]
      );
      console.log('✅ Default admin created: admin@fud.edu.ng / admin123');
    }
  } catch (err) {
    console.error('DB Init Error:', err.message);
  }
};
initializeSystem();

// ═══════════════════════════════════════════════════════════════════════════
// 1. AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'patient')",
      [name, email, hash]
    );
    res.status(201).json({ message: 'Registration successful. You may now log in.' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already registered.' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const r = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );
    if (!r.rows.length)
      return res.status(400).json({ error: 'Invalid credentials or inactive account.' });
    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials.' });
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET || 'supersecret_fud_hims_2024',
      { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. USER & STAFF MANAGEMENT (Admin)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticate, authorize('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'All fields are required.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await withTransaction(req.user.id, async (c) =>
      c.query('INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)', [
        name, email, hash, role,
      ])
    );
    res.status(201).json({ message: 'Staff account created successfully.' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists.' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/toggle', authenticate, authorize('admin'), async (req, res) => {
  try {
    await withTransaction(req.user.id, async (c) =>
      c.query('UPDATE users SET is_active = NOT is_active WHERE id = $1', [req.params.id])
    );
    res.json({ message: 'User status updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: list doctors for assignment
app.get('/api/users/doctors', authenticate, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, name FROM users WHERE role = 'doctor' AND is_active = TRUE ORDER BY name"
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. PATIENTS
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/patients', authenticate, authorize('admin', 'receptionist'), async (req, res) => {
  const { university_id, patient_type, full_name, dob, gender, blood_group, genotype, phone, address } = req.body;
  if (!full_name || !patient_type)
    return res.status(400).json({ error: 'Full name and patient type are required.' });
  try {
    const r = await withTransaction(req.user.id, async (c) =>
      c.query(
        `INSERT INTO patients (university_id, patient_type, full_name, dob, gender, blood_group, genotype, phone, address, registered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [university_id, patient_type, full_name, dob || null, gender, blood_group, genotype, phone, address, req.user.id]
      )
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients', authenticate, async (req, res) => {
  const { search } = req.query;
  try {
    let q = 'SELECT * FROM patients ORDER BY created_at DESC LIMIT 100';
    let params = [];
    if (search) {
      q = `SELECT * FROM patients
           WHERE full_name ILIKE $1 OR university_id ILIKE $1
           ORDER BY created_at DESC LIMIT 50`;
      params = [`%${search}%`];
    }
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients/:id', authenticate, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Patient not found.' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/queue', authenticate, authorize('receptionist', 'nurse', 'admin'), async (req, res) => {
  const { patient_id, assigned_doctor_id, notes } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id is required.' });

  // Prevent duplicate active queue entries
  const existing = await pool.query(
    "SELECT id FROM patient_queue WHERE patient_id=$1 AND status != 'completed'",
    [patient_id]
  );
  if (existing.rows.length)
    return res.status(409).json({ error: 'Patient is already in the active queue.' });

  try {
    await withTransaction(req.user.id, async (c) =>
      c.query(
        'INSERT INTO patient_queue (patient_id, assigned_doctor_id, status, notes) VALUES ($1,$2,$3,$4)',
        [patient_id, assigned_doctor_id || null, 'waiting_triage', notes || null]
      )
    );
    res.status(201).json({ message: 'Patient checked in and added to triage queue.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/queue/active', authenticate, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT q.id, q.patient_id, q.status, q.check_in_time, q.notes,
             p.full_name AS patient_name, p.patient_type, p.blood_group,
             d.name AS doctor_name
      FROM patient_queue q
      JOIN patients p ON q.patient_id = p.id
      LEFT JOIN users d ON q.assigned_doctor_id = d.id
      WHERE q.status != 'completed'
      ORDER BY q.check_in_time ASC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/queue/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['waiting_triage','waiting_doctor','waiting_lab','waiting_pharmacy','completed'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status value.' });
  try {
    await withTransaction(req.user.id, async (c) => {
      const q = status === 'completed'
        ? 'UPDATE patient_queue SET status=$1, check_out_time=CURRENT_TIMESTAMP WHERE id=$2'
        : 'UPDATE patient_queue SET status=$1 WHERE id=$2';
      await c.query(q, [status, req.params.id]);
    });
    res.json({ message: `Queue status updated to "${status}".` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. CLINICAL RECORDS & EMR
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/vitals', authenticate, authorize('nurse', 'doctor'), async (req, res) => {
  const { patient_id, blood_pressure, temperature, weight, heart_rate, spo2 } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id is required.' });
  try {
    await withTransaction(req.user.id, async (c) => {
      await c.query(
        'INSERT INTO vitals (patient_id, nurse_id, blood_pressure, temperature, weight, heart_rate, spo2) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [patient_id, req.user.id, blood_pressure, temperature, weight, heart_rate, spo2 || null]
      );
      await c.query(
        "UPDATE patient_queue SET status='waiting_doctor' WHERE patient_id=$1 AND status='waiting_triage'",
        [patient_id]
      );
    });
    res.json({ message: 'Vitals recorded. Patient moved to doctor queue.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/consultations', authenticate, authorize('doctor'), async (req, res) => {
  const { patient_id, chief_complaint, diagnosis, treatment_plan, notes } = req.body;
  if (!patient_id || !chief_complaint || !diagnosis || !treatment_plan)
    return res.status(400).json({ error: 'patient_id, chief_complaint, diagnosis, and treatment_plan are required.' });
  try {
    const r = await withTransaction(req.user.id, async (c) =>
      c.query(
        'INSERT INTO consultations (patient_id, doctor_id, chief_complaint, diagnosis, treatment_plan, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [patient_id, req.user.id, chief_complaint, diagnosis, treatment_plan, notes || null]
      )
    );
    res.json({ message: 'Consultation saved.', consultation_id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/emr/history/:patient_id', authenticate, authorize('doctor', 'nurse', 'admin', 'receptionist'), async (req, res) => {
  const pid = req.params.patient_id;
  try {
    const [consultations, vitals, labs, prescriptions, immunizations] = await Promise.all([
      pool.query(`SELECT c.*, u.name AS doctor_name
                  FROM consultations c JOIN users u ON c.doctor_id = u.id
                  WHERE c.patient_id=$1 ORDER BY c.created_at DESC`, [pid]),
      pool.query(`SELECT v.*, u.name AS nurse_name
                  FROM vitals v LEFT JOIN users u ON v.nurse_id = u.id
                  WHERE v.patient_id=$1 ORDER BY v.recorded_at DESC`, [pid]),
      pool.query(`SELECT l.*, u.name AS doctor_name
                  FROM lab_requests l JOIN consultations c ON l.consultation_id = c.id
                  JOIN users u ON c.doctor_id = u.id
                  WHERE l.patient_id=$1 ORDER BY l.requested_at DESC`, [pid]),
      pool.query(`SELECT p.*, d.name AS doctor_name
                  FROM prescriptions p JOIN users d ON p.doctor_id = d.id
                  WHERE p.patient_id=$1 ORDER BY p.created_at DESC`, [pid]),
      pool.query(`SELECT i.*, u.name AS nurse_name
                  FROM immunizations i LEFT JOIN users u ON i.nurse_id = u.id
                  WHERE i.patient_id=$1 ORDER BY i.recorded_at DESC`, [pid]),
    ]);
    res.json({
      consultations: consultations.rows,
      vitals: vitals.rows,
      labs: labs.rows,
      prescriptions: prescriptions.rows,
      immunizations: immunizations.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. LABORATORY
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/lab/request', authenticate, authorize('doctor'), async (req, res) => {
  const { consultation_id, patient_id, test_name } = req.body;
  if (!consultation_id || !patient_id || !test_name)
    return res.status(400).json({ error: 'consultation_id, patient_id, and test_name are required.' });
  try {
    await withTransaction(req.user.id, async (c) =>
      c.query(
        'INSERT INTO lab_requests (consultation_id, patient_id, test_name) VALUES ($1,$2,$3)',
        [consultation_id, patient_id, test_name]
      )
    );
    res.status(201).json({ message: 'Lab test requested successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lab/pending', authenticate, authorize('lab_tech', 'doctor', 'admin'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT l.*, p.full_name AS patient_name, d.name AS doctor_name
      FROM lab_requests l
      JOIN patients p ON l.patient_id = p.id
      JOIN consultations c ON l.consultation_id = c.id
      JOIN users d ON c.doctor_id = d.id
      WHERE l.status = 'pending'
      ORDER BY l.requested_at ASC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lab/results/:id', authenticate, authorize('lab_tech'), async (req, res) => {
  const { result_data } = req.body;
  if (!result_data) return res.status(400).json({ error: 'result_data is required.' });
  try {
    await withTransaction(req.user.id, async (c) =>
      c.query(
        "UPDATE lab_requests SET status='completed', lab_tech_id=$1, result_data=$2, completed_at=CURRENT_TIMESTAMP WHERE id=$3",
        [req.user.id, JSON.stringify(result_data), req.params.id]
      )
    );
    res.json({ message: 'Lab results submitted and attached to patient EMR.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. PHARMACY & INVENTORY
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/prescriptions', authenticate, authorize('doctor'), async (req, res) => {
  const { consultation_id, patient_id, items } = req.body;
  if (!consultation_id || !patient_id || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: 'consultation_id, patient_id, and at least one item are required.' });
  try {
    await withTransaction(req.user.id, async (c) => {
      const rx = await c.query(
        'INSERT INTO prescriptions (consultation_id, patient_id, doctor_id) VALUES ($1,$2,$3) RETURNING id',
        [consultation_id, patient_id, req.user.id]
      );
      const rxId = rx.rows[0].id;
      for (const item of items) {
        await c.query(
          'INSERT INTO prescription_items (prescription_id, inventory_id, dosage, quantity_prescribed) VALUES ($1,$2,$3,$4)',
          [rxId, item.inventory_id, item.dosage, item.quantity_prescribed]
        );
      }
    });
    res.status(201).json({ message: 'E-Prescription generated and sent to pharmacy.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pharmacy/queue', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const rx = await pool.query(`
      SELECT p.id, pat.full_name AS patient_name, d.name AS doctor_name, p.status, p.created_at
      FROM prescriptions p
      JOIN patients pat ON p.patient_id = pat.id
      JOIN users d ON p.doctor_id = d.id
      WHERE p.status = 'pending'
      ORDER BY p.created_at ASC
    `);
    for (const row of rx.rows) {
      const items = await pool.query(`
        SELECT pi.*, i.item_name, i.unit_price
        FROM prescription_items pi JOIN inventory i ON pi.inventory_id = i.id
        WHERE pi.prescription_id = $1
      `, [row.id]);
      row.items = items.rows;
    }
    res.json(rx.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/pharmacy/dispense/:id', authenticate, authorize('pharmacist'), async (req, res) => {
  try {
    await withTransaction(req.user.id, async (c) => {
      const items = await c.query(
        'SELECT inventory_id, quantity_prescribed FROM prescription_items WHERE prescription_id=$1',
        [req.params.id]
      );
      for (const item of items.rows) {
        const stock = await c.query('SELECT quantity FROM inventory WHERE id=$1 FOR UPDATE', [item.inventory_id]);
        if (!stock.rows.length || stock.rows[0].quantity < item.quantity_prescribed) {
          throw new Error(`Insufficient stock for item ID ${item.inventory_id}.`);
        }
        await c.query('UPDATE inventory SET quantity = quantity - $1 WHERE id=$2', [
          item.quantity_prescribed, item.inventory_id,
        ]);
      }
      await c.query(
        "UPDATE prescriptions SET status='dispensed', pharmacist_id=$1, dispensed_at=CURRENT_TIMESTAMP WHERE id=$2",
        [req.user.id, req.params.id]
      );
      await c.query('UPDATE prescription_items SET dispensed=TRUE WHERE prescription_id=$1', [req.params.id]);
    });
    res.json({ message: 'Prescription dispensed. Inventory deducted automatically.' });
  } catch (err) {
    if (err.message.includes('Insufficient')) return res.status(422).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventory', authenticate, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM inventory ORDER BY category, item_name');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  const { item_name, category, quantity, unit_price, reorder_level } = req.body;
  if (!item_name || !quantity || !unit_price)
    return res.status(400).json({ error: 'item_name, quantity, and unit_price are required.' });
  try {
    await withTransaction(req.user.id, async (c) =>
      c.query(
        `INSERT INTO inventory (item_name, category, quantity, unit_price, reorder_level)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (item_name) DO UPDATE
         SET quantity = inventory.quantity + $3,
             unit_price = $4,
             reorder_level = COALESCE($5, inventory.reorder_level),
             last_restocked_at = CURRENT_TIMESTAMP`,
        [item_name, category || 'Drug', quantity, unit_price, reorder_level || 10]
      )
    );
    res.json({ message: 'Inventory updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. BILLING
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/billing/unpaid', authenticate, authorize('receptionist', 'admin'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT b.*, p.full_name AS patient_name, p.university_id
      FROM billing_invoices b JOIN patients p ON b.patient_id = p.id
      WHERE b.status = 'unpaid'
      ORDER BY b.created_at ASC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/billing/all', authenticate, authorize('receptionist', 'admin'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT b.*, p.full_name AS patient_name, p.university_id
      FROM billing_invoices b JOIN patients p ON b.patient_id = p.id
      ORDER BY b.created_at DESC LIMIT 200
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/billing', authenticate, authorize('receptionist', 'pharmacist', 'admin'), async (req, res) => {
  const { patient_id, total_amount, purpose } = req.body;
  if (!patient_id || !total_amount || !purpose)
    return res.status(400).json({ error: 'patient_id, total_amount, and purpose are required.' });
  try {
    await withTransaction(req.user.id, async (c) =>
      c.query(
        'INSERT INTO billing_invoices (patient_id, generated_by, total_amount, purpose) VALUES ($1,$2,$3,$4)',
        [patient_id, req.user.id, total_amount, purpose]
      )
    );
    res.status(201).json({ message: 'Invoice created successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/billing/:id/pay', authenticate, authorize('receptionist', 'admin'), async (req, res) => {
  const { payment_method } = req.body;
  try {
    await withTransaction(req.user.id, async (c) =>
      c.query(
        "UPDATE billing_invoices SET status='paid', payment_method=$1, paid_at=CURRENT_TIMESTAMP WHERE id=$2",
        [payment_method || 'Cash', req.params.id]
      )
    );
    res.json({ message: 'Payment confirmed. Invoice marked as paid.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. CERTIFICATES & IMMUNIZATIONS
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/certificates', authenticate, authorize('doctor'), async (req, res) => {
  const { patient_id, certificate_type, start_date, end_date, remarks } = req.body;
  if (!patient_id || !certificate_type || !start_date || !end_date)
    return res.status(400).json({ error: 'patient_id, certificate_type, start_date, and end_date are required.' });
  try {
    await withTransaction(req.user.id, async (c) =>
      c.query(
        'INSERT INTO certificates (patient_id, doctor_id, certificate_type, start_date, end_date, remarks) VALUES ($1,$2,$3,$4,$5,$6)',
        [patient_id, req.user.id, certificate_type, start_date, end_date, remarks || null]
      )
    );
    res.status(201).json({ message: 'Medical certificate generated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/immunizations', authenticate, authorize('nurse'), async (req, res) => {
  const { patient_id, vaccine_name, dose_number, batch_number, next_due_date } = req.body;
  if (!patient_id || !vaccine_name)
    return res.status(400).json({ error: 'patient_id and vaccine_name are required.' });
  try {
    await withTransaction(req.user.id, async (c) =>
      c.query(
        'INSERT INTO immunizations (patient_id, nurse_id, vaccine_name, dose_number, batch_number, next_due_date) VALUES ($1,$2,$3,$4,$5,$6)',
        [patient_id, req.user.id, vaccine_name, dose_number || null, batch_number || null, next_due_date || null]
      )
    );
    res.status(201).json({ message: 'Immunization record saved.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. ANALYTICS & AUDIT LOGS (Admin)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/analytics', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [patients, consultations, labs, stock, revenue, paid] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM patients'),
      pool.query("SELECT COUNT(*) FROM consultations WHERE DATE(created_at) = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM lab_requests WHERE status = 'pending'"),
      pool.query('SELECT COUNT(*) FROM inventory WHERE quantity <= reorder_level'),
      pool.query("SELECT COALESCE(SUM(total_amount),0) AS total FROM billing_invoices WHERE status='paid'"),
      pool.query("SELECT COUNT(*) FROM billing_invoices WHERE status='paid'"),
    ]);
    res.json({
      totalPatients:       parseInt(patients.rows[0].count),
      consultationsToday:  parseInt(consultations.rows[0].count),
      pendingLabs:         parseInt(labs.rows[0].count),
      lowStock:            parseInt(stock.rows[0].count),
      totalRevenue:        parseFloat(revenue.rows[0].total),
      paidInvoices:        parseInt(paid.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit-logs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT a.*, u.name AS acting_user
      FROM audit_logs a LEFT JOIN users u ON a.changed_by = u.id
      ORDER BY a.created_at DESC LIMIT 200
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FRONTEND SERVING
// ═══════════════════════════════════════════════════════════════════════════
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🏥 FUD HIMS Server running on http://localhost:${PORT}`)
);
