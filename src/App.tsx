import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar, { type Page } from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Websites from './pages/Websites';
import Users from './pages/Users';
import Logs from './pages/Logs';
import AlertsPage from './pages/AlertsPage';
import Settings from './pages/Settings';
import Security from './pages/Security';
import Backups from './pages/Backups';
import Reports from './pages/Reports';

/** Returns true when window.innerWidth >= breakpoint */
function useIsDesktop(breakpoint = 768) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= breakpoint : true
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    // MediaQueryList.addEventListener is supported in all modern browsers
    mq.addEventListener('change', handler);
    setIsDesktop(mq.matches); // sync on mount
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isDesktop;
}

export default function App() {
  const [currentPage, setCurrentPage]       = useState<Page>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen]         = useState(false);
  const [alertCount, setAlertCount]         = useState(6);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing]     = useState(false);
  const isDesktop = useIsDesktop();
  const prevDesktop = useRef(isDesktop);

  // When switching desktop → mobile, close mobile drawer
  // When switching mobile → desktop, close mobile drawer
  useEffect(() => {
    if (prevDesktop.current !== isDesktop) {
      setMobileOpen(false);
      prevDesktop.current = isDesktop;
    }
  }, [isDesktop]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshTrigger(t => t + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  const handleNavigate = useCallback((page: Page) => {
    setCurrentPage(page);
    setMobileOpen(false); // always close drawer after navigation
  }, []);

  function renderPage() {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onRefreshTrigger={refreshTrigger} />;
      case 'websites':  return <Websites  onRefreshTrigger={refreshTrigger} />;
      case 'users':     return <Users     onRefreshTrigger={refreshTrigger} />;
      case 'logs':      return <Logs      onRefreshTrigger={refreshTrigger} />;
      case 'alerts':    return <AlertsPage onRefreshTrigger={refreshTrigger} onAlertsChange={setAlertCount} />;
      case 'settings':  return <Settings />;
      case 'security':  return <Security />;
      case 'backups':   return <Backups   onRefreshTrigger={refreshTrigger} />;
      case 'reports':   return <Reports />;
    }
  }

  return (
    /*
      Layout root uses inline height: 100dvh (dynamic viewport height).
      This fixes the iOS Safari address-bar-resize bug where h-screen
      could be taller than the visible area.
    */
    <div
      className="flex bg-gray-50 overflow-hidden"
      style={{ height: '100dvh', minHeight: '-webkit-fill-available' }}
    >
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        alertCount={alertCount}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content column */}
      <div
        className="flex flex-col min-w-0 overflow-hidden"
        style={{ flex: 1 }}
      >
        <Header
          currentPage={currentPage}
          alertCount={alertCount}
          onNavigate={handleNavigate}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onMenuOpen={() => setMobileOpen(true)}
        />

        {/* Scrollable page area */}
        <main
          className="overflow-y-auto"
          style={{
            flex: 1,
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
        >
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
