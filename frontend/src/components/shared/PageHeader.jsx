import { cn } from '../../lib/utils';

export function PageHeader({ title, description, actions, icon: Icon, className }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="hidden sm:grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-fg truncate">{title}</h1>
          {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export default PageHeader;
