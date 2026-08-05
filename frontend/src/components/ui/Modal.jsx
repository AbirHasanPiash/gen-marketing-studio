import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', className }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full bg-card border border-border shadow-card rounded-t-3xl sm:rounded-2xl',
          'max-h-[92vh] flex flex-col animate-scale-in',
          SIZES[size],
          className
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-3 p-5 border-b border-border shrink-0">
            <div className="min-w-0">
              {title && <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>}
              {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-fg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-5 grow">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 p-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Confirm', danger, loading }) {
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
