import { Link } from 'react-router-dom';
import { ChevronsUpDown, Check, Plus, Store } from 'lucide-react';
import { Menu, MenuItem, Avatar } from '../ui';
import { useActiveBrand } from '../../hooks/useBrands';
import { cn } from '../../lib/utils';

export function BrandSwitcher() {
  const { brands, activeBrand, setActiveBrand } = useActiveBrand();

  return (
    <Menu
      align="left"
      width="w-64"
      trigger={(open) => (
        <button
          className={cn(
            'flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-1.5 transition hover:bg-elevated max-w-[220px]',
            open && 'ring-2 ring-brand-500/30'
          )}
        >
          {activeBrand ? (
            <>
              <Avatar name={activeBrand.name} src={activeBrand.logoUrl} size="sm" />
              <span className="truncate text-sm font-medium text-fg">{activeBrand.name}</span>
            </>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted px-1">
              <Store className="h-4 w-4" /> Select brand
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 text-muted shrink-0" />
        </button>
      )}
    >
      <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted/70">Your brands</p>
      {brands.map((b) => (
        <MenuItem key={b.id} onClick={() => setActiveBrand(b.id)}>
          <Avatar name={b.name} src={b.logoUrl} size="xs" />
          <span className="flex-1 truncate">{b.name}</span>
          {activeBrand?.id === b.id && <Check className="h-4 w-4 text-brand-500" />}
        </MenuItem>
      ))}
      <div className="my-1 border-t border-border" />
      <Link to="/brands">
        <MenuItem icon={Plus}>Manage brands</MenuItem>
      </Link>
    </Menu>
  );
}

export default BrandSwitcher;
