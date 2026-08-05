import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

/** Lightweight popover menu. `trigger` is a render function receiving `open`. */
export function Menu({ trigger, children, align = 'right', width = 'w-52', className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={cn('relative', className)} ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger(open)}</div>
      {open && (
        <div
          className={cn(
            'absolute z-40 mt-2 rounded-xl border border-border bg-card shadow-card p-1.5 animate-scale-in',
            align === 'right' ? 'right-0' : 'left-0',
            width
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, danger, className, ...props }) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition text-left',
        danger ? 'text-red-500 hover:bg-red-500/10' : 'text-fg hover:bg-elevated',
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </button>
  );
}

export default Menu;
