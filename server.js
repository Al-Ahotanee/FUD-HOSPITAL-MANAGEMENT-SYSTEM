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

// Database Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Advanced Transaction Wrapper: Injects User ID into Postgres session for DB-level Audit Triggers
const withTransaction = async (userId, callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userId) {
      // Set the local config so the DB trigger knows who is making the change
      await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
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

// --- MIDDLEWARE ---
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    req.user = verified; // Contains id, role, email
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

// --- AUTO-INIT ADMIN ---
const initializeSystem = async () => {
  try {
    const res = await pool.query("SELECT * FROM users WHERE role = 'admin'");
    if (res.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('admin123', salt);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        ['System Administrator', 'admin@fud.edu.ng', hash, 'admin']
      );
      console.log('✅ Default Admin account created (admin@fud.edu.ng / admin123)');
    }
  } catch (err) {
    console.error('Database Init Error:', err.message);
  }
};
initializeSystem();

// ================= API ROUTES =================

// --- 1. AUTHENTICATION ---
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

// --- 2. USER & STAFF MANAGEMENT (Admin) ---
app.get('/api/users', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', authenticate, authorize(['admin']), async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
      [name, email, hash, role]
    );
    res.status(201).json({ message: 'Staff created successfully.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 3. PATIENTS (Receptionist / Admin) ---
app.post('/api/patients', authenticate, authorize(['admin', 'receptionist']), async (req, res) => {
  const { university_id, patient_type, full_name, dob, gender, blood_group, genotype, phone, address } = req.body;
  try {
    const result = await withTransaction(req.user.id, async (client) => {
      return await client.query(
        `INSERT INTO patients (university_id, patient_type, full_name, dob, gender, blood_group, genotype, phone, address) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [university_id, patient_type, full_name, dob, gender, blood_group, genotype, phone, address]
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
      query = 'SELECT * FROM patients WHERE full_name ILIKE $1 OR university_id ILIKE $1 ORDER BY created_at DESC';
      params = [`%${search}%`];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4. QUEUE MANAGEMENT ---
app.post('/api/queue', authenticate, authorize(['receptionist', 'nurse']), async (req, res) => {
  const { patient_id, assigned_doctor_id } = req.body;
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO patient_queue (patient_id, assigned_doctor_id, status) VALUES ($1, $2, $3)',
        [patient_id, assigned_doctor_id, 'waiting_triage']
      );
    });
    res.json({ message: 'Patient added to queue.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/queue/active', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT q.id, q.status, q.check_in_time, p.full_name as patient_name, p.patient_type, d.name as doctor_name 
      FROM patient_queue q 
      JOIN patients p ON q.patient_id = p.id 
      LEFT JOIN users d ON q.assigned_doctor_id = d.id 
      WHERE q.status != 'completed' 
      ORDER BY q.check_in_time ASC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/queue/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  try {
    await withTransaction(req.user.id, async (client) => {
      const query = status === 'completed' 
        ? 'UPDATE patient_queue SET status = $1, check_out_time = CURRENT_TIMESTAMP WHERE id = $2'
        : 'UPDATE patient_queue SET status = $1 WHERE id = $2';
      await client.query(query, [status, req.params.id]);
    });
    res.json({ message: `Queue status updated to ${status}.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 5. CLINICAL RECORDS & EMR ---
app.post('/api/vitals', authenticate, authorize(['nurse', 'doctor']), async (req, res) => {
  const { patient_id, blood_pressure, temperature, weight, heart_rate } = req.body;
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO vitals (patient_id, nurse_id, blood_pressure, temperature, weight, heart_rate) VALUES ($1, $2, $3, $4, $5, $6)',
        [patient_id, req.user.id, blood_pressure, temperature, weight, heart_rate]
      );
      // Automatically update queue if they are waiting for triage
      await client.query("UPDATE patient_queue SET status = 'waiting_doctor' WHERE patient_id = $1 AND status = 'waiting_triage'", [patient_id]);
    });
    res.json({ message: 'Vitals logged successfully.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/consultations', authenticate, authorize(['doctor']), async (req, res) => {
  const { patient_id, chief_complaint, diagnosis, treatment_plan, notes } = req.body;
  try {
    const result = await withTransaction(req.user.id, async (client) => {
      return await client.query(
        'INSERT INTO consultations (patient_id, doctor_id, chief_complaint, diagnosis, treatment_plan, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [patient_id, req.user.id, chief_complaint, diagnosis, treatment_plan, notes]
      );
    });
    res.json({ message: 'Consultation saved.', consultation_id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/emr/history/:patient_id', authenticate, authorize(['doctor', 'nurse', 'admin']), async (req, res) => {
  try {
    const consultations = await pool.query('SELECT c.*, u.name as doctor_name FROM consultations c JOIN users u ON c.doctor_id = u.id WHERE c.patient_id = $1 ORDER BY c.created_at DESC', [req.params.patient_id]);
    const vitals = await pool.query('SELECT v.*, u.name as nurse_name FROM vitals v JOIN users u ON v.nurse_id = u.id WHERE v.patient_id = $1 ORDER BY v.recorded_at DESC', [req.params.patient_id]);
    res.json({ consultations: consultations.rows, vitals: vitals.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 6. LABORATORY ---
app.post('/api/lab/request', authenticate, authorize(['doctor']), async (req, res) => {
  const { consultation_id, patient_id, test_name } = req.body;
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO lab_requests (consultation_id, patient_id, test_name) VALUES ($1, $2, $3)',
        [consultation_id, patient_id, test_name]
      );
    });
    res.json({ message: 'Lab test requested.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/lab/pending', authenticate, authorize(['lab_tech', 'doctor']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, p.full_name as patient_name, d.name as doctor_name 
      FROM lab_requests l JOIN patients p ON l.patient_id = p.id JOIN consultations c ON l.consultation_id = c.id JOIN users d ON c.doctor_id = d.id 
      WHERE l.status = 'pending' ORDER BY l.requested_at ASC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/lab/results/:id', authenticate, authorize(['lab_tech']), async (req, res) => {
  const { result_data } = req.body; // Expecting a JSON object
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        "UPDATE lab_requests SET status = 'completed', lab_tech_id = $1, result_data = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3",
        [req.user.id, JSON.stringify(result_data), req.params.id]
      );
    });
    res.json({ message: 'Lab results submitted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 7. PHARMACY & INVENTORY ---
app.post('/api/prescriptions', authenticate, authorize(['doctor']), async (req, res) => {
  const { consultation_id, patient_id, items } = req.body; // items: [{inventory_id, dosage, quantity_prescribed}]
  try {
    await withTransaction(req.user.id, async (client) => {
      const rxResult = await client.query(
        'INSERT INTO prescriptions (consultation_id, patient_id, doctor_id) VALUES ($1, $2, $3) RETURNING id',
        [consultation_id, patient_id, req.user.id]
      );
      const rxId = rxResult.rows[0].id;
      
      for (let item of items) {
        await client.query(
          'INSERT INTO prescription_items (prescription_id, inventory_id, dosage, quantity_prescribed) VALUES ($1, $2, $3, $4)',
          [rxId, item.inventory_id, item.dosage, item.quantity_prescribed]
        );
      }
    });
    res.json({ message: 'E-Prescription generated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/pharmacy/queue', authenticate, authorize(['pharmacist']), async (req, res) => {
  try {
    const rx = await pool.query(`
      SELECT p.id, pat.full_name as patient_name, d.name as doctor_name, p.status, p.created_at
      FROM prescriptions p JOIN patients pat ON p.patient_id = pat.id JOIN users d ON p.doctor_id = d.id 
      WHERE p.status = 'pending' ORDER BY p.created_at ASC
    `);
    
    // Fetch items for each prescription
    for(let r of rx.rows) {
      const items = await pool.query(`
        SELECT pi.*, i.item_name FROM prescription_items pi JOIN inventory i ON pi.inventory_id = i.id WHERE pi.prescription_id = $1
      `, [r.id]);
      r.items = items.rows;
    }
    res.json(rx.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/pharmacy/dispense/:id', authenticate, authorize(['pharmacist']), async (req, res) => {
  try {
    await withTransaction(req.user.id, async (client) => {
      // Get items to deduct inventory
      const items = await client.query('SELECT inventory_id, quantity_prescribed FROM prescription_items WHERE prescription_id = $1', [req.params.id]);
      
      for(let item of items.rows) {
        await client.query('UPDATE inventory SET quantity = quantity - $1 WHERE id = $2', [item.quantity_prescribed, item.inventory_id]);
      }
      
      await client.query("UPDATE prescriptions SET status = 'dispensed', pharmacist_id = $1 WHERE id = $2", [req.user.id, req.params.id]);
      await client.query("UPDATE prescription_items SET dispensed = TRUE WHERE prescription_id = $1", [req.params.id]);
    });
    res.json({ message: 'Prescription dispensed and inventory updated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY category, item_name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory', authenticate, authorize(['pharmacist', 'admin']), async (req, res) => {
  const { item_name, category, quantity, unit_price } = req.body;
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

// --- 8. BILLING ---
app.post('/api/billing', authenticate, authorize(['receptionist', 'pharmacist', 'admin']), async (req, res) => {
  const { patient_id, total_amount, purpose } = req.body;
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO billing_invoices (patient_id, generated_by, total_amount, purpose) VALUES ($1, $2, $3, $4)',
        [patient_id, req.user.id, total_amount, purpose]
      );
    });
    res.json({ message: 'Invoice generated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/billing/:id/pay', authenticate, authorize(['receptionist', 'admin']), async (req, res) => {
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query("UPDATE billing_invoices SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
    });
    res.json({ message: 'Invoice marked as paid.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 9. CERTIFICATES & IMMUNIZATION ---
app.post('/api/certificates', authenticate, authorize(['doctor']), async (req, res) => {
  const { patient_id, certificate_type, start_date, end_date, remarks } = req.body;
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO certificates (patient_id, doctor_id, certificate_type, start_date, end_date, remarks) VALUES ($1, $2, $3, $4, $5, $6)',
        [patient_id, req.user.id, certificate_type, start_date, end_date, remarks]
      );
    });
    res.json({ message: 'Certificate generated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/immunizations', authenticate, authorize(['nurse']), async (req, res) => {
  const { patient_id, vaccine_name, dose_number, next_due_date } = req.body;
  try {
    await withTransaction(req.user.id, async (client) => {
      await client.query(
        'INSERT INTO immunizations (patient_id, nurse_id, vaccine_name, dose_number, next_due_date) VALUES ($1, $2, $3, $4, $5)',
        [patient_id, req.user.id, vaccine_name, dose_number, next_due_date]
      );
    });
    res.json({ message: 'Immunization record saved.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 10. SYSTEM ANALYTICS & AUDIT LOGS ---
app.get('/api/analytics', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const stats = {};
    stats.totalPatients = (await pool.query('SELECT COUNT(*) FROM patients')).rows[0].count;
    stats.consultationsToday = (await pool.query('SELECT COUNT(*) FROM consultations WHERE DATE(created_at) = CURRENT_DATE')).rows[0].count;
    stats.pendingLabs = (await pool.query("SELECT COUNT(*) FROM lab_requests WHERE status = 'pending'")).rows[0].count;
    stats.lowStock = (await pool.query('SELECT COUNT(*) FROM inventory WHERE quantity < 10')).rows[0].count;
    res.json(stats);
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

// ================= FRONTEND SERVING =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 HIMS Server running on port ${PORT}`));
