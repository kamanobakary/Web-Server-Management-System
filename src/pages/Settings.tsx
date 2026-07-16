import { useState, useEffect, useCallback } from 'react';
import { Save, Server, Globe, Mail, Clock, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ServerSettings } from '../lib/supabase';

type FormState = Omit<ServerSettings, 'id' | 'updated_at'>;

const DEFAULT: FormState = {
  server_name: 'Production Server',
  host: 'srv-prod-01.example.com',
  port: 80,
  max_connections: 1024,
  keepalive_timeout: 65,
  worker_processes: 'auto',
  worker_connections: 1024,
  gzip_enabled: true,
  gzip_min_length: 1024,
  access_log_enabled: true,
  error_log_level: 'warn',
  sendfile_enabled: true,
  tcp_nopush: true,
  admin_email: 'admin@domaine.com',
  alert_email: 'alerts@domaine.com',
  timezone: 'Europe/Paris',
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function Settings() {
  const [form, setForm] = useState<FormState>(DEFAULT);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('server_settings')
      .select('*')
      .maybeSingle();
    if (data) {
      const { id, updated_at, ...rest } = data as ServerSettings;
      setSettingsId(id);
      setForm(rest);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function handleSave() {
    setSaveStatus('saving');
    const payload = { ...form, updated_at: new Date().toISOString() };

    let error;
    if (settingsId) {
      ({ error } = await supabase.from('server_settings').update(payload).eq('id', settingsId));
    } else {
      const res = await supabase.from('server_settings').insert(payload).select().maybeSingle();
      error = res.error;
      if (res.data) setSettingsId((res.data as ServerSettings).id);
    }

    if (error) {
      setSaveStatus('error');
    } else {
      setSaveStatus('saved');
      setDirty(false);
      // Also update server_config name/host/port to keep in sync
      await supabase.from('server_config').update({
        name: form.server_name,
        host: form.host,
        port: form.port,
        updated_at: new Date().toISOString(),
      }).neq('id', '00000000-0000-0000-0000-000000000000');
    }
    setTimeout(() => setSaveStatus('idle'), 3500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Status banner */}
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700">
          <Check size={16} />
          <span className="text-sm font-medium">Paramètres sauvegardés avec succès dans Supabase</span>
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle size={16} />
          <span className="text-sm font-medium">Erreur lors de la sauvegarde. Veuillez réessayer.</span>
        </div>
      )}

      {/* Server Identity */}
      <Section icon={<Server size={18} className="text-blue-600" />} title="Identité du serveur">
        <Field label="Nom du serveur">
          <input type="text" value={form.server_name}
            onChange={e => update('server_name', e.target.value)}
            className={inputClass} placeholder="Production Server" />
        </Field>
        <Field label="Hôte / IP">
          <input type="text" value={form.host}
            onChange={e => update('host', e.target.value)}
            className={inputClass} placeholder="srv-prod-01.example.com" />
        </Field>
        <Field label="Port HTTP">
          <input type="number" value={form.port}
            onChange={e => update('port', parseInt(e.target.value) || 80)}
            className={inputClass} min={1} max={65535} />
        </Field>
      </Section>

      {/* Performance */}
      <Section icon={<Globe size={18} className="text-emerald-600" />} title="Performance Nginx">
        <Field label="Processus worker">
          <input type="text" value={form.worker_processes}
            onChange={e => update('worker_processes', e.target.value)}
            className={inputClass} placeholder="auto" />
        </Field>
        <Field label="Connexions worker">
          <input type="number" value={form.worker_connections}
            onChange={e => update('worker_connections', parseInt(e.target.value) || 1024)}
            className={inputClass} />
        </Field>
        <Field label="Connexions max">
          <input type="number" value={form.max_connections}
            onChange={e => update('max_connections', parseInt(e.target.value) || 1024)}
            className={inputClass} />
        </Field>
        <Field label="Keep-Alive timeout (s)">
          <input type="number" value={form.keepalive_timeout}
            onChange={e => update('keepalive_timeout', parseInt(e.target.value) || 65)}
            className={inputClass} />
        </Field>
        <Toggle
          label="Sendfile"
          description="Optimise le transfert de fichiers statiques"
          value={form.sendfile_enabled}
          onChange={() => update('sendfile_enabled', !form.sendfile_enabled)}
        />
        <Toggle
          label="TCP No Push"
          description="Optimise l'envoi de paquets TCP (tcp_nopush)"
          value={form.tcp_nopush}
          onChange={() => update('tcp_nopush', !form.tcp_nopush)}
        />
      </Section>

      {/* Compression */}
      <Section icon={<Globe size={18} className="text-cyan-600" />} title="Compression GZIP">
        <Toggle
          label="Compression GZIP"
          description="Compresse les réponses HTTP pour réduire la bande passante"
          value={form.gzip_enabled}
          onChange={() => update('gzip_enabled', !form.gzip_enabled)}
        />
        <Field label="Taille minimale (octets)">
          <input type="number" value={form.gzip_min_length}
            onChange={e => update('gzip_min_length', parseInt(e.target.value) || 1024)}
            className={inputClass} disabled={!form.gzip_enabled} />
        </Field>
      </Section>

      {/* Logging */}
      <Section icon={<Clock size={18} className="text-amber-600" />} title="Journalisation">
        <Toggle
          label="Journal d'accès"
          description="Enregistrer toutes les requêtes HTTP dans access.log"
          value={form.access_log_enabled}
          onChange={() => update('access_log_enabled', !form.access_log_enabled)}
        />
        <Field label="Niveau d'erreur">
          <select value={form.error_log_level}
            onChange={e => update('error_log_level', e.target.value)}
            className={inputClass}>
            <option value="debug">Debug (très verbeux)</option>
            <option value="info">Info</option>
            <option value="notice">Notice</option>
            <option value="warn">Warning (recommandé)</option>
            <option value="error">Error</option>
            <option value="crit">Critical</option>
          </select>
        </Field>
      </Section>

      {/* Notifications */}
      <Section icon={<Mail size={18} className="text-red-500" />} title="Notifications par email">
        <Field label="Email administrateur">
          <input type="email" value={form.admin_email}
            onChange={e => update('admin_email', e.target.value)}
            className={inputClass} placeholder="admin@domaine.com" />
        </Field>
        <Field label="Email des alertes">
          <input type="email" value={form.alert_email}
            onChange={e => update('alert_email', e.target.value)}
            className={inputClass} placeholder="alerts@domaine.com" />
        </Field>
        <Field label="Fuseau horaire">
          <select value={form.timezone}
            onChange={e => update('timezone', e.target.value)}
            className={inputClass}>
            <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
            <option value="Europe/London">Europe/London (UTC+0/+1)</option>
            <option value="Europe/Berlin">Europe/Berlin (UTC+1/+2)</option>
            <option value="America/New_York">America/New_York (UTC-5/-4)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (UTC-8/-7)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
            <option value="Africa/Abidjan">Africa/Abidjan (UTC+0)</option>
            <option value="Africa/Lagos">Africa/Lagos (UTC+1)</option>
          </select>
        </Field>
      </Section>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={loadSettings}
          disabled={loading || saveStatus === 'saving'}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Réinitialiser
        </button>
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving' || !dirty}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saveStatus === 'saving'
            ? <><Loader2 size={14} className="animate-spin" /> Sauvegarde...</>
            : <><Save size={14} /> Sauvegarder</>}
        </button>
      </div>

      {dirty && saveStatus === 'idle' && (
        <p className="text-xs text-amber-600 text-right -mt-4">
          Modifications non sauvegardées
        </p>
      )}
    </div>
  );
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50 bg-white';

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        {icon}
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

function Toggle({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ml-4 ${value ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
