/*
  # Reports & Analytics Tables

  ## New Tables

  1. `daily_traffic`
     - id, date (unique), total_visits, unique_visitors, pageviews,
       avg_response_time_ms, bounce_rate (0-100), uptime_pct (0-100)
     - One row per day, cumulated across all sites

  2. `incidents`
     - id, title, severity (low/medium/high/critical), status (open/resolved),
       started_at, resolved_at, duration_minutes, description, category

  ## Security
  - RLS enabled, public read/write for demo dashboard
*/

-- Daily traffic aggregates
CREATE TABLE IF NOT EXISTS daily_traffic (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL UNIQUE,
  total_visits     bigint  DEFAULT 0,
  unique_visitors  bigint  DEFAULT 0,
  pageviews        bigint  DEFAULT 0,
  avg_response_time_ms numeric DEFAULT 0,
  bounce_rate      numeric DEFAULT 0,
  uptime_pct       numeric DEFAULT 100,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE daily_traffic ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read daily_traffic"
  ON daily_traffic FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert daily_traffic"
  ON daily_traffic FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update daily_traffic"
  ON daily_traffic FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete daily_traffic"
  ON daily_traffic FOR DELETE TO anon, authenticated USING (true);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  severity        text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status          text NOT NULL DEFAULT 'resolved' CHECK (status IN ('open','investigating','resolved')),
  category        text NOT NULL DEFAULT 'service' CHECK (category IN ('service','security','performance','database','network','backup')),
  description     text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  duration_minutes integer DEFAULT 0
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read incidents"
  ON incidents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert incidents"
  ON incidents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update incidents"
  ON incidents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete incidents"
  ON incidents FOR DELETE TO anon, authenticated USING (true);
