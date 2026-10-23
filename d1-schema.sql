-- Quartz CRM v2. Run once on Cloudflare D1, or let the Worker create tables.
-- Amounts are stored as integer paise (100 paise = Rs.1), with signed adjustments.
CREATE TABLE IF NOT EXISTS enquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', project TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','read')), created_at TEXT NOT NULL, read_at TEXT, ip_hash TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_ip ON enquiries(ip_hash, created_at);
CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, business_name TEXT NOT NULL, contact_name TEXT NOT NULL DEFAULT '', website_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','maintenance','on_hold','closed')), email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', whatsapp TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT 'INR', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(business_name);
CREATE TABLE IF NOT EXISTS client_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, amount_paise INTEGER NOT NULL CHECK(amount_paise != 0), note TEXT NOT NULL DEFAULT '', paid_at TEXT NOT NULL, manual_date INTEGER NOT NULL DEFAULT 0 CHECK(manual_date IN (0,1)), created_at TEXT NOT NULL, voided_at TEXT);
CREATE INDEX IF NOT EXISTS idx_payments_client ON client_payments(client_id, paid_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS share_links (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE, scope TEXT NOT NULL CHECK(scope IN ('client','all')), client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE, created_at TEXT NOT NULL, revoked_at TEXT, include_credentials INTEGER NOT NULL DEFAULT 0, expires_at TEXT);
CREATE INDEX IF NOT EXISTS idx_share_active ON share_links(scope, client_id, revoked_at);
CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(ip_hash, created_at);

-- For an existing database with client_payments, Worker performs the non-destructive voided_at migration.
CREATE TABLE IF NOT EXISTS admin_sessions (sid_hash TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- Quartz CRM v3: encrypted client website access credentials and per-link sharing consent.
CREATE TABLE IF NOT EXISTS client_access (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, encrypted_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_client_access_client ON client_access(client_id,id);
-- If upgrading existing share_links, run this once only (the Worker performs this migration automatically):
-- ALTER TABLE share_links ADD COLUMN include_credentials INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE share_links ADD COLUMN expires_at TEXT;
-- Reserve client IDs starting with #00181 without changing existing references.
INSERT INTO sqlite_sequence(name,seq) SELECT 'clients',180 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name='clients');
UPDATE sqlite_sequence SET seq=180 WHERE name='clients' AND seq<180;

-- Recruitment applications: also created automatically by the Worker (safe on existing D1).
CREATE TABLE IF NOT EXISTS career_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, whatsapp TEXT NOT NULL, education TEXT NOT NULL, skills TEXT NOT NULL, country TEXT NOT NULL, state TEXT NOT NULL, district TEXT NOT NULL, postal_code TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', cv_key TEXT, cv_filename TEXT, cv_size INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed')), created_at TEXT NOT NULL, ip_hash TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_career_created ON career_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_ip ON career_applications(ip_hash,created_at);

-- Existing enquiry tables auto-migrate to add phone. Existing enquiries keep their email values.
-- Employees and compensation: Worker also creates these automatically.
CREATE TABLE IF NOT EXISTS employees(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,role TEXT NOT NULL,department TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',whatsapp TEXT NOT NULL DEFAULT '',location TEXT NOT NULL DEFAULT '',employment_type TEXT NOT NULL DEFAULT 'Commission-based',start_date TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','on_leave','inactive')),notes TEXT NOT NULL DEFAULT '',photo_key TEXT,photo_type TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_employee_name ON employees(name);
CREATE TABLE IF NOT EXISTS employee_payments(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,amount_paise INTEGER NOT NULL CHECK(amount_paise!=0),note TEXT NOT NULL DEFAULT '',paid_at TEXT NOT NULL,created_at TEXT NOT NULL,voided_at TEXT);
CREATE INDEX IF NOT EXISTS idx_employee_payments ON employee_payments(employee_id,paid_at DESC);
CREATE TABLE IF NOT EXISTS employee_share_links(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,revoked_at TEXT);
CREATE INDEX IF NOT EXISTS idx_employee_share ON employee_share_links(employee_id,revoked_at);
INSERT INTO sqlite_sequence(name,seq) SELECT 'employees',180 WHERE NOT EXISTS(SELECT 1 FROM sqlite_sequence WHERE name='employees');
UPDATE sqlite_sequence SET seq=180 WHERE name='employees' AND seq<180;
