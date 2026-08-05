import { cn } from '../../lib/utils';

export function Label({ className, children, hint, ...props }) {
  return (
    <label className={cn('label flex items-center justify-between', className)} {...props}>
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <div className={className}>
      {label && <Label hint={hint}>{label}</Label>}
      {children}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

export function Input({ className, icon: Icon, ...props }) {
  if (Icon) {
    return (
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        <input className={cn('input pl-9', className)} {...props} />
      </div>
    );
  }
  return <input className={cn('input', className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn('input min-h-[96px] resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn('input appearance-none pr-9 cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
}

export default Input;
