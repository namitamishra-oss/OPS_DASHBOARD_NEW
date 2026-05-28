-- Tumhara apna DB — yahan write karte ho
-- Approved users list (SSO ke baad bhi yeh check hoga)
CREATE TABLE IF NOT EXISTS dashboard_users (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  role        TEXT DEFAULT 'viewer',    -- 'admin', 'viewer', 'ops'
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);

-- Audit log — kaun kab kya dekha
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_email  TEXT NOT NULL,
  action      TEXT NOT NULL,           -- 'login', 'view_users', 'export_mis'
  resource    TEXT,                    -- kaun sa page/data
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Kuch initial approved users daalo
INSERT INTO dashboard_users (email, name, role)
VALUES
  ('admin@yourcompany.com', 'Admin', 'admin'),
  ('namita.mishra@pinnacle.in', 'Ops Team', 'viewer')
ON CONFLICT DO NOTHING;