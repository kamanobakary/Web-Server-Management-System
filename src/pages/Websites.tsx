import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Globe, Shield, ShieldOff, Trash2, Edit2, ToggleLeft, ToggleRight, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Website, WebsiteStatus } from '../lib/supabase';
import { formatDate, formatTraffic } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';

interface WebsitesProps {
  onRefreshTrigger: number;
}

export default function Websites({ onRefreshTrigger }: WebsitesProps) {
  const [sites, setSites] = useState<Website[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | WebsiteStatus>('all');
  const [showModal, setShowModal] = useState(false);
  const [editSite, setEditSite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('websites').select('*').order('created_at', { ascending: false });
    if (data) setSites(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, onRefreshTrigger]);

  const filtered = sites.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.domain.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  async function toggleStatus(site: Website) {
    const newStatus: WebsiteStatus = site.status === 'active' ? 'inactive' : 'active';
    await supabase.from('websites').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', site.id);
    setSites((prev) => prev.map((s) => s.id === site.id ? { ...s, status: newStatus } : s));
  }

  async function deleteSite(id: string) {
    if (!confirm('Supprimer ce site ?')) return;
    await supabase.from('websites').delete().eq('id', id);
    setSites((prev) => prev.filter((s) => s.id !== id));
  }

  const statusCounts = {
    all: sites.length,
    active: sites.filter((s) => s.status === 'active').length,
    inactive: sites.filter((s) => s.status === 'inactive').length,
    maintenance: sites.filter((s) => s.status === 'maintenance').length,
    error: sites.filter((s) => s.status === 'error').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un site ou domaine..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => { setEditSite(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          <Plus size={16} />
          Ajouter un site
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'active', 'inactive', 'maintenance', 'error'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {s === 'all' ? 'Tous' : s === 'active' ? 'Actifs' : s === 'inactive' ? 'Inactifs' : s === 'maintenance' ? 'Maintenance' : 'Erreur'} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {/* Sites grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onToggle={() => toggleStatus(site)}
              onEdit={() => { setEditSite(site); setShowModal(true); }}
              onDelete={() => deleteSite(site.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Globe size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun site trouvé</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <SiteModal
          site={editSite}
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            if (editSite) {
              await supabase.from('websites').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editSite.id);
            } else {
              await supabase.from('websites').insert(data);
            }
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

interface SiteCardProps {
  site: Website;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SiteCard({ site, onToggle, onEdit, onDelete }: SiteCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Globe size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{site.name}</h3>
            <p className="text-xs text-gray-400">{site.domain}</p>
          </div>
        </div>
        <StatusBadge status={site.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-2.5">
          <p className="text-xs text-gray-400 mb-0.5">Trafic mensuel</p>
          <p className="text-sm font-bold text-gray-900">{formatTraffic(site.traffic_monthly)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5">
          <p className="text-xs text-gray-400 mb-0.5">Créé le</p>
          <p className="text-sm font-bold text-gray-900">{formatDate(site.created_at)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {site.ssl_enabled ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Shield size={12} /> SSL actif
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <ShieldOff size={12} /> Sans SSL
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggle} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Activer/Désactiver">
            {site.status === 'active' ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
          </button>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface SiteModalProps {
  site: Website | null;
  onClose: () => void;
  onSave: (data: Partial<Website>) => void;
}

function SiteModal({ site, onClose, onSave }: SiteModalProps) {
  const [form, setForm] = useState({
    name: site?.name ?? '',
    domain: site?.domain ?? '',
    status: site?.status ?? 'active',
    ssl_enabled: site?.ssl_enabled ?? true,
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{site ? 'Modifier le site' : 'Ajouter un site'}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du site</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mon Site Web"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domaine</label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="www.example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as WebsiteStatus }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="maintenance">Maintenance</option>
              <option value="error">Erreur</option>
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm((f) => ({ ...f, ssl_enabled: !f.ssl_enabled }))}
              className={`w-10 h-6 rounded-full transition-colors ${form.ssl_enabled ? 'bg-emerald-500' : 'bg-gray-300'} relative`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.ssl_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">SSL activé</span>
          </label>
        </div>
        <div className="flex gap-2 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Annuler</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.name || !form.domain}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Check size={14} />
            {site ? 'Sauvegarder' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
