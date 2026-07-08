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

// DB Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
  next();
};

// ================= API ROUTES =================

// --- AUTHENTICATION ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // Force patient role on public signup. Admin must promote staff manually in DB or via admin route.
    const userRole = role === 'admin' ? 'patient' : (role || 'patient'); 
    
    const newUser = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, userRole]
    );
    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error registering user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(400).json({ error: 'User not found' });
    
    const user = userRes.rows[0];
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ error: 'Invalid password' });
    
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Login error' });
  }
});

// --- ADMIN ROUTES ---
app.post('/api/admin/staff', authenticate, authorize(['admin']), async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await pool.query('INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)', [name, email, hash, role]);
    res.json({ message: 'Staff added successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/staff/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'Staff deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/payments', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT p.*, u.name as patient_name FROM payments p JOIN users u ON p.patient_id = u.id ORDER BY p.created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/payments/:id/verify', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const receiptNo = 'FUD-' + Math.floor(Math.random() * 1000000);
    await pool.query('UPDATE payments SET status = $1, receipt_no = $2 WHERE id = $3', ['verified', receiptNo, req.params.id]);
    res.json({ message: 'Payment verified', receipt_no: receiptNo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PATIENT ROUTES ---
app.get('/api/patient/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/appointments', authenticate, authorize(['patient']), async (req, res) => {
  const { doctor_id, appointment_date } = req.body;
  try {
    await pool.query('INSERT INTO appointments (patient_id, doctor_id, appointment_date) VALUES ($1, $2, $3)', [req.user.id, doctor_id, appointment_date]);
    res.json({ message: 'Appointment booked' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/patient/appointments', authenticate, authorize(['patient']), async (req, res) => {
  try {
    const result = await pool.query('SELECT a.*, u.name as doctor_name FROM appointments a JOIN users u ON a.doctor_id = u.id WHERE a.patient_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payments', authenticate, authorize(['patient']), async (req, res) => {
  const { amount, purpose } = req.body;
  try {
    await pool.query('INSERT INTO payments (patient_id, amount, purpose) VALUES ($1, $2, $3)', [req.user.id, amount, purpose]);
    res.json({ message: 'Payment submitted for verification' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- DOCTOR ROUTES ---
app.get('/api/doctor/appointments', authenticate, authorize(['doctor']), async (req, res) => {
  try {
    const result = await pool.query('SELECT a.*, u.name as patient_name FROM appointments a JOIN users u ON a.patient_id = u.id WHERE a.doctor_id = $1 ORDER BY a.appointment_date', [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/appointments/:id/status', authenticate, authorize(['doctor', 'patient']), async (req, res) => {
  const { status } = req.body; // 'approved' or 'cancelled'
  try {
    await pool.query('UPDATE appointments SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ message: `Appointment ${status}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/doctor/history/:patient_id', authenticate, authorize(['doctor']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC', [req.params.patient_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/prescriptions', authenticate, authorize(['doctor']), async (req, res) => {
  const { patient_id, medicine, dosage } = req.body;
  try {
    await pool.query('INSERT INTO prescriptions (patient_id, doctor_id, medicine, dosage) VALUES ($1, $2, $3, $4)', [patient_id, req.user.id, medicine, dosage]);
    res.json({ message: 'Prescription sent to pharmacy' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PHARMACIST ROUTES ---
app.get('/api/inventory', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY medicine_name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory', authenticate, authorize(['pharmacist']), async (req, res) => {
  const { medicine_name, quantity } = req.body;
  try {
    await pool.query(
      'INSERT INTO inventory (medicine_name, quantity) VALUES ($1, $2) ON CONFLICT (medicine_name) DO UPDATE SET quantity = inventory.quantity + $2, last_updated = CURRENT_TIMESTAMP',
      [medicine_name, quantity]
    );
    res.json({ message: 'Stock updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/prescriptions', authenticate, authorize(['pharmacist']), async (req, res) => {
  try {
    const result = await pool.query('SELECT p.*, u.name as patient_name, d.name as doctor_name FROM prescriptions p JOIN users u ON p.patient_id = u.id JOIN users d ON p.doctor_id = d.id WHERE p.status = \'sent\'');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/prescriptions/:id/dispense', authenticate, authorize(['pharmacist']), async (req, res) => {
  try {
    await pool.query('UPDATE prescriptions SET status = \'dispensed\' WHERE id = $1', [req.params.id]);
    res.json({ message: 'Prescription dispensed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET DOCTORS (Publicly accessible for booking)
app.get('/api/doctors', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE role = \'doctor\'');
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
