import { cn } from '../../lib/utils';
import { STATUS_META, PLATFORM_META } from '../../lib/utils';

export function Badge({ className, children, color }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        color || 'bg-brand-500/12 text-brand-500',
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }) {
  const meta = STATUS_META[status] || { label: status, cls: 'bg-slate-500/15 text-slate-500' };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        meta.cls,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  );
}

export function PlatformDot({ platform, className }) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.GENERIC;
  return (
    <span
      title={meta.label}
      className={cn('inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-bold text-white', className)}
      style={{ backgroundColor: meta.color }}
    >
      {meta.short}
    </span>
  );
}

export default Badge;
