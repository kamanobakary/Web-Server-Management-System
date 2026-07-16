import { cn } from '../lib/utils';

type StatusVariant = 'active' | 'inactive' | 'maintenance' | 'error' | 'running' | 'stopped' | 'restarting' |
  'admin' | 'operator' | 'user' | 'suspended' |
  'info' | 'warning' | 'critical' | 'success' |
  'completed' | 'scheduled' | 'failed';

const variantStyles: Record<StatusVariant, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  running: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-100 text-emerald-700',
  success: 'bg-emerald-100 text-emerald-700',
  info: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-blue-100 text-blue-700',
  admin: 'bg-blue-100 text-blue-700',
  operator: 'bg-cyan-100 text-cyan-700',
  user: 'bg-gray-100 text-gray-700',
  maintenance: 'bg-amber-100 text-amber-700',
  warning: 'bg-amber-100 text-amber-700',
  inactive: 'bg-gray-100 text-gray-500',
  stopped: 'bg-gray-100 text-gray-500',
  suspended: 'bg-gray-100 text-gray-500',
  error: 'bg-red-100 text-red-700',
  restarting: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

const variantLabels: Record<StatusVariant, string> = {
  active: 'Actif',
  running: 'En marche',
  completed: 'Terminé',
  success: 'Succès',
  info: 'Info',
  scheduled: 'Planifié',
  admin: 'Administrateur',
  operator: 'Opérateur',
  user: 'Utilisateur',
  maintenance: 'Maintenance',
  warning: 'Attention',
  inactive: 'Inactif',
  stopped: 'Arrêté',
  suspended: 'Suspendu',
  error: 'Erreur',
  restarting: 'Redémarrage',
  critical: 'Critique',
  failed: 'Échoué',
};

const dotVariants: Record<StatusVariant, string> = {
  active: 'bg-emerald-500',
  running: 'bg-emerald-500',
  completed: 'bg-emerald-500',
  success: 'bg-emerald-500',
  info: 'bg-blue-500',
  scheduled: 'bg-blue-500',
  admin: 'bg-blue-500',
  operator: 'bg-cyan-500',
  user: 'bg-gray-400',
  maintenance: 'bg-amber-500',
  warning: 'bg-amber-500',
  inactive: 'bg-gray-400',
  stopped: 'bg-gray-400',
  suspended: 'bg-gray-400',
  error: 'bg-red-500',
  restarting: 'bg-orange-500',
  critical: 'bg-red-500',
  failed: 'bg-red-500',
};

interface StatusBadgeProps {
  status: StatusVariant;
  showDot?: boolean;
  pulse?: boolean;
}

export default function StatusBadge({ status, showDot = true, pulse = false }: StatusBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium', variantStyles[status])}>
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotVariants[status], pulse && (status === 'running' || status === 'active') ? 'animate-pulse' : '')} />
      )}
      {variantLabels[status]}
    </span>
  );
}
