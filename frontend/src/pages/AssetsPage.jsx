import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Images, Search, Heart, Trash2, Download, Copy, Layers, Sparkles, Star, Filter, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import {
  Card, Button, Input, Select, Modal, Badge, EmptyState, Skeleton, Tabs,
} from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, post, patch, del } from '../lib/api';
import { fmtDate, copyToClipboard, cn } from '../lib/utils';

const SOURCE_TABS = [
  { key: '', label: 'All' },
  { key: 'AI_GENERATED', label: 'AI generated' },
  { key: 'UPLOAD', label: 'Uploads' },
  { key: 'COMPOSITED', label: 'Composites' },
];

export default function AssetsPage() {
  const qc = useQueryClient();
  const { activeBrandId } = useActiveBrand();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [open, setOpen] = useState(null);

  const params = new URLSearchParams({ brandId: activeBrandId || '', limit: '48' });
  if (search) params.set('search', search);
  if (source) params.set('source', source);
  if (favOnly) params.set('favorite', 'true');

  const { data, isLoading } = useQuery({
    queryKey: ['assets', activeBrandId, search, source, favOnly],
    queryFn: () => get(`/assets?${params.toString()}`),
    enabled: Boolean(activeBrandId),
  });
  const assets = data?.data || data || [];

  const fav = useMutation({
    mutationFn: ({ id, isFavorite }) => patch(`/assets/${id}`, { isFavorite }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Library"
        description="Every generated visual, versioned and searchable alongside its prompt."
        icon={Images}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input icon={Search} placeholder="Search by prompt or tag…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        <div className="flex items-center gap-2">
          <Tabs tabs={SOURCE_TABS} value={source} onChange={setSource} />
          <Button variant={favOnly ? 'primary' : 'secondary'} size="sm" onClick={() => setFavOnly((v) => !v)}>
            <Heart className={cn('h-4 w-4', favOnly && 'fill-current')} /> Favorites
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : assets.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {assets.map((a) => (
            <div key={a.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-elevated">
              <img src={a.thumbnailUrl || a.url} alt="" className="h-full w-full object-cover cursor-pointer transition group-hover:scale-105" loading="lazy" onClick={() => setOpen(a)} />
              <button
                onClick={() => fav.mutate({ id: a.id, isFavorite: !a.isFavorite })}
                className={cn('absolute top-2 right-2 rounded-lg p-1.5 backdrop-blur transition', a.isFavorite ? 'bg-rose-500 text-white' : 'bg-slate-950/40 text-white opacity-0 group-hover:opacity-100')}
              >
                <Heart className={cn('h-3.5 w-3.5', a.isFavorite && 'fill-current')} />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-slate-950/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                {a._count?.versions > 0 && <span className="flex items-center gap-0.5 rounded bg-slate-950/60 px-1.5 py-0.5 text-[10px] text-white"><Layers className="h-3 w-3" /> v{a.version}</span>}
                {a.source === 'AI_GENERATED' && <Sparkles className="h-3.5 w-3.5 text-white" />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card><EmptyState icon={Images} title="No assets found" description="Generate visuals from a brief or the Image Studio to fill your library." /></Card>
      )}

      {open && <AssetModal asset={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AssetModal({ asset, onClose }) {
  const qc = useQueryClient();
  const { data: full } = useQuery({ queryKey: ['asset', asset.id], queryFn: () => get(`/assets/${asset.id}`) });
  const [active, setActive] = useState(asset);

  const versions = [full, ...(full?.versions || [])].filter(Boolean);

  const remove = useMutation({
    mutationFn: (id) => del(`/assets/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Deleted'); onClose(); },
  });

  return (
    <Modal open onClose={onClose} title="Asset detail" size="xl"
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-red-500" onClick={() => remove.mutate(active.id)}><Trash2 className="h-4 w-4" /> Delete</Button>
          <a href={active.url} target="_blank" rel="noreferrer" download><Button variant="secondary"><Download className="h-4 w-4" /> Open</Button></a>
        </>
      }>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-elevated">
          <img src={active.url} alt="" className="w-full object-contain max-h-[60vh]" />
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge>{active.source?.replace('_', ' ').toLowerCase()}</Badge>
            <Badge className="bg-slate-500/12 text-slate-500">version {active.version}</Badge>
            {active.isFavorite && <Badge className="bg-rose-500/12 text-rose-500"><Star className="h-3 w-3" /> favorite</Badge>}
          </div>
          {active.prompt && (
            <div>
              <p className="label">Prompt</p>
              <div className="rounded-xl bg-elevated p-3 text-sm text-fg">{active.prompt}</div>
              <Button variant="ghost" size="sm" className="mt-1.5" onClick={() => copyToClipboard(active.prompt).then(() => toast.success('Prompt copied'))}><Copy className="h-3.5 w-3.5" /> Copy prompt</Button>
            </div>
          )}
          {active.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{active.tags.map((t) => <span key={t} className="rounded-full bg-border/60 px-2 py-0.5 text-xs text-muted">{t}</span>)}</div>
          )}
          <p className="text-xs text-muted">Created {fmtDate(active.createdAt)}</p>

          {versions.length > 1 && (
            <div>
              <p className="label flex items-center gap-1.5"><Layers className="h-4 w-4" /> Versions ({versions.length})</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {versions.map((v) => (
                  <button key={v.id} onClick={() => setActive(v)}
                    className={cn('relative shrink-0 overflow-hidden rounded-lg border-2 transition', active.id === v.id ? 'border-brand-500' : 'border-transparent hover:border-border')}>
                    <img src={v.thumbnailUrl || v.url} alt="" className="h-16 w-16 object-cover" />
                    <span className="absolute bottom-0 right-0 rounded-tl bg-slate-950/70 px-1 text-[9px] text-white">v{v.version}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
