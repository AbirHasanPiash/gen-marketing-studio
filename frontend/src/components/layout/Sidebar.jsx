import { NavLink } from 'react-router-dom';
import { X, Sparkles } from 'lucide-react';
import { NAV_GROUPS } from './navConfig';
import { useUI } from '../../store/ui';
import { useAuth } from '../../store/auth';
import { cn } from '../../lib/utils';

function Brandmark() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="font-display font-bold text-fg">mkt_studio</p>
        <p className="text-[11px] text-muted">AI Marketing Studio</p>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  const { user } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="h-16 flex items-center shrink-0">
        <Brandmark />
      </div>
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 pb-6 space-y-6">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.ownerOnly || user?.role === 'OWNER');
          if (!items.length) return null;
          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                          isActive
                            ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                            : 'text-muted hover:bg-elevated hover:text-fg'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={cn('h-[18px] w-[18px] shrink-0', !isActive && 'group-hover:text-brand-500')} />
                          <span className="flex-1 truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const { sidebarOpen, setSidebar } = useUI();
  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setSidebar(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-card border-r border-border animate-fade-in">
            <button
              onClick={() => setSidebar(false)}
              className="absolute top-4 right-3 rounded-lg p-1.5 text-muted hover:bg-elevated"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setSidebar(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
