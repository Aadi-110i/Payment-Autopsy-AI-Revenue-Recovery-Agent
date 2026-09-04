import { ReactNode } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListChecks, BarChart2, Settings, Zap, ArrowLeft, Menu, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Recovery Cases', href: '/cases', icon: ListChecks },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Settings', href: '/settings', icon: Settings }
];

export function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-autopsy-bg flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-autopsy-surface border-r border-autopsy-border transform transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Main navigation"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-autopsy-border">
            <Link to="/" className="flex items-center gap-3" aria-label="Autopsy Home">
              <div className="w-8 h-8 rounded-lg bg-autopsy-accent flex items-center justify-center">
                <Zap className="w-5 h-5 text-autopsy-bg" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xl font-bold text-autopsy-text">Autopsy</span>
                <p className="text-xs text-autopsy-text-muted">AI Revenue Recovery</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-autopsy-accent/10 text-autopsy-accent border border-autopsy-accent/20'
                      : 'text-autopsy-text-muted hover:text-autopsy-text hover:bg-autopsy-border'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Demo section */}
          <div className="p-4 border-t border-autopsy-border">
            <p className="text-xs text-autopsy-text-muted uppercase tracking-wider mb-3">Demo</p>
            <Link
              to="/demo"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-autopsy-accent/10 text-autopsy-accent border border-autopsy-accent/20 hover:bg-autopsy-accent/20 transition-colors"
            >
              <Zap className="w-5 h-5" aria-hidden="true" />
              Run Simulation
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-autopsy-bg/95 backdrop-blur-sm border-b border-autopsy-border">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-autopsy-text-muted hover:text-autopsy-text hover:bg-autopsy-border"
                aria-label="Open menu"
                aria-expanded={sidebarOpen}
              >
                <Menu className="w-6 h-6" aria-hidden="true" />
              </button>
              <h1 className="text-lg font-semibold text-autopsy-text hidden sm:block">
                {navigation.find(n => location.pathname === n.href || location.pathname.startsWith(n.href))?.name || 'Dashboard'}
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-autopsy-surface border border-autopsy-border">
                <span className="w-2 h-2 rounded-full bg-autopsy-success" aria-hidden="true"></span>
                <span className="text-sm text-autopsy-text-muted">Demo Mode</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { 
  title: string; 
  subtitle?: string; 
  action?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl lg:text-3xl font-bold text-autopsy-text">{title}</h1>
      {subtitle && <p className="text-autopsy-text-muted mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: { 
  title: string; 
  subtitle?: string; 
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-autopsy-text">{title}</h2>
        {subtitle && <p className="text-sm text-autopsy-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}