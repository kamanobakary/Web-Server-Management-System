import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ServerStatus = 'running' | 'stopped' | 'restarting' | 'error';
export type WebsiteStatus = 'active' | 'inactive' | 'maintenance' | 'error';
export type UserRole = 'admin' | 'operator' | 'user';
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type LogLevel = 'info' | 'warning' | 'error' | 'debug' | 'success';
export type LogCategory = 'system' | 'access' | 'error' | 'security' | 'backup';
export type AlertType = 'cpu' | 'memory' | 'disk' | 'network' | 'security' | 'service' | 'backup';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type BackupStatus = 'completed' | 'running' | 'failed' | 'scheduled';
export type BackupType = 'full' | 'incremental' | 'differential';

export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  status: ServerStatus;
  uptime_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface Website {
  id: string;
  name: string;
  domain: string;
  status: WebsiteStatus;
  ssl_enabled: boolean;
  traffic_monthly: number;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  last_login: string | null;
  created_at: string;
}

export interface ServerLog {
  id: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface Backup {
  id: string;
  name: string;
  size_mb: number;
  status: BackupStatus;
  backup_type: BackupType;
  path: string | null;
  created_at: string;
}

export interface PerformanceMetric {
  id: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_in: number;
  network_out: number;
  active_connections: number;
  recorded_at: string;
}

export interface DailyTraffic {
  id: string;
  date: string;
  total_visits: number;
  unique_visitors: number;
  pageviews: number;
  avg_response_time_ms: number;
  bounce_rate: number;
  uptime_pct: number;
  created_at: string;
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'resolved';
export type IncidentCategory = 'service' | 'security' | 'performance' | 'database' | 'network' | 'backup';

export interface ServerSettings {
  id: string;
  server_name: string;
  host: string;
  port: number;
  max_connections: number;
  keepalive_timeout: number;
  worker_processes: string;
  worker_connections: number;
  gzip_enabled: boolean;
  gzip_min_length: number;
  access_log_enabled: boolean;
  error_log_level: string;
  sendfile_enabled: boolean;
  tcp_nopush: boolean;
  admin_email: string;
  alert_email: string;
  timezone: string;
  updated_at: string;
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
  sort_order: number;
  updated_at: string;
}

export interface BlockedIp {
  id: string;
  ip_address: string;
  reason: string;
  attempts: number;
  auto_blocked: boolean;
  blocked_at: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  performed_by: string;
  status: 'success' | 'warning' | 'error';
  details: string | null;
  created_at: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  category: IncidentCategory;
  description: string | null;
  started_at: string;
  resolved_at: string | null;
  duration_minutes: number | null;
}
