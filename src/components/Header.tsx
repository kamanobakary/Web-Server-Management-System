import { Bell, RefreshCw, Search, Menu } from 'lucide-react';
import type { Page } from './Sidebar';

const pageTitles: Record<Page, string> = {
  dashboard: 'Tableau de bord',
  websites:  'Sites Web',
  users:     'Utilisateurs',
  logs:      'Journaux',
  alerts:    'Alertes',
  settings:  'Paramètres',
  security:  'Sécurité',
  backups:   'Sauvegardes',
  reports:   'Rapports & Analyses',
};

const pageSubtitles: Record<Page, string> = {
  dashboard: 'Vue d\'ensemble des performances du serveur',
  websites:  'Gérer les sites web hébergés',
  users:     'Gérer les comptes et permissions',
  logs:      'Journaux d\'activité et d\'erreurs',
  alerts:    'Surveiller et gérer les alertes système',
  settings:  'Configurer les paramètres du serveur',
  security:  'Gérer la sécurité et les accès',
  backups:   'Sauvegardes automatiques et manuelles',
  reports:   'Analyser les performances',
};

interface HeaderProps {
  currentPage: Page;
  alertCount: number;
  onNavigate: (page: Page) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onMenuOpen: () => void;
}

export default function Header({
  currentPage, alertCount,
  onNavigate, onRefresh, isRefreshing,
  onMenuOpen,
}: HeaderProps) {
  return (
    <header
      className="bg-white border-b border-gray-200 flex items-center gap-3 flex-shrink-0"
      style={{
        height: '64px',
        padding: '0 16px',
        position: 'relative',
        zIndex: 30,          // below mobile backdrop (40) and drawer (50)
      }}
    >
      {/*
        ── Hamburger ────────────────────────────────────────────────────────
        Visible ONLY on mobile (< 768px) via inline style media check in App.
        We use className="md:hidden" AND inline display logic in App to be safe.
        touch-manipulation disables 300ms tap delay on all mobile browsers.
      */}
      <button
        onClick={onMenuOpen}
        aria-label="Ouvrir le menu"
        aria-expanded="false"
        style={{
          display: 'flex',           // always flex; App.tsx controls visibility via md:hidden
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: '#4b5563',
          touchAction: 'manipulation',
          flexShrink: 0,
          marginLeft: '-4px',
          WebkitTapHighlightColor: 'transparent',
        } as React.CSSProperties}
        className="md:hidden"
        onTouchStart={() => {/* prevents 300ms delay on older Android */}}
      >
        <Menu size={22} />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-gray-900 truncate leading-tight" style={{ fontSize: 'clamp(14px, 3.5vw, 18px)' }}>
          {pageTitles[currentPage]}
        </h1>
        <p className="text-xs text-gray-500 truncate hidden sm:block">
          {pageSubtitles[currentPage]}
        </p>
      </div>

      {/* Search bar – desktop only */}
      <div
        className="hidden md:flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ backgroundColor: '#f3f4f6', width: '220px' }}
      >
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
        />
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        aria-label="Actualiser"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '36px', height: '36px', borderRadius: '8px',
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: '#6b7280', flexShrink: 0,
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        } as React.CSSProperties}
        className="hover:bg-gray-100 transition-colors"
      >
        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
      </button>

      {/* Alerts bell */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => onNavigate('alerts')}
          aria-label={`Alertes${alertCount > 0 ? ` – ${alertCount} active${alertCount > 1 ? 's' : ''}` : ''}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', borderRadius: '8px',
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: '#6b7280', touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
          className="hover:bg-gray-100 transition-colors"
        >
          <Bell size={16} />
        </button>
        {alertCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: '4px', right: '4px',
              width: '16px', height: '16px',
              backgroundColor: '#ef4444', color: '#fff',
              borderRadius: '9999px', fontSize: '10px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, pointerEvents: 'none',
            }}
          >
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </div>

      {/* User avatar */}
      <div
        className="hidden sm:flex items-center gap-2 flex-shrink-0"
        style={{ paddingLeft: '8px', borderLeft: '1px solid #e5e7eb' }}
      >
        <div
          style={{
            width: '32px', height: '32px', backgroundColor: '#2563eb',
            borderRadius: '9999px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '12px', fontWeight: 700,
            color: '#fff', flexShrink: 0,
          }}
        >
          AK
        </div>
        <div className="hidden lg:block">
          <p className="text-sm font-medium text-gray-900 leading-tight">ABOU KAMANO</p>
          <p className="text-xs text-gray-500">Administrateur</p>
        </div>
      </div>
    </header>
  );
}
