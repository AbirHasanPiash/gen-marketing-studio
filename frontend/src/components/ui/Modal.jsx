import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * How many modals are open. Modals nest (a picker inside a detail dialog), and
 * without a count the inner one restoring `overflow` on unmount let the page
 * scroll behind the outer one that was still open.
 */
let openCount = 0;

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', className }) {
  const panelRef = useRef(null);
  const restoreFocusTo = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;

    restoreFocusTo.current = document.activeElement;
    openCount += 1;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      // Keep Tab inside the dialog. Without this, tabbing walks off into the
      // page behind the backdrop, which is unusable with a keyboard or a
      // screen reader.
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    // Move focus in on open so the first Tab lands somewhere sensible.
    const raf = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector(FOCUSABLE);
      (target || panelRef.current)?.focus?.();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      openCount -= 1;
      if (openCount === 0) document.body.style.overflow = '';
      restoreFocusTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-card border border-border shadow-card rounded-t-3xl sm:rounded-2xl',
          'max-h-[92vh] flex flex-col animate-scale-in outline-none',
          SIZES[size],
          className
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-3 p-5 border-b border-border shrink-0">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="font-display text-lg font-semibold text-fg">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-fg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-5 grow">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 p-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  danger,
  loading,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}

export default Modal;
