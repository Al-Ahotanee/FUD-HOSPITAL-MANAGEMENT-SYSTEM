-- ============================================================================
-- FUD HOSPITAL INFORMATION MANAGEMENT SYSTEM (HIMS)
-- Federal University Dutse — PostgreSQL Schema
-- Fully normalized, with immutable audit logging via triggers.
-- ============================================================================

-- Clean rebuild (safe for dev/eval environments)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS immunizations CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS billing_invoices CASCADE;
DROP TABLE IF EXISTS prescription_items CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS lab_requests CASCADE;
DROP TABLE IF EXISTS consultations CASCADE;
DROP TABLE IF EXISTS vitals CASCADE;
DROP TABLE IF EXISTS patient_queue CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- 1. USERS (staff + patient portal accounts)
-- ============================================================================
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password      TEXT NOT NULL,
  role          VARCHAR(30) NOT NULL CHECK (role IN
                  ('admin','receptionist','nurse','doctor','lab_tech','pharmacist','patient')),
                  -- NOTE: 'nurse' is retained only for backward compatibility with
                  -- existing accounts. Triage/vitals/immunization duties were merged
                  -- into the Receptionist role to streamline front-desk operations;
                  -- new staff accounts should be created as 'receptionist'.
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. PATIENTS (clinical record, distinct from portal login)
-- ============================================================================
CREATE TABLE patients (
  id              SERIAL PRIMARY KEY,
  university_id   VARCHAR(50),
  patient_type    VARCHAR(20) NOT NULL DEFAULT 'student'
                    CHECK (patient_type IN ('student','staff','dependent')),
  full_name       VARCHAR(150) NOT NULL,
  dob             DATE,
  gender          VARCHAR(10) CHECK (gender IN ('Male','Female')),
  blood_group     VARCHAR(5),
  genotype        VARCHAR(5),
  allergies       TEXT,
  phone           VARCHAR(30),
  address         TEXT,
  linked_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  registered_by   INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_patients_search ON patients (full_name, university_id);

-- ============================================================================
-- 3. PATIENT QUEUE (triage / doctor / lab / pharmacy routing)
-- ============================================================================
CREATE TABLE patient_queue (
  id                  SERIAL PRIMARY KEY,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assigned_doctor_id  INTEGER REFERENCES users(id),
  status              VARCHAR(30) NOT NULL DEFAULT 'waiting_triage'
                        CHECK (status IN
                          ('waiting_triage','waiting_doctor','waiting_lab','waiting_pharmacy','completed')),
  priority            VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent')),
  check_in_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_time      TIMESTAMPTZ
);
CREATE INDEX idx_queue_status ON patient_queue (status);

-- ============================================================================
-- 4. VITALS
-- ============================================================================
CREATE TABLE vitals (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  nurse_id        INTEGER NOT NULL REFERENCES users(id),
  blood_pressure  VARCHAR(20) NOT NULL,
  temperature     NUMERIC(4,1) NOT NULL,
  weight          NUMERIC(5,1) NOT NULL,
  heart_rate      INTEGER NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vitals_patient ON vitals (patient_id);

-- ============================================================================
-- 5. CONSULTATIONS (core EMR entry)
-- ============================================================================
CREATE TABLE consultations (
  id               SERIAL PRIMARY KEY,
  patient_id       INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id        INTEGER NOT NULL REFERENCES users(id),
  chief_complaint  TEXT NOT NULL,
  diagnosis        TEXT NOT NULL,
  treatment_plan   TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_consultations_patient ON consultations (patient_id);

-- ============================================================================
-- 6. LAB REQUESTS
-- ============================================================================
CREATE TABLE lab_requests (
  id               SERIAL PRIMARY KEY,
  consultation_id  INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id       INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  test_name        VARCHAR(150) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  lab_tech_id      INTEGER REFERENCES users(id),
  result_data      JSONB,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);
CREATE INDEX idx_lab_patient ON lab_requests (patient_id);
CREATE INDEX idx_lab_status ON lab_requests (status);

-- ============================================================================
-- 7. INVENTORY (pharmacy stock)
-- ============================================================================
CREATE TABLE inventory (
  id                 SERIAL PRIMARY KEY,
  item_name          VARCHAR(150) UNIQUE NOT NULL,
  category           VARCHAR(30) NOT NULL DEFAULT 'Drug' CHECK (category IN ('Drug','Consumable')),
  quantity           INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  reorder_level      INTEGER NOT NULL DEFAULT 10,
  last_restocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. PRESCRIPTIONS & ITEMS (E-Prescription -> dispensary linkage)
-- ============================================================================
CREATE TABLE prescriptions (
  id               SERIAL PRIMARY KEY,
  consultation_id  INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id       INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id        INTEGER NOT NULL REFERENCES users(id),
  pharmacist_id    INTEGER REFERENCES users(id),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dispensed','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispensed_at     TIMESTAMPTZ
);

CREATE TABLE prescription_items (
  id                    SERIAL PRIMARY KEY,
  prescription_id       INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  inventory_id          INTEGER NOT NULL REFERENCES inventory(id),
  dosage                VARCHAR(150) NOT NULL,
  quantity_prescribed   INTEGER NOT NULL CHECK (quantity_prescribed > 0),
  dispensed             BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================================
-- 9. BILLING & INVOICING (linked to consultations / labs / prescriptions)
-- ============================================================================
CREATE TABLE billing_invoices (
  id                 SERIAL PRIMARY KEY,
  patient_id         INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  generated_by       INTEGER REFERENCES users(id),
  total_amount       NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  purpose            VARCHAR(200) NOT NULL,
  reference_type     VARCHAR(20) CHECK (reference_type IN ('consultation','lab_request','prescription','manual')),
  reference_id       INTEGER,
  -- unpaid -> processing (patient submits a mock online payment) -> paid (Reception confirms)
  -- Reception/Admin may also confirm directly from 'unpaid' for cash/in-person payments.
  status             VARCHAR(15) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','processing','paid')),
  payment_method     VARCHAR(20),                 -- e.g. 'mock_card', 'cash'
  payment_reference  VARCHAR(60),                 -- mock transaction reference shown to Reception for reconciliation
  initiated_at       TIMESTAMPTZ,                 -- when the patient submitted the mock payment
  confirmed_by       INTEGER REFERENCES users(id),-- Reception/Admin staff who confirmed the payment
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at            TIMESTAMPTZ
);
CREATE INDEX idx_billing_patient ON billing_invoices (patient_id);
CREATE INDEX idx_billing_status ON billing_invoices (status);

-- ============================================================================
-- 10. CERTIFICATES
-- ============================================================================
CREATE TABLE certificates (
  id                 SERIAL PRIMARY KEY,
  patient_id         INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id          INTEGER NOT NULL REFERENCES users(id),
  certificate_type   VARCHAR(30) NOT NULL CHECK (certificate_type IN ('sick_leave','medical_fitness')),
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  remarks            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 11. IMMUNIZATIONS
-- ============================================================================
CREATE TABLE immunizations (
  id               SERIAL PRIMARY KEY,
  patient_id       INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  nurse_id         INTEGER NOT NULL REFERENCES users(id),
  vaccine_name     VARCHAR(150) NOT NULL,
  dose_number      VARCHAR(30) NOT NULL,
  next_due_date    DATE,
  administered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 12. AUDIT LOGS (immutable — INSERT only, enforced by trigger below)
-- ============================================================================
CREATE TABLE audit_logs (
  id           SERIAL PRIMARY KEY,
  table_name   VARCHAR(50) NOT NULL,
  action       VARCHAR(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  record_id    INTEGER,
  changed_by   INTEGER REFERENCES users(id),
  old_data     JSONB,
  new_data     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);

-- ============================================================================
-- AUDIT TRIGGER ENGINE
-- Captures every INSERT/UPDATE/DELETE on clinically/financially sensitive
-- tables. Reads the acting user from the session-local variable
-- `app.current_user_id`, which server.js sets via `SET LOCAL` inside every
-- write transaction (see withTransaction()).
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_trigger() RETURNS TRIGGER AS $$
DECLARE
  acting_user INTEGER;
BEGIN
  BEGIN
    acting_user := NULLIF(current_setting('app.current_user_id', true), '')::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    acting_user := NULL;
  END;

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (table_name, action, record_id, changed_by, old_data)
    VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, acting_user, to_jsonb(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (table_name, action, record_id, changed_by, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, acting_user, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (table_name, action, record_id, changed_by, new_data)
    VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, acting_user, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach the audit trigger to sensitive/high-value tables
CREATE TRIGGER trg_audit_users AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_patients AFTER INSERT OR UPDATE OR DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_inventory AFTER INSERT OR UPDATE OR DELETE ON inventory
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_prescriptions AFTER INSERT OR UPDATE OR DELETE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_billing AFTER INSERT OR UPDATE OR DELETE ON billing_invoices
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
CREATE TRIGGER trg_audit_consultations AFTER INSERT OR UPDATE OR DELETE ON consultations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- ============================================================================
-- IMMUTABILITY GUARD — audit_logs may never be altered or erased once written
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_prevent_audit_tampering() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable: % operations are not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- ============================================================================
-- SEED DATA — starter pharmacy inventory (safe to skip if already populated)
-- ============================================================================
INSERT INTO inventory (item_name, category, quantity, unit_price, reorder_level) VALUES
  ('Paracetamol 500mg', 'Drug', 500, 50.00, 50),
  ('Amoxicillin 500mg', 'Drug', 300, 120.00, 40),
  ('Artemether/Lumefantrine (Coartem)', 'Drug', 200, 850.00, 30),
  ('Ibuprofen 400mg', 'Drug', 400, 70.00, 50),
  ('ORS Sachets', 'Drug', 250, 100.00, 30),
  ('Vitamin C 1000mg', 'Drug', 350, 60.00, 40),
  ('Metronidazole 400mg', 'Drug', 220, 90.00, 30),
  ('Disposable Syringes (5ml)', 'Consumable', 600, 30.00, 100),
  ('Surgical Gloves (Box)', 'Consumable', 80, 1500.00, 15),
  ('Cotton Wool Roll', 'Consumable', 150, 250.00, 20)
ON CONFLICT (item_name) DO NOTHING;
