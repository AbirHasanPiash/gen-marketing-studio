import { cn, compactNumber } from '../../lib/utils';
import { Card } from '../ui';

export function StatCard({ label, value, icon: Icon, hint, tone = 'brand', compact, className }) {
  const tones = {
    brand: 'bg-brand-500/12 text-brand-500',
    emerald: 'bg-emerald-500/12 text-emerald-500',
    blue: 'bg-blue-500/12 text-blue-500',
    amber: 'bg-amber-500/12 text-amber-500',
    rose: 'bg-rose-500/12 text-rose-500',
    slate: 'bg-slate-500/12 text-slate-500',
  };
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && (
          <div className={cn('grid h-9 w-9 place-items-center rounded-lg', tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-fg tabular-nums">
        {compact && typeof value === 'number' ? compactNumber(value) : value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export default StatCard;
