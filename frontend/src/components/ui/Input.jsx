import { Children, cloneElement, isValidElement, useId } from 'react';
import { cn } from '../../lib/utils';

export function Label({ className, children, hint, ...props }) {
  return (
    <label className={cn('label flex items-center justify-between', className)} {...props}>
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

/**
 * Label + control + error message.
 *
 * The label is wired to its control with `htmlFor`/`id` rather than just
 * rendered above it, so clicking the label focuses the field and screen readers
 * announce the two together. The id is generated here and pushed onto the child
 * unless the caller already set one.
 */
export function Field({ label, hint, error, children, className, htmlFor }) {
  const generatedId = useId();
  // A Field may hold a control plus extra hints or chips; only the first
  // element is the control, and only it gets the id the label points at.
  const items = Children.toArray(children);
  const control = items.find(isValidElement);
  const controlId = htmlFor || control?.props?.id || generatedId;
  const errorId = `${controlId}-error`;

  const wired = items.map((item) =>
    item === control
      ? cloneElement(item, {
          id: controlId,
          ...(error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}),
        })
      : item
  );

  return (
    <div className={className}>
      {label && (
        <Label hint={hint} htmlFor={controlId}>
          {label}
        </Label>
      )}
      {wired}
      {error && (
        <p id={errorId} className="text-xs text-red-500 mt-1.5">
          {error}
        </p>
      )}
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
