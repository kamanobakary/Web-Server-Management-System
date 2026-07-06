import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Bell, CheckCircle, X, Shield, Cpu, MemoryStick, HardDrive, Network, HardDrive as BackupIcon, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Alert, AlertType, AlertSeverity } from '../lib/supabase';
import { timeAgo } from '../lib/utils';
import { cn } from '../lib/utils';

interface AlertsPageProps {
  onRefreshTrigger: number;
  onAlertsChange: (count: number) => void;
}

const typeIcons: Record<AlertType, React.ComponentType<{ size?: number; className?: string }>> = {
  cpu: Cpu,
  memory: MemoryStick,
  disk: HardDrive,
  network: Network,
  security: Shield,
  service: Globe,
  backup: BackupIcon,
};

const typeLabels: Record<AlertType, string> = {
  cpu: 'CPU',
  memory: 'Mémoire',
  disk: 'Disque',
  network: 'Réseau',
  security: 'Sécurité',
  service: 'Service',
  backup: 'Sauvegarde',
};

const severityConfig: Record<AlertSeverity, { label: string; color: string; border: string; bg: string; dot: string }> = {
  critical: { label: 'Critique', color: 'text-red-700', border: 'border-red-200', bg: 'bg-red-50', dot: 'bg-red-500' },
  warning: { label: 'Attention', color: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  info: { label: 'Info', color: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50', dot: 'bg-blue-500' },
};

export default function AlertsPage({ onRefreshTrigger, onAlertsChange }: AlertsPageProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('alerts').select('*').order('created_at', { ascending: false });
    if (data) {
      setAlerts(data);
      onAlertsChange(data.filter((a) => !a.resolved).length);
    }
    setLoading(false);
  }, [onAlertsChange]);

  useEffect(() => { load(); }, [load, onRefreshTrigger]);

  async function resolveAlert(id: string) {
    await supabase.from('alerts').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', id);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a));
    onAlertsChange(alerts.filter((a) => !a.resolved && a.id !== id).length);
  }

  async function resolveAll() {
    const now = new Date().toISOString();
    await supabase.from('alerts').update({ resolved: true, resolved_at: now }).eq('resolved', false);
    setAlerts((prev) => prev.map((a) => ({ ...a, resolved: true, resolved_at: now })));
    onAlertsChange(0);
  }

  async function deleteAlert(id: string) {
    await supabase.from('alerts').delete().eq('id', id);
    const updated = alerts.filter((a) => a.id !== id);
    setAlerts(updated);
    onAlertsChange(updated.filter((a) => !a.resolved).length);
  }

  const visible = alerts.filter((a) => showResolved || !a.resolved);
  const unresolved = alerts.filter((a) => !a.resolved);
  const criticalCount = unresolved.filter((a) => a.severity === 'critical').length;
  const warningCount = unresolved.filter((a) => a.severity === 'warning').length;

  return (
    <div className="p-6 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
          <p className="text-sm font-medium text-red-600">Alertes critiques</p>
          <p className="text-xs text-red-400 mt-0.5">Action immédiate requise</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-700">{warningCount}</p>
          <p className="text-sm font-medium text-amber-600">Avertissements</p>
          <p className="text-xs text-amber-400 mt-0.5">Surveiller de près</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-700">{alerts.filter((a) => a.resolved).length}</p>
          <p className="text-sm font-medium text-emerald-600">Résolues</p>
          <p className="text-xs text-emerald-400 mt-0.5">Incidents fermés</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="rounded" />
            Afficher les alertes résolues
          </label>
        </div>
        {unresolved.length > 0 && (
          <button
            onClick={resolveAll}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <CheckCircle size={14} />
            Tout résoudre ({unresolved.length})
          </button>
        )}
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {visible.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400 opacity-50" />
              <p className="text-sm font-medium text-gray-600">Aucune alerte active</p>
              <p className="text-xs text-gray-400 mt-1">Le serveur fonctionne normalement</p>
            </div>
          )}
          {visible.map((alert) => {
            const cfg = severityConfig[alert.severity];
            const Icon = typeIcons[alert.type];
            return (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-xl border transition-all',
                  alert.resolved ? 'bg-gray-50 border-gray-200 opacity-60' : `${cfg.bg} ${cfg.border}`
                )}
              >
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', alert.resolved ? 'bg-gray-200' : cfg.bg)}>
                  <Icon size={16} className={alert.resolved ? 'text-gray-500' : cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', alert.resolved ? 'bg-gray-200 text-gray-600' : `${cfg.bg} ${cfg.color} border ${cfg.border}`)}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-gray-500 bg-white/70 px-2 py-0.5 rounded-full border border-gray-200">
                      {typeLabels[alert.type]}
                    </span>
                    {alert.resolved && (
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle size={10} /> Résolu
                      </span>
                    )}
                  </div>
                  <p className={cn('text-sm font-medium', alert.resolved ? 'text-gray-600' : cfg.color)}>{alert.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-gray-400">{timeAgo(alert.created_at)}</p>
                    {alert.resolved && alert.resolved_at && (
                      <p className="text-xs text-gray-400">Résolu {timeAgo(alert.resolved_at)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!alert.resolved && (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <CheckCircle size={12} />
                      Résoudre
                    </button>
                  )}
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
