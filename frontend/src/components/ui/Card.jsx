import { cn } from '../../lib/utils';

export function Card({ className, hover, ...props }) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-2xl shadow-soft',
        hover && 'transition hover:shadow-card hover:-translate-y-0.5',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, title, subtitle, action, children }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 p-5 border-b border-border', className)}>
      {children || (
        <div className="min-w-0">
          {title && <h3 className="font-display font-semibold text-fg truncate">{title}</h3>}
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
      )}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }) {
  return <div className={cn('p-5', className)} {...props} />;
}

export default Card;
