-- ============================================================
-- FUD Hospital Information Management System (HIMS)
-- Database Schema — PostgreSQL
-- Federal University Dutse Health Centre
-- ============================================================

-- 1. USERS & STAFF
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password      VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL CHECK (role IN ('admin','receptionist','nurse','doctor','lab_tech','pharmacist','patient')),
  is_active     BOOLEAN      DEFAULT TRUE,
  created_at    TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 2. PATIENTS
CREATE TABLE IF NOT EXISTS patients (
  id              SERIAL PRIMARY KEY,
  university_id   VARCHAR(100),
  patient_type    VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (patient_type IN ('student','staff','dependent','external')),
  full_name       VARCHAR(255) NOT NULL,
  dob             DATE,
  gender          VARCHAR(10) CHECK (gender IN ('Male','Female','Other')),
  blood_group     VARCHAR(5),
  genotype        VARCHAR(5),
  phone           VARCHAR(20),
  address         TEXT,
  registered_by   INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. PATIENT QUEUE
CREATE TABLE IF NOT EXISTS patient_queue (
  id                  SERIAL PRIMARY KEY,
  patient_id          INTEGER NOT NULL REFERENCES patients(id),
  assigned_doctor_id  INTEGER REFERENCES users(id),
  status              VARCHAR(50) NOT NULL DEFAULT 'waiting_triage'
                        CHECK (status IN ('waiting_triage','waiting_doctor','waiting_lab','waiting_pharmacy','completed')),
  check_in_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  check_out_time      TIMESTAMPTZ,
  notes               TEXT
);

-- 4. VITALS
CREATE TABLE IF NOT EXISTS vitals (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  nurse_id        INTEGER REFERENCES users(id),
  blood_pressure  VARCHAR(20),
  temperature     NUMERIC(5,2),
  weight          NUMERIC(6,2),
  heart_rate      INTEGER,
  spo2            NUMERIC(5,2),
  recorded_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. CONSULTATIONS
CREATE TABLE IF NOT EXISTS consultations (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  doctor_id       INTEGER NOT NULL REFERENCES users(id),
  chief_complaint TEXT NOT NULL,
  diagnosis       TEXT NOT NULL,
  treatment_plan  TEXT NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. LAB REQUESTS
CREATE TABLE IF NOT EXISTS lab_requests (
  id                SERIAL PRIMARY KEY,
  consultation_id   INTEGER NOT NULL REFERENCES consultations(id),
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  test_name         VARCHAR(255) NOT NULL,
  status            VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  lab_tech_id       INTEGER REFERENCES users(id),
  result_data       JSONB,
  requested_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at      TIMESTAMPTZ
);

-- 7. INVENTORY
CREATE TABLE IF NOT EXISTS inventory (
  id                SERIAL PRIMARY KEY,
  item_name         VARCHAR(255) UNIQUE NOT NULL,
  category          VARCHAR(50) NOT NULL DEFAULT 'Drug',
  quantity          INTEGER NOT NULL DEFAULT 0,
  unit_price        NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  reorder_level     INTEGER DEFAULT 10,
  last_restocked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. PRESCRIPTIONS
CREATE TABLE IF NOT EXISTS prescriptions (
  id                SERIAL PRIMARY KEY,
  consultation_id   INTEGER NOT NULL REFERENCES consultations(id),
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  doctor_id         INTEGER NOT NULL REFERENCES users(id),
  pharmacist_id     INTEGER REFERENCES users(id),
  status            VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','dispensed','cancelled')),
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  dispensed_at      TIMESTAMPTZ
);

-- 9. PRESCRIPTION ITEMS
CREATE TABLE IF NOT EXISTS prescription_items (
  id                  SERIAL PRIMARY KEY,
  prescription_id     INTEGER NOT NULL REFERENCES prescriptions(id),
  inventory_id        INTEGER NOT NULL REFERENCES inventory(id),
  dosage              VARCHAR(255) NOT NULL,
  quantity_prescribed INTEGER NOT NULL DEFAULT 1,
  dispensed           BOOLEAN DEFAULT FALSE
);

-- 10. BILLING INVOICES
CREATE TABLE IF NOT EXISTS billing_invoices (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  generated_by    INTEGER REFERENCES users(id),
  total_amount    NUMERIC(12,2) NOT NULL,
  purpose         VARCHAR(255) NOT NULL,
  status          VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','waived')),
  payment_method  VARCHAR(50),
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. CERTIFICATES
CREATE TABLE IF NOT EXISTS certificates (
  id                SERIAL PRIMARY KEY,
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  doctor_id         INTEGER NOT NULL REFERENCES users(id),
  certificate_type  VARCHAR(50) NOT NULL CHECK (certificate_type IN ('sick_leave','medical_fitness')),
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  remarks           TEXT,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. IMMUNIZATIONS
CREATE TABLE IF NOT EXISTS immunizations (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  nurse_id        INTEGER REFERENCES users(id),
  vaccine_name    VARCHAR(255) NOT NULL,
  dose_number     VARCHAR(50),
  batch_number    VARCHAR(100),
  next_due_date   DATE,
  recorded_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. AUDIT LOGS (Immutable — no DELETE or UPDATE permitted by application)
CREATE TABLE IF NOT EXISTS audit_logs (
  id            SERIAL PRIMARY KEY,
  table_name    VARCHAR(100) NOT NULL,
  action        VARCHAR(10)  NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  record_id     INTEGER,
  changed_by    INTEGER,
  old_data      JSONB,
  new_data      JSONB,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patients_name       ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_uid        ON patients(university_id);
CREATE INDEX IF NOT EXISTS idx_queue_status        ON patient_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_patient       ON patient_queue(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient      ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_pat   ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_status          ON lab_requests(status);
CREATE INDEX IF NOT EXISTS idx_rx_status           ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_billing_status      ON billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_audit_table         ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_logs(created_at DESC);

-- ============================================================
-- AUDIT TRIGGER FUNCTION
-- Reads app.current_user_id from session local config
-- ============================================================
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id INTEGER;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  BEGIN
    v_user_id := current_setting('app.current_user_id', TRUE)::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  END IF;

  INSERT INTO audit_logs (table_name, action, record_id, changed_by, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    v_user_id,
    v_old_data,
    v_new_data
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to audited tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','patients','patient_queue','vitals','consultations',
    'lab_requests','inventory','prescriptions','prescription_items',
    'billing_invoices','certificates','immunizations'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%1$s ON %1$s;
       CREATE TRIGGER trg_audit_%1$s
       AFTER INSERT OR UPDATE OR DELETE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();', tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- SEED: Default Admin Account
-- Password: admin123 (bcrypt hash)
-- ============================================================
INSERT INTO users (name, email, password, role)
VALUES (
  'System Administrator',
  'admin@fud.edu.ng',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- SEED: Sample Inventory Items
-- ============================================================
INSERT INTO inventory (item_name, category, quantity, unit_price, reorder_level) VALUES
  ('Amoxicillin 500mg', 'Drug', 250, 150.00, 30),
  ('Paracetamol 500mg', 'Drug', 500, 50.00, 50),
  ('Ibuprofen 400mg', 'Drug', 300, 80.00, 30),
  ('Metronidazole 200mg', 'Drug', 200, 120.00, 25),
  ('Ciprofloxacin 500mg', 'Drug', 150, 200.00, 20),
  ('Chloroquine 250mg', 'Drug', 100, 90.00, 20),
  ('ORS Sachet', 'Drug', 400, 40.00, 50),
  ('Surgical Gloves (pair)', 'Consumable', 1000, 30.00, 100),
  ('Disposable Syringe 5ml', 'Consumable', 800, 25.00, 100),
  ('IV Cannula', 'Consumable', 200, 120.00, 30),
  ('Gauze Bandage', 'Consumable', 300, 60.00, 50),
  ('Glucometer Strips', 'Consumable', 5, 1200.00, 20)
ON CONFLICT (item_name) DO NOTHING;
