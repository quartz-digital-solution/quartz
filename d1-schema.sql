CREATE TABLE IF NOT EXISTS connected_sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  logo_path TEXT DEFAULT '',
  seo_title TEXT DEFAULT '',
  seo_description TEXT DEFAULT '',
  primary_keyword TEXT DEFAULT '',
  keywords_json TEXT DEFAULT '[]',
  category TEXT DEFAULT '',
  city TEXT DEFAULT '',
  district TEXT DEFAULT '',
  state TEXT DEFAULT 'Kerala',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  business_description TEXT DEFAULT '',
  services_json TEXT DEFAULT '[]',
  index_html TEXT NOT NULL,
  deployed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_connected_sites_slug ON connected_sites(slug);
CREATE INDEX IF NOT EXISTS idx_connected_sites_status ON connected_sites(status);
