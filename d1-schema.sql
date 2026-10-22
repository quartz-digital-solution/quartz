-- Quartz CRM v2. Run once on Cloudflare D1, or let the Worker create tables.
-- Amounts are stored as integer paise (100 paise = Rs.1), with signed adjustments.
CREATE TABLE IF NOT EXISTS enquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, project TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','read')), created_at TEXT NOT NULL, read_at TEXT, ip_hash TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_ip ON enquiries(ip_hash, created_at);
CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, business_name TEXT NOT NULL, contact_name TEXT NOT NULL DEFAULT '', website_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','maintenance','on_hold','closed')), email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', whatsapp TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT 'INR', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(business_name);
CREATE TABLE IF NOT EXISTS client_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, amount_paise INTEGER NOT NULL CHECK(amount_paise != 0), note TEXT NOT NULL DEFAULT '', paid_at TEXT NOT NULL, manual_date INTEGER NOT NULL DEFAULT 0 CHECK(manual_date IN (0,1)), created_at TEXT NOT NULL, voided_at TEXT);
CREATE INDEX IF NOT EXISTS idx_payments_client ON client_payments(client_id, paid_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS share_links (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE, scope TEXT NOT NULL CHECK(scope IN ('client','all')), client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE, created_at TEXT NOT NULL, revoked_at TEXT);
CREATE INDEX IF NOT EXISTS idx_share_active ON share_links(scope, client_id, revoked_at);
CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(ip_hash, created_at);

-- For an existing database with client_payments, Worker performs the non-destructive voided_at migration.
CREATE TABLE IF NOT EXISTS admin_sessions (sid_hash TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
