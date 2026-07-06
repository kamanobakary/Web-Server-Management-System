import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Square, RefreshCw, Activity, Cpu, MemoryStick, HardDrive,
  Network, Users, Globe, Clock, AlertTriangle, TrendingUp, Zap, Wifi,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ServerConfig, PerformanceMetric, Alert } from '../lib/supabase';
import { formatUptime, timeAgo } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';
import GaugeChart from '../components/GaugeChart';
import LineChart from '../components/LineChart';
import MiniChart from '../components/MiniChart';

interface DashboardProps {
  onRefreshTrigger: number;
}

interface LiveMetrics {
  cpu: number;
  memory: number;
  disk: number;
  networkIn: number;
  networkOut: number;
  connections: number;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function Dashboard({ onRefreshTrigger }: DashboardProps) {
  const [server, setServer]       = useState<ServerConfig | null>(null);
  const [metrics, setMetrics]     = useState<PerformanceMetric[]>([]);
  const [alerts, setAlerts]       = useState<Alert[]>([]);
  const [isChanging, setIsChanging] = useState(false);
  const [uptimeCounter, setUptimeCounter] = useState(0);
  const [live, setLive] = useState<LiveMetrics>({
    cpu: 42, memory: 61, disk: 68, networkIn: 245, networkOut: 128, connections: 87,
  });
  const [cpuHistory,    setCpuHistory]    = useState<number[]>([35,40,38,55,72,68,59,45,42,50,63,58]);
  const [memHistory,    setMemHistory]    = useState<number[]>([55,58,60,62,65,63,61,59,60,62,64,61]);
  const [netInHistory,  setNetInHistory]  = useState<number[]>([120,180,240,310,280,245,220,260,300,245,210,245]);
  const [netOutHistory, setNetOutHistory] = useState<number[]>([80,100,130,160,145,128,110,135,150,128,115,128]);
  const [connHistory,   setConnHistory]   = useState<number[]>([70,75,82,90,85,87,92,88,84,87,90,87]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const metricTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── initial load ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [{ data: srv }, { data: met }, { data: alr }] = await Promise.all([
      supabase.from('server_config').select('*').maybeSingle(),
      supabase.from('performance_metrics').select('*').order('recorded_at', { ascending: true }).limit(48),
      supabase.from('alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }),
    ]);
    if (srv) setServer(srv as ServerConfig);
    if (met) {
      setMetrics(met as PerformanceMetric[]);
      // seed live from most recent metric
      const last = (met as PerformanceMetric[]).at(-1);
      if (last) {
        setLive(prev => ({
          ...prev,
          cpu: last.cpu_usage,
          memory: last.memory_usage,
          disk: last.disk_usage,
          networkIn: last.network_in,
          networkOut: last.network_out,
          connections: last.active_connections,
        }));
      }
    }
    if (alr) setAlerts(alr as Alert[]);
  }, []);

  useEffect(() => { loadData(); }, [loadData, onRefreshTrigger]);

  // ── supabase realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    channelRef.current?.unsubscribe();
    const ch = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_config' }, payload => {
        if (payload.new) setServer(payload.new as ServerConfig);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'performance_metrics' }, payload => {
        const m = payload.new as PerformanceMetric;
        setMetrics(prev => [...prev.slice(-47), m]);
        setLive(prev => ({
          ...prev,
          cpu:         m.cpu_usage,
          memory:      m.memory_usage,
          disk:        m.disk_usage,
          networkIn:   m.network_in,
          networkOut:  m.network_out,
          connections: m.active_connections,
        }));
        setCpuHistory(h  => [...h.slice(-11), m.cpu_usage]);
        setMemHistory(h  => [...h.slice(-11), m.memory_usage]);
        setNetInHistory(h  => [...h.slice(-11), m.network_in]);
        setNetOutHistory(h => [...h.slice(-11), m.network_out]);
        setConnHistory(h   => [...h.slice(-11), m.active_connections]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => { loadData(); })
      .subscribe();
    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [loadData]);

  // ── live metric simulation + DB write every 30s ───────────────────────────
  useEffect(() => {
    // Fast UI tick (5s) – update sparklines
    const uiTick = setInterval(() => {
      setLive(prev => {
        const cpu  = clamp(prev.cpu  + rand(-6, 6),  5, 95);
        const mem  = clamp(prev.memory + rand(-2, 2), 40, 90);
        const ni   = clamp(prev.networkIn  + rand(-30, 30), 50, 800);
        const no_  = clamp(prev.networkOut + rand(-20, 20), 20, 400);
        const conn = clamp(prev.connections + rand(-5, 5), 20, 250);
        setCpuHistory(h    => [...h.slice(-11), cpu]);
        setMemHistory(h    => [...h.slice(-11), mem]);
        setNetInHistory(h  => [...h.slice(-11), ni]);
        setNetOutHistory(h => [...h.slice(-11), no_]);
        setConnHistory(h   => [...h.slice(-11), conn]);
        return { ...prev, cpu, memory: mem, networkIn: ni, networkOut: no_, connections: Math.round(conn) };
      });
      setUptimeCounter(c => c + 5);
    }, 5000);

    // Slow DB write (60s) – persist a real metric row
    metricTimerRef.current = setInterval(async () => {
      setLive(current => {
        supabase.from('performance_metrics').insert({
          cpu_usage:         Math.round(current.cpu),
          memory_usage:      Math.round(current.memory),
          disk_usage:        current.disk,
          network_in:        Math.round(current.networkIn),
          network_out:       Math.round(current.networkOut),
          active_connections: current.connections,
        });
        return current;
      });
    }, 60000);

    return () => {
      clearInterval(uiTick);
      if (metricTimerRef.current) clearInterval(metricTimerRef.current);
    };
  }, []);

  // ── server actions ────────────────────────────────────────────────────────
  async function handleServerAction(action: 'start' | 'stop' | 'restart') {
    if (!server || isChanging) return;
    setIsChanging(true);
    const statusMap: Record<string, string> = { start: 'running', stop: 'stopped', restart: 'restarting' };
    const newStatus = statusMap[action] as ServerConfig['status'];

    await Promise.all([
      supabase.from('server_config').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', server.id),
      supabase.from('server_logs').insert({
        level: 'info', category: 'system',
        message: `Server ${action} triggered by ABOU KAMANO`,
        ip_address: '192.168.1.10',
      }),
    ]);
    setServer(s => s ? { ...s, status: newStatus } : s);

    if (action === 'restart') {
      setTimeout(async () => {
        await supabase.from('server_config').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', server.id);
        setServer(s => s ? { ...s, status: 'running' } : s);
        setIsChanging(false);
      }, 4000);
    } else {
      setIsChanging(false);
    }
  }

  // ── chart data ────────────────────────────────────────────────────────────
  const chartData = metrics.map(m => ({
    label: new Date(m.recorded_at).getHours() + 'h',
    value: m.cpu_usage,
    value2: m.memory_usage,
  }));

  const networkData = metrics.map(m => ({
    label: new Date(m.recorded_at).getHours() + 'h',
    value: m.network_in,
    value2: m.network_out,
  }));

  const isRunning = server?.status === 'running';
  const isStopped = server?.status === 'stopped';
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');

  return (
    <div className="p-6 space-y-6">

      {/* Critical alert banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {criticalAlerts.length} alerte{criticalAlerts.length > 1 ? 's' : ''} critique{criticalAlerts.length > 1 ? 's' : ''} nécessitent votre attention
            </p>
            <p className="text-xs text-red-600 mt-0.5">{criticalAlerts[0]?.message}</p>
          </div>
        </div>
      )}

      {/* Server control panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Activity size={22} className="text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{server?.name ?? '—'}</h2>
                {server && <StatusBadge status={server.status} pulse />}
                <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <Wifi size={10} /> Realtime
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {server?.host} · Port {server?.port} ·{' '}
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} />
                  Uptime : {formatUptime((server?.uptime_seconds ?? 0) + uptimeCounter)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => handleServerAction('start')} disabled={isRunning || isChanging}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
              <Play size={14} /> Démarrer
            </button>
            <button onClick={() => handleServerAction('stop')} disabled={isStopped || isChanging}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
              <Square size={14} /> Arrêter
            </button>
            <button onClick={() => handleServerAction('restart')} disabled={isChanging}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
              <RefreshCw size={14} className={server?.status === 'restarting' ? 'animate-spin' : ''} />
              Redémarrer
            </button>
          </div>
        </div>
      </div>

      {/* Live metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard icon={<Cpu size={15} className="text-blue-600" />}    label="CPU"         value={live.cpu}         history={cpuHistory}    color="#3b82f6" unit="%" />
        <MetricCard icon={<MemoryStick size={15} className="text-violet-500" />} label="Mémoire" value={live.memory}  history={memHistory}    color="#8b5cf6" unit="%" />
        <MetricCard icon={<HardDrive size={15} className="text-emerald-600" />}  label="Disque"  value={live.disk}    history={[65,65.5,66,66.5,67,67.2,67.5,67.8,68,68.1,68.2,68]} color="#10b981" unit="%" isStatic />
        <MetricCard icon={<Network size={15} className="text-cyan-600" />}  label="Net. In"   value={live.networkIn}  history={netInHistory}  color="#06b6d4" unit=" MB" noGauge />
        <MetricCard icon={<Network size={15} className="text-amber-600" />} label="Net. Out"  value={live.networkOut} history={netOutHistory} color="#f59e0b" unit=" MB" noGauge />
        <MetricCard icon={<Users size={15} className="text-pink-600" />}    label="Connexions" value={live.connections} history={connHistory} color="#ec4899" unit="" noGauge integer />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">CPU & Mémoire (historique)</h3>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">{metrics.length} points</span>
          </div>
          <LineChart
            data={chartData.length >= 2 ? chartData : Array.from({ length: 12 }, (_, i) => ({ label: `${i}h`, value: cpuHistory[i] ?? 50, value2: memHistory[i] ?? 60 }))}
            color="#3b82f6" color2="#8b5cf6" label="CPU" label2="Mémoire" unit="%" height={160}
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Trafic réseau (historique)</h3>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">MB/s</span>
          </div>
          <LineChart
            data={networkData.length >= 2 ? networkData : Array.from({ length: 12 }, (_, i) => ({ label: `${i}h`, value: netInHistory[i] ?? 200, value2: netOutHistory[i] ?? 100 }))}
            color="#10b981" color2="#f59e0b" label="Entrant" label2="Sortant" height={160}
          />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Globe size={20} className="text-blue-500" />}     label="Sites actifs"    value="6"     sub="sur 7 hébergés"  color="blue" />
        <StatCard icon={<Users size={20} className="text-emerald-500" />}  label="Utilisateurs"    value="1"     sub="administrateur"  color="emerald" />
        <StatCard icon={<TrendingUp size={20} className="text-amber-500" />} label="Trafic mensuel" value="3.47M" sub="visites ce mois" color="amber" />
        <StatCard icon={<Zap size={20} className="text-red-500" />}        label="Alertes actives" value={String(alerts.length)} sub={`${criticalAlerts.length} critique${criticalAlerts.length > 1 ? 's' : ''}`} color="red" />
      </div>

      {/* Recent alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">Alertes actives</h3>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Temps réel" />
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 5).map(alert => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────────
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  history: number[];
  color: string;
  unit: string;
  isStatic?: boolean;
  noGauge?: boolean;
  integer?: boolean;
}

function MetricCard({ icon, label, value, history, color, unit, isStatic, noGauge, integer }: MetricCardProps) {
  const display = integer ? Math.round(value).toString() : value.toFixed(1);
  const pct = noGauge ? null : value;
  const getColor = (v: number) => v >= 90 ? 'text-red-600' : v >= 75 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium text-gray-500 truncate">{label}</span>
        </div>
        {!isStatic && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />}
      </div>
      <p className={`text-xl font-bold mb-1 ${noGauge ? 'text-gray-900' : getColor(value)}`}>
        {display}{unit}
      </p>
      <MiniChart data={history} color={color} height={28} />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: 'blue' | 'emerald' | 'amber' | 'red';
}
const colorMap = { blue: 'bg-blue-50', emerald: 'bg-emerald-50', amber: 'bg-amber-50', red: 'bg-red-50' };
function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`w-10 h-10 ${colorMap[color]} rounded-lg flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const colors: Record<string, string> = {
    critical: 'text-red-600 bg-red-50 border-red-100',
    warning:  'text-amber-600 bg-amber-50 border-amber-100',
    info:     'text-blue-600 bg-blue-50 border-blue-100',
  };
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${colors[alert.severity]}`}>
      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{alert.message}</p>
        <p className="text-xs opacity-70 mt-0.5">{timeAgo(alert.created_at)}</p>
      </div>
    </div>
  );
}
