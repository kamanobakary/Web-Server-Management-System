import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Download, Users, Globe,
  Zap, AlertTriangle, Activity, Shield, RefreshCw, Search,
  Clock, CheckCircle, XCircle, Loader2, WifiOff,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DailyTraffic, Incident, Alert, PerformanceMetric } from '../lib/supabase';
import { formatDateTime } from '../lib/utils';
import LineChart from '../components/LineChart';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '3m' | '6m';

interface ReportStats {
  totalVisits: number;
  uniqueVisitors: number;
  pageviews: number;
  avgResponseTime: number;
  avgBounceRate: number;
  avgUptime: number;
  totalIncidents: number;
  openIncidents: number;
  totalAlerts: number;
  unresolvedAlerts: number;
  activeUsers: number;
  prevTotalVisits: number;
  prevAvgResponseTime: number;
  prevBounceRate: number;
  prevUptime: number;
}

const EMPTY_STATS: ReportStats = {
  totalVisits: 0, uniqueVisitors: 0, pageviews: 0,
  avgResponseTime: 0, avgBounceRate: 0, avgUptime: 100,
  totalIncidents: 0, openIncidents: 0,
  totalAlerts: 0, unresolvedAlerts: 0, activeUsers: 0,
  prevTotalVisits: 0, prevAvgResponseTime: 0, prevBounceRate: 0, prevUptime: 100,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodDays(p: Period): number {
  return p === '7d' ? 7 : p === '30d' ? 30 : p === '3m' ? 90 : 180;
}

function periodLabel(p: Period): string {
  return p === '7d' ? '7 derniers jours' : p === '30d' ? '30 derniers jours' : p === '3m' ? '3 derniers mois' : '6 derniers mois';
}

function isoFrom(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function pct(a: number, b: number): number {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${Math.round(n)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const severityColor: Record<string, string> = {
  critical: 'text-red-700 bg-red-100 border-red-200',
  high:     'text-orange-700 bg-orange-100 border-orange-200',
  medium:   'text-amber-700 bg-amber-100 border-amber-200',
  low:      'text-blue-700 bg-blue-100 border-blue-200',
};
const severityLabel: Record<string, string> = {
  critical: 'Critique', high: 'Élevé', medium: 'Moyen', low: 'Faible',
};
const statusColor: Record<string, string> = {
  resolved:     'text-emerald-700 bg-emerald-100',
  investigating:'text-amber-700 bg-amber-100',
  open:         'text-red-700 bg-red-100',
};
const statusLabel: Record<string, string> = {
  resolved: 'Résolu', investigating: 'En cours', open: 'Ouvert',
};
const categoryLabel: Record<string, string> = {
  service: 'Service', security: 'Sécurité', performance: 'Performance',
  database: 'Base de données', network: 'Réseau', backup: 'Sauvegarde',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Reports() {
  const [period, setPeriod]         = useState<Period>('30d');
  const [stats, setStats]           = useState<ReportStats>(EMPTY_STATS);
  const [traffic, setTraffic]       = useState<DailyTraffic[]>([]);
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetric[]>([]);
  const [incidents, setIncidents]   = useState<Incident[]>([]);
  const [alerts, setAlerts]         = useState<Alert[]>([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [error, setError]           = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (p: Period, showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    setError(null);

    const days     = periodDays(p);
    const prevDays = days * 2;
    const from     = isoFrom(days);
    const prevFrom = isoFrom(prevDays);
    const fromDate = from.split('T')[0];
    const prevDate = prevFrom.split('T')[0];

    try {
      const [
        { data: trafficData,   error: e1 },
        { data: prevTraffic,   error: e2 },
        { data: incidentData,  error: e3 },
        { data: alertData,     error: e4 },
        { data: perfData,      error: e5 },
        { data: userData,      error: e6 },
      ] = await Promise.all([
        supabase.from('daily_traffic').select('*')
          .gte('date', fromDate)
          .order('date', { ascending: true }),
        supabase.from('daily_traffic').select('total_visits,avg_response_time_ms,bounce_rate,uptime_pct')
          .gte('date', prevDate).lt('date', fromDate),
        supabase.from('incidents').select('*')
          .gte('started_at', from)
          .order('started_at', { ascending: false }),
        supabase.from('alerts').select('*')
          .gte('created_at', from)
          .order('created_at', { ascending: false }),
        supabase.from('performance_metrics').select('*')
          .gte('recorded_at', from)
          .order('recorded_at', { ascending: true }),
        supabase.from('server_logs').select('ip_address')
          .gte('created_at', from)
          .eq('category', 'access'),
      ]);

      const firstErr = e1 || e2 || e3 || e4 || e5 || e6;
      if (firstErr) throw new Error(firstErr.message);

      const cur  = (trafficData  ?? []) as DailyTraffic[];
      const prev = (prevTraffic  ?? []) as Partial<DailyTraffic>[];
      const inc  = (incidentData ?? []) as Incident[];
      const alr  = (alertData    ?? []) as Alert[];
      const perf = (perfData     ?? []) as PerformanceMetric[];
      const ips  = new Set((userData ?? []).map((r: { ip_address: string | null }) => r.ip_address).filter(Boolean));

      const sum = (arr: Partial<DailyTraffic>[], key: keyof DailyTraffic) =>
        arr.reduce((s, r) => s + Number(r[key] ?? 0), 0);
      const avg = (arr: Partial<DailyTraffic>[], key: keyof DailyTraffic) =>
        arr.length ? sum(arr, key) / arr.length : 0;

      setStats({
        totalVisits:        sum(cur,  'total_visits'),
        uniqueVisitors:     sum(cur,  'unique_visitors'),
        pageviews:          sum(cur,  'pageviews'),
        avgResponseTime:    avg(cur,  'avg_response_time_ms'),
        avgBounceRate:      avg(cur,  'bounce_rate'),
        avgUptime:          avg(cur,  'uptime_pct') || 100,
        totalIncidents:     inc.length,
        openIncidents:      inc.filter(i => i.status !== 'resolved').length,
        totalAlerts:        alr.length,
        unresolvedAlerts:   alr.filter(a => !a.resolved).length,
        activeUsers:        ips.size,
        prevTotalVisits:    sum(prev, 'total_visits'),
        prevAvgResponseTime:avg(prev, 'avg_response_time_ms'),
        prevBounceRate:     avg(prev, 'bounce_rate'),
        prevUptime:         avg(prev, 'uptime_pct') || 100,
      });

      setTraffic(cur);
      setPerfMetrics(perf);
      setIncidents(inc);
      setAlerts(alr);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(period, true);
  }, [period, fetchAll]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    channelRef.current?.unsubscribe();

    const channel = supabase
      .channel(`reports-realtime-${period}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_traffic' },
        () => { fetchAll(period); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' },
        () => { fetchAll(period); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' },
        () => { fetchAll(period); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_metrics' },
        () => { fetchAll(period); })
      .subscribe();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [period, fetchAll]);

  // ── Search filter ──────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filteredIncidents = incidents.filter(i =>
    i.title.toLowerCase().includes(q) ||
    (i.description ?? '').toLowerCase().includes(q) ||
    categoryLabel[i.category].toLowerCase().includes(q)
  );
  const filteredAlerts = alerts.filter(a =>
    a.message.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)
  );

  // ── Chart data ─────────────────────────────────────────────────────────────
  const trafficChartData = traffic.map(d => ({
    label: fmtDate(d.date),
    value: d.unique_visitors,
    value2: d.total_visits,
  }));

  const perfChartData = (() => {
    if (perfMetrics.length === 0) return [];
    const buckets: Record<string, { cpu: number[]; mem: number[] }> = {};
    perfMetrics.forEach(m => {
      const key = fmtDate(m.recorded_at);
      if (!buckets[key]) buckets[key] = { cpu: [], mem: [] };
      buckets[key].cpu.push(m.cpu_usage);
      buckets[key].mem.push(m.memory_usage);
    });
    return Object.entries(buckets).map(([label, v]) => ({
      label,
      value:  v.cpu.reduce((a, b) => a + b, 0) / v.cpu.length,
      value2: v.mem.reduce((a, b) => a + b, 0) / v.mem.length,
    }));
  })();

  const responseTimeData = traffic.map(d => ({
    label: fmtDate(d.date),
    value: d.avg_response_time_ms,
  }));

  const uptimeData = traffic.map(d => ({
    label: fmtDate(d.date),
    value: d.uptime_pct,
  }));

  // ── Alert breakdown ────────────────────────────────────────────────────────
  const alertByType = alerts.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const alertTypes = Object.entries(alertByType).sort((a, b) => b[1] - a[1]);
  const maxAlertCount = Math.max(...alertTypes.map(e => e[1]), 1);

  const incidentBySeverity = incidents.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── PDF Export ─────────────────────────────────────────────────────────────
  function exportPDF() {
    const w = window.open('', '_blank');
    if (!w) return;
    const now = formatDateTime(new Date().toISOString());
    w.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport – ${periodLabel(period)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; padding: 40px; font-size: 13px; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 15px; font-weight: 600; margin: 28px 0 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; color: #374151; }
  h3 { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #374151; }
  .meta { color: #6b7280; font-size: 11px; margin-bottom: 32px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }
  .kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
  .kpi-val { font-size: 22px; font-weight: 700; color: #111827; }
  .kpi-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .kpi-change { font-size: 11px; margin-top: 4px; }
  .pos { color: #059669; } .neg { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; }
  td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; color: #374151; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
  .badge-critical { background: #fee2e2; color: #b91c1c; }
  .badge-high     { background: #ffedd5; color: #c2410c; }
  .badge-medium   { background: #fef9c3; color: #a16207; }
  .badge-low      { background: #dbeafe; color: #1d4ed8; }
  .badge-resolved { background: #d1fae5; color: #065f46; }
  .badge-open     { background: #fee2e2; color: #b91c1c; }
  .badge-investigating { background: #fef9c3; color: #a16207; }
  .footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>Rapport d'Analyse – ${periodLabel(period)}</h1>
<p class="meta">Généré le ${now} · Web Server Manager</p>

<h2>Indicateurs clés de performance</h2>
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-val">${fmtNum(stats.totalVisits)}</div>
    <div class="kpi-label">Visites totales</div>
    ${stats.prevTotalVisits > 0 ? `<div class="kpi-change ${pct(stats.totalVisits, stats.prevTotalVisits) >= 0 ? 'pos' : 'neg'}">${pct(stats.totalVisits, stats.prevTotalVisits) >= 0 ? '▲' : '▼'} ${Math.abs(pct(stats.totalVisits, stats.prevTotalVisits)).toFixed(1)}% vs période préc.</div>` : ''}
  </div>
  <div class="kpi">
    <div class="kpi-val">${fmtNum(stats.uniqueVisitors)}</div>
    <div class="kpi-label">Visiteurs uniques</div>
  </div>
  <div class="kpi">
    <div class="kpi-val">${fmtNum(stats.pageviews)}</div>
    <div class="kpi-label">Pages vues</div>
  </div>
  <div class="kpi">
    <div class="kpi-val">${stats.avgResponseTime.toFixed(0)} ms</div>
    <div class="kpi-label">Temps de réponse moy.</div>
  </div>
  <div class="kpi">
    <div class="kpi-val">${stats.avgBounceRate.toFixed(1)}%</div>
    <div class="kpi-label">Taux de rebond</div>
  </div>
  <div class="kpi">
    <div class="kpi-val">${stats.avgUptime.toFixed(2)}%</div>
    <div class="kpi-label">Disponibilité</div>
  </div>
  <div class="kpi">
    <div class="kpi-val">${stats.totalIncidents}</div>
    <div class="kpi-label">Incidents (${stats.openIncidents} ouvert${stats.openIncidents > 1 ? 's' : ''})</div>
  </div>
  <div class="kpi">
    <div class="kpi-val">${stats.totalAlerts}</div>
    <div class="kpi-label">Alertes (${stats.unresolvedAlerts} actives)</div>
  </div>
</div>

<h2>Incidents (${incidents.length})</h2>
${incidents.length === 0 ? '<p style="color:#6b7280;font-size:12px">Aucun incident sur cette période.</p>' : `
<table>
<thead><tr><th>Titre</th><th>Sévérité</th><th>Statut</th><th>Catégorie</th><th>Début</th><th>Durée</th></tr></thead>
<tbody>
${incidents.map(i => `
<tr>
  <td>${i.title}</td>
  <td><span class="badge badge-${i.severity}">${severityLabel[i.severity]}</span></td>
  <td><span class="badge badge-${i.status}">${statusLabel[i.status]}</span></td>
  <td>${categoryLabel[i.category]}</td>
  <td>${fmtDateLong(i.started_at)}</td>
  <td>${i.duration_minutes ? i.duration_minutes + ' min' : '—'}</td>
</tr>`).join('')}
</tbody>
</table>`}

<h2>Alertes récentes (${alerts.length})</h2>
${alerts.length === 0 ? '<p style="color:#6b7280;font-size:12px">Aucune alerte sur cette période.</p>' : `
<table>
<thead><tr><th>Message</th><th>Type</th><th>Sévérité</th><th>Date</th><th>Statut</th></tr></thead>
<tbody>
${alerts.slice(0, 20).map(a => `
<tr>
  <td>${a.message}</td>
  <td style="text-transform:capitalize">${a.type}</td>
  <td><span class="badge badge-${a.severity}">${a.severity}</span></td>
  <td>${fmtDateLong(a.created_at)}</td>
  <td>${a.resolved ? '<span class="badge badge-resolved">Résolu</span>' : '<span class="badge badge-open">Actif</span>'}</td>
</tr>`).join('')}
</tbody>
</table>`}

<div class="footer">Web Server Manager · Rapport généré automatiquement · ${now}</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
    w.document.close();
  }

  // ─────────────────────────────────────────────────────────────────────────
  const hasTraffic = traffic.length > 0;

  return (
    <div className="p-6 space-y-6">

      {/* ── Top bar ── */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {/* Period tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['7d', '30d', '3m', '6m'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                period === p
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : p === '3m' ? '3 mois' : '6 mois'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Realtime indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Mis à jour {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchAll(period)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>

          {/* Export PDF */}
          <button
            onClick={exportPDF}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download size={13} />
            Exporter PDF
          </button>
        </div>
      </div>

      {/* Period label */}
      <p className="text-xs text-gray-400 -mt-2">
        Période : <span className="font-medium text-gray-600">{periodLabel(period)}</span>
      </p>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <WifiOff size={16} className="flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<Users size={18} className="text-blue-600" />}
              label="Visiteurs uniques"
              value={fmtNum(stats.uniqueVisitors)}
              change={pct(stats.totalVisits, stats.prevTotalVisits)}
              sub="visites totales"
              subValue={fmtNum(stats.totalVisits)}
              bg="bg-blue-50"
            />
            <KpiCard
              icon={<Globe size={18} className="text-emerald-600" />}
              label="Pages vues"
              value={fmtNum(stats.pageviews)}
              change={null}
              sub="taux de rebond"
              subValue={`${stats.avgBounceRate.toFixed(1)}%`}
              bg="bg-emerald-50"
            />
            <KpiCard
              icon={<Zap size={18} className="text-amber-600" />}
              label="Temps de réponse"
              value={`${stats.avgResponseTime.toFixed(0)} ms`}
              change={pct(stats.prevAvgResponseTime, stats.avgResponseTime)}
              sub="disponibilité"
              subValue={`${stats.avgUptime.toFixed(2)}%`}
              bg="bg-amber-50"
              invertChange
            />
            <KpiCard
              icon={<AlertTriangle size={18} className="text-red-500" />}
              label="Incidents"
              value={String(stats.totalIncidents)}
              change={null}
              sub={`${stats.openIncidents} ouvert${stats.openIncidents > 1 ? 's' : ''} · ${stats.totalAlerts} alertes`}
              subValue=""
              bg="bg-red-50"
            />
          </div>

          {/* ── Secondary KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniKpi label="Utilisateurs actifs" value={String(stats.activeUsers || 1)} icon={<Users size={14} className="text-blue-500" />} />
            <MiniKpi label="Alertes non résolues" value={String(stats.unresolvedAlerts)} icon={<AlertTriangle size={14} className="text-amber-500" />} />
            <MiniKpi label="Disponibilité" value={`${stats.avgUptime.toFixed(2)}%`} icon={<Activity size={14} className="text-emerald-500" />} />
            <MiniKpi label="Alertes sécurité" value={String(alerts.filter(a => a.type === 'security').length)} icon={<Shield size={14} className="text-red-500" />} />
          </div>

          {/* ── Charts row 1 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Traffic evolution */}
            <ChartCard
              title="Évolution du trafic"
              subtitle="Visiteurs uniques & visites totales"
              empty={!hasTraffic}
            >
              <LineChart
                data={trafficChartData}
                color="#3b82f6"
                color2="#93c5fd"
                label="Visiteurs uniques"
                label2="Visites totales"
                height={180}
              />
            </ChartCard>

            {/* System performance */}
            <ChartCard
              title="Performance système"
              subtitle="CPU & Mémoire moyens par jour"
              empty={perfChartData.length === 0}
            >
              <LineChart
                data={perfChartData}
                color="#10b981"
                color2="#8b5cf6"
                label="CPU %"
                label2="Mémoire %"
                unit="%"
                height={180}
              />
            </ChartCard>
          </div>

          {/* ── Charts row 2 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Response time */}
            <ChartCard title="Temps de réponse (ms)" subtitle="Moyenne journalière" empty={!hasTraffic}>
              <LineChart data={responseTimeData} color="#f97316" height={150} />
            </ChartCard>

            {/* Uptime */}
            <ChartCard title="Disponibilité (%)" subtitle="Taux de disponibilité par jour" empty={!hasTraffic}>
              <LineChart data={uptimeData} color="#10b981" height={150} />
            </ChartCard>
          </div>

          {/* ── Alert breakdown + Incident severity ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alert by type */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Répartition des alertes
                <span className="ml-2 text-xs font-normal text-gray-400">({alerts.length} total)</span>
              </h3>
              {alertTypes.length === 0 ? (
                <EmptyState label="Aucune alerte sur cette période" />
              ) : (
                <div className="space-y-3">
                  {alertTypes.map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-24 capitalize flex-shrink-0">{type}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(count / maxAlertCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-6 text-right flex-shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Incident by severity */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Incidents par sévérité
                <span className="ml-2 text-xs font-normal text-gray-400">({incidents.length} total)</span>
              </h3>
              {incidents.length === 0 ? (
                <EmptyState label="Aucun incident sur cette période" />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                    const n = incidentBySeverity[sev] ?? 0;
                    const colors: Record<string, string> = {
                      critical: 'bg-red-50 border-red-200',
                      high: 'bg-orange-50 border-orange-200',
                      medium: 'bg-amber-50 border-amber-200',
                      low: 'bg-blue-50 border-blue-200',
                    };
                    const textColors: Record<string, string> = {
                      critical: 'text-red-700', high: 'text-orange-700',
                      medium: 'text-amber-700', low: 'text-blue-700',
                    };
                    return (
                      <div key={sev} className={`p-4 rounded-lg border ${colors[sev]}`}>
                        <p className={`text-2xl font-bold ${textColors[sev]}`}>{n}</p>
                        <p className={`text-xs font-medium mt-0.5 ${textColors[sev]}`}>{severityLabel[sev]}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Incidents history ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Activity size={18} className="text-red-500" />
                <h3 className="font-semibold text-gray-900">
                  Historique des incidents
                  {search && <span className="ml-2 text-xs font-normal text-gray-400">({filteredIncidents.length} résultat{filteredIncidents.length > 1 ? 's' : ''})</span>}
                </h3>
              </div>
            </div>
            {filteredIncidents.length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle size={36} className="mx-auto mb-3 text-emerald-400 opacity-50" />
                <p className="text-sm font-medium text-gray-600">Aucun incident sur cette période</p>
                <p className="text-xs text-gray-400 mt-1">{search ? 'Essayez une autre recherche' : 'Le serveur a fonctionné sans incident'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Titre</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Sévérité</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Statut</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Catégorie</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Début</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Durée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredIncidents.map(inc => (
                      <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{inc.title}</p>
                          {inc.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{inc.description}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor[inc.severity]}`}>
                            {severityLabel[inc.severity]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[inc.status]}`}>
                            {inc.status === 'resolved' && <CheckCircle size={10} />}
                            {inc.status === 'open' && <XCircle size={10} />}
                            {inc.status === 'investigating' && <Loader2 size={10} className="animate-spin" />}
                            {statusLabel[inc.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-gray-500">{categoryLabel[inc.category]}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={10} />{fmtDateLong(inc.started_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-gray-500">
                            {inc.duration_minutes ? `${inc.duration_minutes} min` : inc.status !== 'resolved' ? '— En cours' : '< 1 min'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Recent alerts ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="text-amber-500" />
                <h3 className="font-semibold text-gray-900">
                  Alertes de la période
                  {search && <span className="ml-2 text-xs font-normal text-gray-400">({filteredAlerts.length} résultat{filteredAlerts.length > 1 ? 's' : ''})</span>}
                </h3>
              </div>
            </div>
            {filteredAlerts.length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle size={36} className="mx-auto mb-3 text-emerald-400 opacity-50" />
                <p className="text-sm font-medium text-gray-600">Aucune alerte sur cette période</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredAlerts.slice(0, 10).map(alert => (
                  <div key={alert.id} className="flex items-start gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
                    <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor[alert.severity]}`}>
                      {alert.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">{alert.type}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {alert.resolved
                        ? <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Résolu</span>
                        : <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Actif</span>}
                      <span className="text-xs text-gray-400 hidden sm:block">{fmtDateLong(alert.created_at)}</span>
                    </div>
                  </div>
                ))}
                {filteredAlerts.length > 10 && (
                  <p className="text-xs text-gray-400 text-center py-3">
                    + {filteredAlerts.length - 10} alerte{filteredAlerts.length - 10 > 1 ? 's' : ''} supplémentaire{filteredAlerts.length - 10 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: number | null;
  sub: string;
  subValue: string;
  bg: string;
  invertChange?: boolean;
}

function KpiCard({ icon, label, value, change, sub, subValue, bg, invertChange }: KpiCardProps) {
  const positive = invertChange ? (change !== null && change <= 0) : (change !== null && change >= 0);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
      {change !== null && (
        <p className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
          {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs période préc.
        </p>
      )}
      {subValue && (
        <p className="text-xs text-gray-400 mt-1">{subValue} <span className="text-gray-300">{sub}</span></p>
      )}
      {!subValue && sub && (
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      )}
    </div>
  );
}

function MiniKpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
      <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="text-base font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  empty: boolean;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, empty, children }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {empty ? <EmptyState label="Aucune donnée disponible" /> : children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-300">
      <BarChart3 size={32} className="mb-2" />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-32">
            <div className="w-9 h-9 bg-gray-100 rounded-lg mb-3" />
            <div className="h-6 bg-gray-100 rounded w-20 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-64">
            <div className="h-4 bg-gray-100 rounded w-40 mb-6" />
            <div className="h-40 bg-gray-50 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
