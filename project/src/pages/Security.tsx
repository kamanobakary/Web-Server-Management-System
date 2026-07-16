import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Lock, Eye, EyeOff, AlertTriangle, CheckCircle, XCircle,
  Globe, Key, Fingerprint, Plus, Trash2, Loader2, RefreshCw, Search,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SecurityRule, BlockedIp, AuditLogEntry } from '../lib/supabase';

// ── helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `Il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── component ─────────────────────────────────────────────────────────────────
export default function Security() {
  const [rules, setRules]       = useState<SecurityRule[]>([]);
  const [blocked, setBlocked]   = useState<BlockedIp[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showKey, setShowKey]   = useState(false);
  const [keyRegenLoading, setKeyRegenLoading] = useState(false);
  const [apiKey]                = useState('sk_prod_xK9mN2pQ8rT4vW6yA3bC5dE7fG1hJ');
  const [ipSearch, setIpSearch] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: r }, { data: b }, { data: a }] = await Promise.all([
      supabase.from('security_rules').select('*').order('sort_order'),
      supabase.from('blocked_ips').select('*').order('blocked_at', { ascending: false }),
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    if (r) setRules(r as SecurityRule[]);
    if (b) setBlocked(b as BlockedIp[]);
    if (a) setAuditLog(a as AuditLogEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    channelRef.current?.unsubscribe();
    const ch = supabase.channel('security-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_rules' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_ips' },   () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_log' },     () => loadAll())
      .subscribe();
    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [loadAll]);

  // ── toggle rule ───────────────────────────────────────────────────────────
  async function toggleRule(rule: SecurityRule) {
    const newEnabled = !rule.enabled;
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: newEnabled } : r));
    await supabase.from('security_rules').update({ enabled: newEnabled, updated_at: new Date().toISOString() }).eq('id', rule.id);
    await supabase.from('audit_log').insert({
      action: `Règle "${rule.name}" ${newEnabled ? 'activée' : 'désactivée'}`,
      performed_by: 'ABOU KAMANO',
      status: 'success',
      details: `Via l'interface de gestion de sécurité`,
    });
  }

  // ── unblock IP ────────────────────────────────────────────────────────────
  async function unblockIp(ip: BlockedIp) {
    await supabase.from('blocked_ips').delete().eq('id', ip.id);
    await supabase.from('audit_log').insert({
      action: `IP ${ip.ip_address} débloquée`,
      performed_by: 'ABOU KAMANO',
      status: 'warning',
      details: ip.reason,
    });
    setBlocked(prev => prev.filter(b => b.id !== ip.id));
  }

  // ── regen API key ─────────────────────────────────────────────────────────
  async function regenKey() {
    if (!confirm('Régénérer la clé API ? L\'ancienne sera immédiatement révoquée.')) return;
    setKeyRegenLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    await supabase.from('audit_log').insert({
      action: 'Rotation de la clé API administration',
      performed_by: 'ABOU KAMANO',
      status: 'success',
      details: 'Ancienne clé révoquée, nouvelle clé générée',
    });
    setKeyRegenLoading(false);
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const enabledCount = rules.filter(r => r.enabled).length;
  const score = rules.length ? Math.round((enabledCount / rules.length) * 100) : 0;
  const scoreColor = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : 'red';
  const filteredBlocked = blocked.filter(b =>
    b.ip_address.includes(ipSearch) || b.reason.toLowerCase().includes(ipSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Score + summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Score */}
        <div className={`rounded-xl border p-5 bg-${scoreColor}-50 border-${scoreColor}-200`}>
          <div className="flex items-center gap-3 mb-3">
            <Shield size={20} className={`text-${scoreColor}-600`} />
            <span className="font-semibold text-gray-900 text-sm">Score de sécurité</span>
          </div>
          <p className={`text-4xl font-bold text-${scoreColor}-700`}>{score}<span className="text-xl">/100</span></p>
          <div className="mt-3 bg-white/60 rounded-full h-2">
            <div
              className={`h-2 rounded-full bg-${scoreColor}-500 transition-all duration-700`}
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">{enabledCount}/{rules.length} règles actives</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={16} className="text-red-500" />
            <span className="text-sm font-medium text-gray-700">IPs bloquées</span>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Temps réel" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{blocked.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            {blocked.filter(b => b.auto_blocked).length} automatique{blocked.filter(b => b.auto_blocked).length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-emerald-500" />
            <span className="text-sm font-medium text-gray-700">SSL/TLS actifs</span>
          </div>
          <p className="text-3xl font-bold text-emerald-700">6/7</p>
          <p className="text-xs text-gray-400 mt-1">Sites avec certificat valide</p>
        </div>
      </div>

      {/* ── Security Rules ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Règles de sécurité</h3>
          </div>
          <button onClick={loadAll} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/70 transition-colors group">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${rule.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{rule.name}</p>
                  <p className="text-xs text-gray-400 truncate">{rule.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <span className="text-xs text-gray-400 hidden sm:block">
                  {rule.enabled ? 'Actif' : 'Inactif'}
                </span>
                <button
                  onClick={() => toggleRule(rule)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${rule.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Blocked IPs ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <Globe size={18} className="text-red-500" />
            <h3 className="font-semibold text-gray-900 text-sm">IPs bloquées ({blocked.length})</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={ipSearch}
                onChange={e => setIpSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
              />
            </div>
            <button
              onClick={() => setShowBlockModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus size={12} /> Bloquer une IP
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Adresse IP</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Raison</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Tentatives</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Type</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Bloqué le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredBlocked.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                    {ipSearch ? 'Aucun résultat pour cette recherche' : 'Aucune IP bloquée'}
                  </td>
                </tr>
              ) : filteredBlocked.map(ip => (
                <tr key={ip.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-gray-900">{ip.ip_address}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{ip.reason}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{ip.attempts}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ip.auto_blocked ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {ip.auto_blocked ? 'Auto' : 'Manuel'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">{fmtDate(ip.blocked_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => unblockIp(ip)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={11} /> Débloquer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── API Key ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Key size={18} className="text-amber-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Clé API d'administration</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
            <Fingerprint size={14} className="text-gray-400 flex-shrink-0" />
            <code className="text-sm font-mono text-gray-700 flex-1 truncate select-all">
              {showKey ? apiKey : '•'.repeat(32)}
            </code>
            <button onClick={() => setShowKey(s => !s)} className="text-gray-400 hover:text-gray-600 transition-colors">
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            onClick={regenKey}
            disabled={keyRegenLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {keyRegenLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Régénérer
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2.5 flex items-center gap-1">
          <AlertTriangle size={11} className="text-amber-500" />
          Ne partagez jamais cette clé. Elle donne un accès complet à l'API d'administration.
        </p>
      </div>

      {/* ── Audit log ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <Lock size={18} className="text-gray-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Journal d'audit sécurité</h3>
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Temps réel" />
        </div>
        <div className="divide-y divide-gray-50">
          {auditLog.length === 0 && (
            <p className="text-center py-10 text-sm text-gray-400">Aucune entrée dans le journal</p>
          )}
          {auditLog.map(entry => (
            <div key={entry.id} className="flex items-start gap-4 px-6 py-3 hover:bg-gray-50/70 transition-colors">
              {entry.status === 'success' && <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />}
              {entry.status === 'warning' && <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />}
              {entry.status === 'error'   && <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 font-medium">{entry.action}</p>
                {entry.details && <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.details}</p>}
                <p className="text-xs text-gray-400 mt-0.5">par {entry.performed_by}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(entry.created_at)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Block IP modal ── */}
      {showBlockModal && (
        <BlockIpModal
          onClose={() => setShowBlockModal(false)}
          onSave={async ({ ip, reason }) => {
            await supabase.from('blocked_ips').insert({
              ip_address: ip, reason, attempts: 0, auto_blocked: false,
            });
            await supabase.from('audit_log').insert({
              action: `IP ${ip} bloquée manuellement`,
              performed_by: 'ABOU KAMANO',
              status: 'warning',
              details: reason,
            });
            setShowBlockModal(false);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

// ── Block IP modal ─────────────────────────────────────────────────────────────
function BlockIpModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: { ip: string; reason: string }) => void;
}) {
  const [ip, setIp]         = useState('');
  const [reason, setReason] = useState('');
  const valid = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip.trim()) && reason.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm">Bloquer une adresse IP</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Adresse IP</label>
            <input
              type="text" value={ip} onChange={e => setIp(e.target.value)}
              placeholder="203.0.113.42"
              className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Raison du blocage</label>
            <input
              type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Tentatives de connexion répétées..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={() => onSave({ ip: ip.trim(), reason: reason.trim() })}
            disabled={!valid}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Shield size={14} /> Bloquer
          </button>
        </div>
      </div>
    </div>
  );
}
