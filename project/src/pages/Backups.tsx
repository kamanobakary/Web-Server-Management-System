import { useState, useEffect, useCallback } from 'react';
import { HardDrive, Plus, Download, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Backup } from '../lib/supabase';
import { formatDateTime, formatBytes } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';

interface BackupsProps {
  onRefreshTrigger: number;
}

export default function Backups({ onRefreshTrigger }: BackupsProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('backups').select('*').order('created_at', { ascending: false });
    if (data) setBackups(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, onRefreshTrigger]);

  async function startBackup(type: 'full' | 'incremental') {
    setRunning(true);
    const name = `backup_${new Date().toISOString().split('T')[0]}_${type}`;
    const { data } = await supabase.from('backups').insert({
      name,
      size_mb: 0,
      status: 'running',
      backup_type: type,
    }).select().maybeSingle();

    if (data) {
      setBackups((prev) => [data, ...prev]);
      setTimeout(async () => {
        const size = type === 'full' ? 2100 + Math.random() * 500 : 100 + Math.random() * 300;
        await supabase.from('backups').update({
          status: 'completed',
          size_mb: size,
          path: `/backups/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${name}.tar.gz`,
        }).eq('id', data.id);
        setBackups((prev) => prev.map((b) => b.id === data.id ? { ...b, status: 'completed', size_mb: size } : b));
        setRunning(false);
      }, 4000);
    }
  }

  async function deleteBackup(id: string) {
    if (!confirm('Supprimer cette sauvegarde ?')) return;
    await supabase.from('backups').delete().eq('id', id);
    setBackups((prev) => prev.filter((b) => b.id !== id));
  }

  const totalSize = backups.filter((b) => b.status === 'completed').reduce((sum, b) => sum + b.size_mb, 0);
  const completedCount = backups.filter((b) => b.status === 'completed').length;
  const failedCount = backups.filter((b) => b.status === 'failed').length;

  return (
    <div className="p-6 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-900">{backups.length}</p>
          <p className="text-sm font-medium text-gray-700 mt-0.5">Total</p>
          <p className="text-xs text-gray-400">sauvegardes</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-700">{completedCount}</p>
          <p className="text-sm font-medium text-emerald-600 mt-0.5">Réussies</p>
          <p className="text-xs text-emerald-400">sauvegardes</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-700">{failedCount}</p>
          <p className="text-sm font-medium text-red-600 mt-0.5">Échouées</p>
          <p className="text-xs text-red-400">à vérifier</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-700">{formatBytes(totalSize)}</p>
          <p className="text-sm font-medium text-blue-600 mt-0.5">Stockage utilisé</p>
          <p className="text-xs text-blue-400">total sauvegardes</p>
        </div>
      </div>

      {/* Schedule info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar size={18} className="text-blue-600" />
          <h3 className="font-semibold text-gray-900">Planification automatique</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <RefreshCw size={14} className="text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Sauvegarde complète</p>
              <p className="text-xs text-gray-400">Tous les dimanches à 02:00</p>
            </div>
            <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Actif</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Clock size={14} className="text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Sauvegarde incrémentale</p>
              <p className="text-xs text-gray-400">Tous les jours à 03:00</p>
            </div>
            <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Actif</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => startBackup('full')}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <HardDrive size={16} />
          Sauvegarde complète
        </button>
        <button
          onClick={() => startBackup('incremental')}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Sauvegarde incrémentale
        </button>
        {running && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">
            <RefreshCw size={14} className="animate-spin" />
            Sauvegarde en cours...
          </div>
        )}
      </div>

      {/* Backups table */}
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
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Nom</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Statut</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Taille</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {backup.status === 'completed' && <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />}
                        {backup.status === 'failed' && <XCircle size={14} className="text-red-500 flex-shrink-0" />}
                        {backup.status === 'running' && <RefreshCw size={14} className="text-blue-500 animate-spin flex-shrink-0" />}
                        {backup.status === 'scheduled' && <Clock size={14} className="text-gray-400 flex-shrink-0" />}
                        <span className="text-sm font-mono text-gray-900 truncate max-w-[180px]">{backup.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full capitalize">
                        {backup.backup_type === 'full' ? 'Complète' : backup.backup_type === 'incremental' ? 'Incrémentale' : 'Différentielle'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={backup.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-gray-600">{backup.size_mb > 0 ? formatBytes(backup.size_mb) : '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-400">{formatDateTime(backup.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {backup.status === 'completed' && (
                          <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Télécharger">
                            <Download size={14} />
                          </button>
                        )}
                        <button onClick={() => deleteBackup(backup.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {backups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-gray-400">
                      <HardDrive size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Aucune sauvegarde</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
