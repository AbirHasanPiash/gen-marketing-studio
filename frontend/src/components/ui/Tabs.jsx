import { cn } from '../../lib/utils';

/** Simple controlled tab bar. `tabs` = [{ key, label, icon, count }]. */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto no-scrollbar', className)}>
      {tabs.map((t) => {
        const active = t.key === value;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition',
              active ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25' : 'text-muted hover:text-fg hover:bg-elevated'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {t.label}
            {t.count != null && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 text-[11px]',
                  active ? 'bg-white/20' : 'bg-border/70'
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Underline-style tabs for sub-navigation. */
export function UnderlineTabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('flex items-center gap-6 border-b border-border overflow-x-auto no-scrollbar', className)}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              'relative whitespace-nowrap pb-3 pt-1 text-sm font-medium transition',
              active ? 'text-fg' : 'text-muted hover:text-fg'
            )}
          >
            {t.label}
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
