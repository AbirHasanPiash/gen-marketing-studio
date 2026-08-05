import { cn } from '../../lib/utils';
import { initials } from '../../lib/utils';

export function Spinner({ className }) {
  return (
    <svg className={cn('animate-spin h-5 w-5 text-brand-500', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} />;
}

export function Avatar({ name, src, size = 'md', className, style }) {
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };
  return (
    <div
      className={cn(
        'shrink-0 rounded-full grid place-items-center font-semibold overflow-hidden',
        'bg-gradient-to-br from-brand-500 to-brand-700 text-white ring-2 ring-card',
        sizes[size],
        className
      )}
      style={style}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name) || '?'}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      {Icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <h3 className="font-display font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      className={cn('inline-flex items-center gap-2.5', className)}
    >
      <span
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-border'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </span>
      {label && <span className="text-sm text-fg">{label}</span>}
    </button>
  );
}
