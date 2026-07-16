import { useEffect } from 'react';
import {
  LayoutDashboard, Globe, Users, FileText, Bell,
  Settings, Shield, HardDrive, BarChart3, Server,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { cn } from '../lib/utils';

export type Page =
  | 'dashboard' | 'websites' | 'users' | 'logs' | 'alerts'
  | 'settings'  | 'security' | 'backups' | 'reports';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'websites',  label: 'Sites Web',        icon: Globe            },
  { id: 'users',     label: 'Utilisateurs',     icon: Users            },
  { id: 'logs',      label: 'Journaux',         icon: FileText         },
  { id: 'alerts',    label: 'Alertes',          icon: Bell             },
];

const settingsItems: NavItem[] = [
  { id: 'settings', label: 'Paramètres', icon: Settings  },
  { id: 'security', label: 'Sécurité',   icon: Shield    },
  { id: 'backups',  label: 'Sauvegardes',icon: HardDrive },
  { id: 'reports',  label: 'Rapports',   icon: BarChart3 },
];

export interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggle: () => void;
  alertCount: number;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({
  currentPage, onNavigate,
  collapsed, onToggle,
  alertCount,
  mobileOpen, onMobileClose,
}: SidebarProps) {

  // Escape key closes mobile drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && mobileOpen) onMobileClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  function navigate(page: Page) {
    onNavigate(page);
    onMobileClose();
  }

  // Shared panel content – rendered twice (desktop + mobile) to avoid stale refs
  function PanelContent({ isMobile }: { isMobile: boolean }) {
    const showLabels = isMobile || !collapsed;

    return (
      <div className="flex flex-col h-full bg-gray-900 text-white select-none">

        {/* ── Header ── */}
        <div className="flex items-center h-16 px-4 border-b border-gray-700 flex-shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Server size={18} className="text-white" />
            </div>
            {showLabels && (
              <div className="min-w-0">
                <p className="font-bold text-sm truncate text-white">Web Server</p>
                <p className="text-xs text-gray-400 truncate">Manager</p>
              </div>
            )}
          </div>

          {/* Desktop collapse button */}
          {!isMobile && (
            <button
              onClick={onToggle}
              aria-label={collapsed ? 'Agrandir la sidebar' : 'Réduire la sidebar'}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}

          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={onMobileClose}
              aria-label="Fermer le menu"
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 p-3 overflow-y-auto overscroll-contain">
          {showLabels && (
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1 mb-1">
              Principal
            </p>
          )}
          <ul className="space-y-0.5">
            {navItems.map(item => (
              <li key={item.id}>
                <NavBtn
                  item={item}
                  active={currentPage === item.id}
                  showLabel={showLabels}
                  badge={item.id === 'alerts' ? alertCount : undefined}
                  onClick={() => navigate(item.id)}
                />
              </li>
            ))}
          </ul>

          <div className={cn('mt-4 pt-4', collapsed && !isMobile ? 'border-t border-gray-700' : '')}>
            {showLabels && (
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1 mb-1">
                Administration
              </p>
            )}
            <ul className="space-y-0.5">
              {settingsItems.map(item => (
                <li key={item.id}>
                  <NavBtn
                    item={item}
                    active={currentPage === item.id}
                    showLabel={showLabels}
                    onClick={() => navigate(item.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* ── Footer ── */}
        {showLabels && (
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                AK
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">ABOU KAMANO</p>
                <p className="text-xs text-gray-400 truncate">Administrateur</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/*
        ── DESKTOP sidebar (≥ 768 px) ──────────────────────────────────────
        We use inline styles for width instead of Tailwind w-16/w-64 because
        Tailwind's JIT scanner sometimes misses dynamically-built class strings.
        The CSS transition on 'width' gives the smooth collapse animation.
      */}
      <aside
        aria-label="Navigation principale"
        style={{
          width: collapsed ? '64px' : '256px',
          minWidth: collapsed ? '64px' : '256px',
          transition: 'width 300ms ease, min-width 300ms ease',
          flexShrink: 0,
          overflow: 'hidden',
          // Hide completely on small screens via inline media (see wrapper div)
        }}
        className="hidden md:flex flex-col"
      >
        <PanelContent isMobile={false} />
      </aside>

      {/*
        ── MOBILE: backdrop ─────────────────────────────────────────────────
        Sits above page content (z-40) but below the drawer (z-50).
        Rendered always so the fade transition works on both open AND close.
      */}
      <div
        aria-hidden="true"
        onClick={onMobileClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          zIndex: 40,
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: 'opacity 280ms ease',
        }}
        className="md:hidden"
      />

      {/*
        ── MOBILE: slide-in drawer ──────────────────────────────────────────
        translateX drives open/close. will-change:transform ensures GPU
        compositing on every Android/iOS browser (Chrome, Safari, Firefox).
      */}
      <aside
        role="navigation"
        aria-label="Menu principal"
        aria-hidden={!mobileOpen}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 'min(288px, 85vw)',
          zIndex: 50,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
          boxShadow: mobileOpen ? '4px 0 24px rgba(0,0,0,0.35)' : 'none',
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          // iOS momentum scrolling
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
        className="md:hidden flex flex-col"
      >
        <PanelContent isMobile={true} />
      </aside>
    </>
  );
}

// ── NavBtn ────────────────────────────────────────────────────────────────────
function NavBtn({ item, active, showLabel, badge, onClick }: {
  item: NavItem;
  active: boolean;
  showLabel: boolean;
  badge?: number;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      title={!showLabel ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      style={{ minHeight: '44px' }} // WCAG tap target
      className={cn(
        'w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium',
        'transition-colors duration-150',
        showLabel ? 'justify-start' : 'justify-center',
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white active:bg-gray-700'
      )}
    >
      {/* Icon with optional collapsed badge */}
      <div className="relative flex-shrink-0">
        <Icon size={18} />
        {!showLabel && badge !== undefined && badge > 0 && (
          <span
            style={{ fontSize: '10px', minWidth: '16px', height: '16px' }}
            className="absolute -top-1 -right-1.5 bg-red-500 text-white font-bold rounded-full flex items-center justify-center px-0.5 leading-none"
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>

      {/* Label + badge (expanded state) */}
      {showLabel && (
        <>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}
