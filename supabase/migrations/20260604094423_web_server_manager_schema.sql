/*
  # Web Server Manager - Initial Schema

  ## New Tables
  
  1. `server_config` - Server configuration and current state
     - id, name, host, port, status, created_at, updated_at
  
  2. `websites` - Managed websites/virtual hosts
     - id, name, domain, status, created_at, traffic, ssl_enabled
  
  3. `app_users` - Application users with roles
     - id, name, email, role, status, last_login, created_at
  
  4. `server_logs` - Server activity logs
     - id, level, category, message, ip_address, user_agent, created_at
  
  5. `alerts` - System alerts and notifications
     - id, type, severity, message, resolved, created_at, resolved_at
  
  6. `backups` - Backup records
     - id, name, size_mb, status, created_at, path
  
  7. `performance_metrics` - Historical performance data
     - id, cpu_usage, memory_usage, disk_usage, network_in, network_out, recorded_at

  ## Security
  - RLS enabled on all tables
  - Public read/write policies for demo purposes (no auth required for dashboard)
*/

-- Server configuration table
CREATE TABLE IF NOT EXISTS server_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Production Server',
  host text NOT NULL DEFAULT 'srv-prod-01.example.com',
  port integer NOT NULL DEFAULT 80,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'restarting', 'error')),
  uptime_seconds bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE server_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read server_config"
  ON server_config FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public update server_config"
  ON server_config FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public insert server_config"
  ON server_config FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Websites table
CREATE TABLE IF NOT EXISTS websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'error')),
  ssl_enabled boolean DEFAULT true,
  traffic_monthly bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read websites"
  ON websites FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert websites"
  ON websites FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update websites"
  ON websites FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete websites"
  ON websites FOR DELETE TO anon, authenticated USING (true);

-- App users table
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'operator', 'user')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read app_users"
  ON app_users FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert app_users"
  ON app_users FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update app_users"
  ON app_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete app_users"
  ON app_users FOR DELETE TO anon, authenticated USING (true);

-- Server logs table
CREATE TABLE IF NOT EXISTS server_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error', 'debug', 'success')),
  category text NOT NULL DEFAULT 'system' CHECK (category IN ('system', 'access', 'error', 'security', 'backup')),
  message text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE server_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read server_logs"
  ON server_logs FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert server_logs"
  ON server_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public delete server_logs"
  ON server_logs FOR DELETE TO anon, authenticated USING (true);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('cpu', 'memory', 'disk', 'network', 'security', 'service', 'backup')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message text NOT NULL,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read alerts"
  ON alerts FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert alerts"
  ON alerts FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update alerts"
  ON alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete alerts"
  ON alerts FOR DELETE TO anon, authenticated USING (true);

-- Backups table
CREATE TABLE IF NOT EXISTS backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  size_mb numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'running', 'failed', 'scheduled')),
  backup_type text NOT NULL DEFAULT 'full' CHECK (backup_type IN ('full', 'incremental', 'differential')),
  path text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read backups"
  ON backups FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert backups"
  ON backups FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update backups"
  ON backups FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete backups"
  ON backups FOR DELETE TO anon, authenticated USING (true);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpu_usage numeric DEFAULT 0,
  memory_usage numeric DEFAULT 0,
  disk_usage numeric DEFAULT 0,
  network_in numeric DEFAULT 0,
  network_out numeric DEFAULT 0,
  active_connections integer DEFAULT 0,
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read performance_metrics"
  ON performance_metrics FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert performance_metrics"
  ON performance_metrics FOR INSERT TO anon, authenticated WITH CHECK (true);
