import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/25',
  secondary: 'bg-elevated text-fg border border-border hover:bg-border/50',
  outline: 'border border-border text-fg hover:bg-elevated',
  ghost: 'text-fg hover:bg-elevated',
  subtle: 'bg-brand-500/10 text-brand-500 hover:bg-brand-500/20',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
};

export function buttonVariants({ variant = 'primary', size = 'md' } = {}) {
  return cn(
    'inline-flex items-center justify-center font-medium transition-all active:scale-[.98]',
    'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 whitespace-nowrap',
    VARIANTS[variant],
    SIZES[size]
  );
}

export function Button({ variant, size, loading, className, children, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export default Button;
