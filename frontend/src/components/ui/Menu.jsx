import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

/**
 * Lightweight popover menu.
 *
 * The trigger render-prop returns the *contents* of the button — `Menu` owns
 * the `<button>` itself so the popover is reachable by keyboard and announced
 * correctly. Returning a `<button>` from `trigger` would nest one inside the
 * other, which browsers repair by dropping it out of the DOM.
 */
export function Menu({ trigger, children, align = 'right', width = 'w-52', label = 'Open menu', className, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={cn('rounded-xl', triggerClassName)}
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
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
      type="button"
      role="menuitem"
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
