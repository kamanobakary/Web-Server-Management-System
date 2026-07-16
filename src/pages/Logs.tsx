import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Filter, Trash2, Download, Terminal, AlertTriangle,
  Info, CheckCircle, Bug, Wifi, WifiOff, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ServerLog, LogLevel, LogCategory } from '../lib/supabase';
import { formatDateTime } from '../lib/utils';
import { cn } from '../lib/utils';

interface LogsProps {
  onRefreshTrigger: number;
}

const levelConfig: Record<LogLevel, {
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  info:    { icon: Info,          color: 'text-blue-400',    bg: 'bg-blue-950/30',    border: 'border-blue-900/50',    label: 'Info'    },
  success: { icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-900/50', label: 'Succès'  },
  warning: { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-950/30',   border: 'border-amber-900/50',   label: 'Attention'},
  error:   { icon: AlertTriangle, color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-900/50',     label: 'Erreur'  },
  debug:   { icon: Bug,           color: 'text-gray-500',    bg: 'bg-gray-900/30',    border: 'border-gray-800',       label: 'Debug'   },
};

const categoryLabels: Record<LogCategory, string> = {
  system: 'Système', access: 'Accès', error: 'Erreur', security: 'Sécurité', backup: 'Sauvegarde',
};

// Simulated log messages for live generation
const LIVE_LOG_POOL: Array<{ level: LogLevel; category: LogCategory; message: string; ip?: string }> = [
  { level: 'info',    category: 'access',   message: 'GET /api/status - 200 OK (8ms)',           ip: '10.0.0.5'     },
  { level: 'info',    category: 'access',   message: 'GET /api/websites - 200 OK (14ms)',         ip: '10.0.0.8'     },
  { level: 'info',    category: 'system',   message: 'Health check passed – all services up',     ip: '127.0.0.1'    },
  { level: 'success', category: 'access',   message: 'POST /api/auth/login - 200 OK (76ms)',      ip: '192.168.1.20' },
  { level: 'info',    category: 'access',   message: 'DELETE /api/sessions/old - 200 OK (22ms)',  ip: '10.0.0.5'     },
  { level: 'info',    category: 'system',   message: 'Nginx worker recycled (memory limit)',       ip: '127.0.0.1'    },
  { level: 'warning', category: 'system',   message: 'Response time spike detected: 410ms avg',   ip: '127.0.0.1'    },
  { level: 'info',    category: 'access',   message: 'GET /api/metrics - 200 OK (11ms)',           ip: '10.0.0.5'     },
  { level: 'warning', category: 'security', message: 'Suspicious request pattern – rate limited', ip: '203.0.113.42' },
  { level: 'success', category: 'backup',   message: 'Incremental snapshot written to /tmp',      ip: '127.0.0.1'    },
  { level: 'error',   category: 'error',    message: 'Upstream connect error – retry 1/3',        ip: '127.0.0.1'    },
  { level: 'info',    category: 'system',   message: 'Log rotation completed – 7 files archived', ip: '127.0.0.1'    },
];

export default function Logs({ onRefreshTrigger }: LogsProps) {
  const [logs, setLogs]                 = useState<ServerLog[]>([]);
  const [search, setSearch]             = useState('');
  const [filterLevel, setFilterLevel]   = useState<'all' | LogLevel>('all');
  const [filterCat, setFilterCat]       = useState<'all' | LogCategory>('all');
  const [loading, setLoading]           = useState(true);
  const [liveMode, setLiveMode]         = useState(true);
  const [connected, setConnected]       = useState(false);
  const [newCount, setNewCount]         = useState(0);
  const [showFilters, setShowFilters]   = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── initial load ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('server_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (data) setLogs(data as ServerLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, onRefreshTrigger]);

  // ── supabase realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    channelRef.current?.unsubscribe();

    const ch = supabase.channel('logs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'server_logs' }, payload => {
        const entry = payload.new as ServerLog;
        setLogs(prev => [entry, ...prev.slice(0, 299)]);
        setNewCount(n => n + 1);
      })
      .subscribe(status => {
        setConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = ch;
    return () => { ch.unsubscribe(); setConnected(false); };
  }, []);

  // ── live log generator ─────────────────────────────────────────────────────
  useEffect(() => {
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    if (!liveMode) return;

    liveTimerRef.current = setInterval(async () => {
      const pick = LIVE_LOG_POOL[Math.floor(Math.random() * LIVE_LOG_POOL.length)];
      await supabase.from('server_logs').insert({
        level:      pick.level,
        category:   pick.category,
        message:    pick.message,
        ip_address: pick.ip ?? null,
        user_agent: null,
      });
    }, 8000);

    return () => { if (liveTimerRef.current) clearInterval(liveTimerRef.current); };
  }, [liveMode]);

  // ── filters ───────────────────────────────────────────────────────────────
  const filtered = logs.filter(l => {
    const matchSearch = l.message.toLowerCase().includes(search.toLowerCase()) ||
      (l.ip_address ?? '').includes(search);
    const matchLevel = filterLevel === 'all' || l.level === filterLevel;
    const matchCat   = filterCat   === 'all' || l.category === filterCat;
    return matchSearch && matchLevel && matchCat;
  });

  const levelCounts = logs.reduce((acc, l) => {
    acc[l.level] = (acc[l.level] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── actions ───────────────────────────────────────────────────────────────
  async function clearLogs() {
    if (!confirm('Supprimer tous les journaux ?')) return;
    await supabase.from('server_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setLogs([]);
  }

  function downloadLogs() {
    const content = filtered.map(l =>
      `[${l.created_at}] [${l.level.toUpperCase().padEnd(7)}] [${categoryLabels[l.category].padEnd(10)}] ${l.message}${l.ip_address ? `  (${l.ip_address})` : ''}`
    ).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `server-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleNewCountClick() {
    setNewCount(0);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="p-6 space-y-4">
      {/* Level summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(['info', 'success', 'warning', 'error', 'debug'] as LogLevel[]).map(level => {
          const cfg  = levelConfig[level];
          const Icon = cfg.icon;
          const active = filterLevel === level;
          return (
            <button
              key={level}
              onClick={() => setFilterLevel(active ? 'all' : level)}
              className={cn(
                'flex items-center gap-2 p-3 rounded-xl border transition-all text-left',
                active ? `${cfg.bg} ${cfg.border} border` : 'bg-white border-gray-200 hover:bg-gray-50'
              )}
            >
              <Icon size={14} className={active ? cfg.color : 'text-gray-400'} />
              <div>
                <p className={cn('text-sm font-bold', active ? cfg.color : 'text-gray-900')}>
                  {levelCounts[level] ?? 0}
                </p>
                <p className="text-xs text-gray-500">{cfg.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="flex-1 min-w-48 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher dans les journaux..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category filter */}
        <div className="relative">
          <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value as 'all' | LogCategory)}
            className="pl-8 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
          >
            <option value="all">Toutes catégories</option>
            {(Object.keys(categoryLabels) as LogCategory[]).map(c => (
              <option key={c} value={c}>{categoryLabels[c]}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Live mode toggle */}
        <button
          onClick={() => setLiveMode(m => !m)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors',
            liveMode
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          )}
        >
          {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span className="hidden sm:inline">Temps réel</span>
          {liveMode && connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
        </button>

        <button onClick={downloadLogs}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          <Download size={13} /> Exporter
        </button>

        <button onClick={clearLogs}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 text-sm text-red-700 rounded-lg hover:bg-red-100 transition-colors">
          <Trash2 size={13} /> Vider
        </button>
      </div>

      {/* New entries notification */}
      {newCount > 0 && (
        <button
          onClick={handleNewCountClick}
          className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          {newCount} nouvelle{newCount > 1 ? 's' : ''} entrée{newCount > 1 ? 's' : ''} — Cliquez pour aller en bas
        </button>
      )}

      {/* Terminal */}
      <div className="bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
        {/* Terminal title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <div className="flex items-center gap-2">
              <Terminal size={13} className="text-gray-500" />
              <span className="text-xs text-gray-400 font-mono">/var/log/nginx/server.log</span>
              {liveMode && connected && (
                <span className="flex items-center gap-1 text-xs text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-gray-600 font-mono">{filtered.length} entrées</span>
        </div>

        {/* Log entries */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[600px] font-mono text-xs" id="log-viewport">
            {filtered.length === 0 && (
              <p className="text-gray-600 p-8 text-center">Aucun journal correspondant aux filtres</p>
            )}
            {filtered.map((log, idx) => {
              const cfg  = levelConfig[log.level];
              const isNew = idx === 0 && newCount > 0;
              return (
                <div
                  key={log.id}
                  className={cn(
                    'flex items-start gap-0 border-b border-gray-900 hover:bg-gray-900/50 transition-colors group',
                    isNew && 'animate-pulse-once',
                    log.level === 'error'   && 'bg-red-950/20',
                    log.level === 'warning' && 'bg-amber-950/10',
                    log.level === 'success' && 'bg-emerald-950/10',
                  )}
                >
                  {/* Timestamp */}
                  <span className="text-gray-700 px-3 py-2 flex-shrink-0 w-44 hidden lg:block border-r border-gray-900 text-right">
                    {formatDateTime(log.created_at)}
                  </span>
                  {/* Level */}
                  <span className={cn('px-3 py-2 flex-shrink-0 font-bold uppercase w-20 text-right hidden sm:block border-r border-gray-900', cfg.color)}>
                    {log.level}
                  </span>
                  {/* Category */}
                  <span className="text-gray-600 px-3 py-2 flex-shrink-0 w-24 hidden md:block border-r border-gray-900">
                    [{categoryLabels[log.category]}]
                  </span>
                  {/* Message */}
                  <span className="text-gray-200 px-3 py-2 flex-1 break-all">
                    {/* Sm: show level inline */}
                    <span className={cn('sm:hidden font-bold mr-2 uppercase', cfg.color)}>[{log.level}]</span>
                    {log.message}
                  </span>
                  {/* IP */}
                  {log.ip_address && (
                    <span className="text-gray-600 px-3 py-2 flex-shrink-0 hidden xl:block border-l border-gray-900 w-32 text-right">
                      {log.ip_address}
                    </span>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
