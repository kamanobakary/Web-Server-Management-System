import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, User, Mail, Shield, Clock, Trash2, Edit2, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AppUser, UserRole, UserStatus } from '../lib/supabase';
import { formatDate, timeAgo } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';

interface UsersProps {
  onRefreshTrigger: number;
}

export default function Users({ onRefreshTrigger }: UsersProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, onRefreshTrigger]);

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  async function deleteUser(id: string) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    await supabase.from('app_users').delete().eq('id', id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  const counts = {
    all: users.length,
    admin: users.filter((u) => u.role === 'admin').length,
    operator: users.filter((u) => u.role === 'operator').length,
    user: users.filter((u) => u.role === 'user').length,
  };

  const activeCount = users.filter((u) => u.status === 'active').length;
  const suspendedCount = users.filter((u) => u.status === 'suspended').length;

  return (
    <div className="p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: counts.all, color: 'blue' },
          { label: 'Administrateurs', value: counts.admin, color: 'blue' },
          { label: 'Opérateurs', value: counts.operator, color: 'cyan' },
          { label: 'Actifs', value: activeCount, color: 'emerald' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => { setEditUser(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          <Plus size={16} />
          Ajouter un utilisateur
        </button>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'admin', 'operator', 'user'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setFilterRole(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterRole === r ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {r === 'all' ? 'Tous' : r === 'admin' ? 'Administrateurs' : r === 'operator' ? 'Opérateurs' : 'Utilisateurs'} ({counts[r] ?? filtered.length})
          </button>
        ))}
      </div>

      {/* Users table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Utilisateur</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Rôle</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Statut</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Créé le</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Dernière connexion</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                          {user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10} />{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.role} showDot={false} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{formatDate(user.created_at)}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={10} />
                        {user.last_login ? timeAgo(user.last_login) : 'Jamais'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditUser(user); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteUser(user.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-gray-400">
                      <User size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Aucun utilisateur trouvé</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <UserModal
          user={editUser}
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            if (editUser) {
              await supabase.from('app_users').update(data).eq('id', editUser.id);
            } else {
              await supabase.from('app_users').insert(data);
            }
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

interface UserModalProps {
  user: AppUser | null;
  onClose: () => void;
  onSave: (data: Partial<AppUser>) => void;
}

function UserModal({ user, onClose, onSave }: UserModalProps) {
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'user' as UserRole,
    status: user?.status ?? 'active' as UserStatus,
  });

  const roleDescriptions: Record<UserRole, string> = {
    admin: 'Accès complet à toutes les fonctionnalités',
    operator: 'Gestion des sites et surveillance',
    user: 'Consultation uniquement',
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Prénom Nom" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
            <div className="space-y-2">
              {(['admin', 'operator', 'user'] as UserRole[]).map((r) => (
                <label key={r} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.role === r ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => setForm((f) => ({ ...f, role: r }))} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r === 'admin' ? 'Administrateur' : r === 'operator' ? 'Opérateur' : 'Utilisateur'}</p>
                    <p className="text-xs text-gray-400">{roleDescriptions[r]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as UserStatus }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="suspended">Suspendu</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Annuler</button>
          <button onClick={() => onSave(form)} disabled={!form.name || !form.email}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
            <Check size={14} />
            {user ? 'Sauvegarder' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
