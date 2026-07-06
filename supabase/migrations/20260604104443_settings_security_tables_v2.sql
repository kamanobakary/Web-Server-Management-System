/*
  # Settings, Security Rules, Blocked IPs and Audit Log
  Safe version using IF NOT EXISTS and DO blocks for policies
*/

-- Server settings
CREATE TABLE IF NOT EXISTS server_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_name           text NOT NULL DEFAULT 'Production Server',
  host                  text NOT NULL DEFAULT 'srv-prod-01.example.com',
  port                  integer NOT NULL DEFAULT 80,
  max_connections       integer NOT NULL DEFAULT 1024,
  keepalive_timeout     integer NOT NULL DEFAULT 65,
  worker_processes      text NOT NULL DEFAULT 'auto',
  worker_connections    integer NOT NULL DEFAULT 1024,
  gzip_enabled          boolean NOT NULL DEFAULT true,
  gzip_min_length       integer NOT NULL DEFAULT 1024,
  access_log_enabled    boolean NOT NULL DEFAULT true,
  error_log_level       text NOT NULL DEFAULT 'warn',
  sendfile_enabled      boolean NOT NULL DEFAULT true,
  tcp_nopush            boolean NOT NULL DEFAULT true,
  admin_email           text NOT NULL DEFAULT 'admin@domaine.com',
  alert_email           text NOT NULL DEFAULT 'alerts@domaine.com',
  timezone              text NOT NULL DEFAULT 'Europe/Paris',
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE server_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='server_settings' AND policyname='Public read server_settings') THEN
    CREATE POLICY "Public read server_settings" ON server_settings FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='server_settings' AND policyname='Public insert server_settings') THEN
    CREATE POLICY "Public insert server_settings" ON server_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='server_settings' AND policyname='Public update server_settings') THEN
    CREATE POLICY "Public update server_settings" ON server_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO server_settings (server_name, host, port)
VALUES ('Production Server', 'srv-prod-01.example.com', 80)
ON CONFLICT DO NOTHING;

-- Security rules
CREATE TABLE IF NOT EXISTS security_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled     boolean NOT NULL DEFAULT true,
  category    text NOT NULL DEFAULT 'general',
  sort_order  integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE security_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_rules' AND policyname='Public read security_rules') THEN
    CREATE POLICY "Public read security_rules" ON security_rules FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_rules' AND policyname='Public update security_rules') THEN
    CREATE POLICY "Public update security_rules" ON security_rules FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_rules' AND policyname='Public insert security_rules') THEN
    CREATE POLICY "Public insert security_rules" ON security_rules FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;

INSERT INTO security_rules (name, description, enabled, category, sort_order) VALUES
('Protection contre les attaques DDoS',    'Limite le nombre de requetes par IP (100 req/min)',      true,  'ddos',      1),
('Blocage des injections SQL',             'Filtre les requetes SQL malveillantes dans les URLs',     true,  'injection', 2),
('Protection XSS',                        'Bloque les scripts cross-site dans les parametres HTTP',  true,  'xss',       3),
('En-tetes de securite HTTP',             'HSTS, X-Frame-Options, CSP, X-Content-Type-Options',     true,  'headers',   4),
('Limitation du taux (Rate Limiting)',    '100 requetes/minute par IP, 1000/h par sous-reseau',     true,  'ratelimit', 5),
('Blocage geographique',                  'Bloquer certains pays ou regions specifiques',            false, 'geo',       6),
('Protection CSRF',                       'Tokens anti-falsification de requete inter-sites',        true,  'csrf',      7),
('Scan de malwares sur upload',           'Analyse les fichiers uploades avec ClamAV',               false, 'malware',   8),
('Authentification 2FA obligatoire',      'Oblige les admins a utiliser un second facteur',          false, 'auth',      9),
('Journalisation des actions admin',      'Enregistre toutes les actions dans le journal',           true,  'audit',    10)
ON CONFLICT DO NOTHING;

-- Blocked IPs
CREATE TABLE IF NOT EXISTS blocked_ips (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address   text NOT NULL UNIQUE,
  reason       text NOT NULL DEFAULT '',
  attempts     integer NOT NULL DEFAULT 0,
  auto_blocked boolean NOT NULL DEFAULT false,
  blocked_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_ips' AND policyname='Public read blocked_ips') THEN
    CREATE POLICY "Public read blocked_ips" ON blocked_ips FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_ips' AND policyname='Public insert blocked_ips') THEN
    CREATE POLICY "Public insert blocked_ips" ON blocked_ips FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_ips' AND policyname='Public delete blocked_ips') THEN
    CREATE POLICY "Public delete blocked_ips" ON blocked_ips FOR DELETE TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_ips' AND policyname='Public update blocked_ips') THEN
    CREATE POLICY "Public update blocked_ips" ON blocked_ips FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO blocked_ips (ip_address, reason, attempts, auto_blocked, blocked_at) VALUES
('203.0.113.42',  'Tentatives de connexion repetees (brute-force)',    47,   true,  now() - interval '3 hours'),
('198.51.100.23', 'Injection SQL detectee sur /api/users',             12,   true,  now() - interval '1 day'),
('192.0.2.100',   'Scan de ports agressif (892 ports en 5 min)',       892,  true,  now() - interval '2 days'),
('10.244.0.150',  'Bot malveillant identifie (user-agent sqlmap)',      234,  true,  now() - interval '3 days'),
('172.16.254.1',  'Tentatives XSS repetees sur formulaires',           28,   false, now() - interval '5 days'),
('100.64.0.50',   'Telechargement massif - probable scraper',          1240, false, now() - interval '7 days')
ON CONFLICT (ip_address) DO NOTHING;

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action       text NOT NULL,
  performed_by text NOT NULL DEFAULT 'Systeme',
  status       text NOT NULL DEFAULT 'success' CHECK (status IN ('success','warning','error')),
  details      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_log' AND policyname='Public read audit_log') THEN
    CREATE POLICY "Public read audit_log" ON audit_log FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_log' AND policyname='Public insert audit_log') THEN
    CREATE POLICY "Public insert audit_log" ON audit_log FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_log' AND policyname='Public delete audit_log') THEN
    CREATE POLICY "Public delete audit_log" ON audit_log FOR DELETE TO anon, authenticated USING (true);
  END IF;
END $$;

INSERT INTO audit_log (action, performed_by, status, details, created_at) VALUES
('Regle XSS activee',                           'ABOU KAMANO', 'success', 'Protection XSS activee via interface',              now() - interval '2 hours'),
('IP 203.0.113.42 bloquee automatiquement',     'Systeme',     'warning', '47 tentatives de connexion en 10 minutes',          now() - interval '3 hours'),
('Certificat SSL renouvele – www.acmecorp.com', 'Systeme',     'success', 'Renouvellement automatique – valide 90 jours',      now() - interval '1 day'),
('Tentative acces admin non autorise bloquee',  'Systeme',     'error',   'IP 198.51.100.23 – 3 tentatives sur /admin',        now() - interval '2 days'),
('Mise a jour regles firewall appliquee',       'ABOU KAMANO', 'success', 'Ajout de 3 nouvelles regles geographiques',         now() - interval '3 days'),
('Activation protection DDoS renforcee',        'ABOU KAMANO', 'success', 'Seuil abaisse de 200 a 100 req/min par IP',         now() - interval '4 days'),
('Scan de securite hebdomadaire execute',       'Systeme',     'success', 'Aucune vulnerabilite critique detectee',             now() - interval '5 days'),
('IP 192.0.2.100 bloquee – scan de ports',      'Systeme',     'warning', '892 connexions sur ports differents en 5 minutes',  now() - interval '6 days'),
('Regle CSRF desactivee temporairement',        'ABOU KAMANO', 'warning', 'Desactivee pour tests, reactivee apres deploiement',now() - interval '7 days'),
('Rotation de la cle API administration',       'ABOU KAMANO', 'success', 'Ancienne cle revoquee, nouvelle cle generee',       now() - interval '10 days')
ON CONFLICT DO NOTHING;
