import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Sparkles, Wand2, Save, Check, Palette, Trash2, Image as ImageIcon, Loader2, RefreshCw,
  Copy, Tag, X, CheckSquare, Square,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import {
  Card, CardBody, Button, Input, Textarea, Field, Select, Modal, Badge, StatusBadge, EmptyState, Skeleton,
} from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, post, patch, del } from '../lib/api';
import { fmtDate, cn } from '../lib/utils';

const STYLES = ['minimalist', 'luxury editorial', 'vibrant', 'vintage', 'flatlay', 'lifestyle', 'studio'];
const MOODS = ['festive', 'calm', 'energetic', 'elegant', 'playful', 'premium', 'warm'];
const emptyBrief = { title: '', productRef: '', productId: '', style: '', mood: '', palette: '', notes: '', references: [] };

export default function BriefsPage() {
  const qc = useQueryClient();
  const { activeBrandId } = useActiveBrand();
  const [editing, setEditing] = useState(null);
  const [openBrief, setOpenBrief] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkTag, setBulkTag] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const params = new URLSearchParams({ brandId: activeBrandId || '' });
  if (tagFilter) params.set('tag', tagFilter);

  const { data: briefs, isLoading } = useQuery({
    // tagFilter belongs in the key, or a filtered view would serve cached rows.
    queryKey: ['briefs', activeBrandId, tagFilter],
    queryFn: () => get(`/briefs?${params.toString()}`),
    enabled: Boolean(activeBrandId),
  });

  const { data: tagFacets } = useQuery({
    queryKey: ['brief-tags', activeBrandId],
    queryFn: () => get(`/briefs/tags?brandId=${activeBrandId}`),
    enabled: Boolean(activeBrandId),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['briefs'] });
    qc.invalidateQueries({ queryKey: ['brief-tags'] });
  };

  const save = useMutation({
    mutationFn: (b) => post('/briefs', { ...b, brandId: activeBrandId, productId: b.productId || null }),
    onSuccess: () => { refresh(); setEditing(null); toast.success('Brief created'); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => del(`/briefs/${id}`),
    onSuccess: () => { refresh(); toast.success('Deleted'); },
  });
  const duplicate = useMutation({
    mutationFn: (id) => post(`/briefs/${id}/duplicate`),
    onSuccess: (copy) => { refresh(); toast.success(`Duplicated as \u201c${copy.title}\u201d`); },
    onError: (e) => toast.error(e.message),
  });
  const setTags = useMutation({
    mutationFn: ({ id, tags }) => patch(`/briefs/${id}`, { tags }),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const bulk = useMutation({
    mutationFn: ({ add = [], remove: rm = [] }) =>
      post('/briefs/bulk/tags', { ids: [...selected], add, remove: rm }),
    onSuccess: (res) => {
      refresh();
      setBulkTag('');
      toast.success(`${res.updated} updated${res.skipped ? ` \u00b7 ${res.skipped} unchanged` : ''}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Creative Briefs"
        description="Describe your product, style and mood — then generate on-brand visuals."
        icon={FileText}
        actions={<Button onClick={() => setEditing({ ...emptyBrief })} disabled={!activeBrandId}><Plus className="h-4 w-4" /> New Brief</Button>}
      />

      {tagFacets?.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-muted" />
          <button
            onClick={() => setTagFilter('')}
            className={cn('rounded-full px-2.5 py-0.5 text-xs', !tagFilter ? 'bg-brand-600 text-white' : 'bg-border/60 text-muted hover:text-fg')}
          >
            all
          </button>
          {tagFacets.map(({ tag, count }) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
              className={cn('rounded-full px-2.5 py-0.5 text-xs', tagFilter === tag ? 'bg-brand-600 text-white' : 'bg-border/60 text-muted hover:text-fg')}
            >
              {tag} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 p-3">
          <span className="text-sm font-medium text-fg">{selected.size} selected</span>
          <Input
            value={bulkTag}
            onChange={(e) => setBulkTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); bulk.mutate({ add: [bulkTag] }); } }}
            placeholder="tag name…"
            className="h-8 w-40 text-xs"
          />
          <Button size="sm" onClick={() => bulk.mutate({ add: [bulkTag] })} loading={bulk.isPending} disabled={!bulkTag.trim()}>
            <Tag className="h-3.5 w-3.5" /> Add tag
          </Button>
          <Button size="sm" variant="secondary" onClick={() => bulk.mutate({ remove: [bulkTag] })} loading={bulk.isPending} disabled={!bulkTag.trim()}>
            <X className="h-3.5 w-3.5" /> Remove tag
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>
      ) : briefs?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {briefs.map((b) => (
            <Card
              key={b.id}
              hover
              className={cn('group cursor-pointer', selected.has(b.id) && 'ring-2 ring-brand-500')}
              onClick={() => setOpenBrief(b)}
            >
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-500"><FileText className="h-5 w-5" /></div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={b.status} />
                    {/* stopPropagation, or selecting would also open the studio */}
                    <button
                      type="button"
                      aria-label="Select brief"
                      onClick={(e) => { e.stopPropagation(); toggle(b.id); }}
                      className="rounded-md p-1 text-muted transition hover:text-brand-500"
                    >
                      {selected.has(b.id) ? <CheckSquare className="h-4 w-4 text-brand-500" /> : <Square className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <h3 className="mt-3 flex items-center gap-2 font-display font-semibold text-fg">
                  {b.title}
                  {b.isDuplicate && <Badge className="bg-slate-500/12 text-slate-500">copy</Badge>}
                </h3>
                <p className="text-sm text-muted line-clamp-1">{b.productRef || b.product?.name || '—'}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {b.style && <Badge>{b.style}</Badge>}
                  {b.mood && <Badge className="bg-amber-500/12 text-amber-500">{b.mood}</Badge>}
                </div>
                {b.tags?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {b.tags.slice(0, 4).map((t) => (
                      <span key={t} className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] text-muted">{t}</span>
                    ))}
                    {b.tags.length > 4 && <span className="text-[10px] text-muted">+{b.tags.length - 4}</span>}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                  <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> {b._count?.assets || 0} assets</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Duplicate brief"
                      onClick={(e) => { e.stopPropagation(); duplicate.mutate(b.id); }}
                      className="rounded-md p-1 transition hover:bg-elevated hover:text-brand-500"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <span>{fmtDate(b.updatedAt)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card><EmptyState icon={FileText} title="No briefs yet" description="Create a creative brief to start generating visuals."
          action={<Button onClick={() => setEditing({ ...emptyBrief })} disabled={!activeBrandId}><Plus className="h-4 w-4" /> New Brief</Button>} /></Card>
      )}

      {editing && <BriefModal brief={editing} onClose={() => setEditing(null)} onSave={(b) => save.mutate(b)} saving={save.isPending} />}
      {openBrief && (
        <BriefStudio
          brief={openBrief}
          onClose={() => setOpenBrief(null)}
          onDelete={(id) => { remove.mutate(id); setOpenBrief(null); }}
          onDuplicate={(id) => { duplicate.mutate(id); setOpenBrief(null); }}
          onTags={(tags) => setTags.mutate({ id: openBrief.id, tags })}
          savingTags={setTags.isPending}
        />
      )}
    </div>
  );
}

function BriefModal({ brief, onClose, onSave, saving }) {
  const [form, setForm] = useState(brief);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title="New creative brief" size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(form)} loading={saving} disabled={!form.title}>Create brief</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Title"><Input value={form.title} onChange={set('title')} placeholder="Eid saree hero shot" /></Field></div>
        <div className="sm:col-span-2"><Field label="Product / subject"><Input value={form.productRef} onChange={set('productRef')} placeholder="Jamdani Handloom Saree" /></Field></div>
        <Field label="Style"><Select value={form.style} onChange={set('style')}><option value="">Choose…</option>{STYLES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Mood"><Select value={form.mood} onChange={set('mood')}><option value="">Choose…</option>{MOODS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <div className="sm:col-span-2"><Field label="Colour palette hint"><Input icon={Palette} value={form.palette} onChange={set('palette')} placeholder="alta red, gold, ivory" /></Field></div>
        <div className="sm:col-span-2"><Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} placeholder="Emphasise the gold border. Soft studio lighting." /></Field></div>
      </div>
    </Modal>
  );
}

function BriefStudio({ brief, onClose, onDelete, onDuplicate, onTags, savingTags }) {
  const qc = useQueryClient();
  const [size, setSize] = useState('portrait');
  const [count, setCount] = useState(2);
  const [result, setResult] = useState(null);

  const { data: full } = useQuery({ queryKey: ['brief', brief.id], queryFn: () => get(`/briefs/${brief.id}`) });
  const tags = full?.tags ?? brief.tags ?? [];

  const generate = useMutation({
    mutationFn: (force) => post(`/briefs/${brief.id}/generate`, { size, count, force }),
    onSuccess: (res) => {
      setResult(res);
      if (res.cached) toast('♻️ Served from prompt cache — no API call', { icon: '⚡' });
      else toast.success('Generated');
    },
    onError: (e) => toast.error(e.message),
  });

  const saveAsset = useMutation({
    mutationFn: (url) => post('/assets', { url, source: 'AI_GENERATED', prompt: result?.prompt, briefId: brief.id, brandId: brief.brandId, tags: [brief.style, brief.mood].filter(Boolean) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brief', brief.id] }); qc.invalidateQueries({ queryKey: ['briefs'] }); toast.success('Saved to library'); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title={brief.title} subtitle={brief.productRef || brief.product?.name} size="xl"
      footer={(
        <>
          <Button variant="ghost" className="mr-auto text-red-500" onClick={() => onDelete(brief.id)}><Trash2 className="h-4 w-4" /> Delete</Button>
          <Button variant="secondary" onClick={() => onDuplicate(brief.id)}><Copy className="h-4 w-4" /> Duplicate</Button>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>
      )}>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Controls */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-3 space-y-1.5 text-sm">
            {brief.style && <p><span className="text-muted">Style:</span> {brief.style}</p>}
            {brief.mood && <p><span className="text-muted">Mood:</span> {brief.mood}</p>}
            {brief.palette && <p><span className="text-muted">Palette:</span> {brief.palette}</p>}
            {brief.notes && <p className="text-muted">{brief.notes}</p>}
          </div>
          <TagEditor tags={tags} onChange={onTags} saving={savingTags} />
          <Field label="Aspect ratio">
            <Select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="square">Square 1:1</option>
              <option value="portrait">Portrait 4:5</option>
              <option value="story">Story 9:16</option>
              <option value="landscape">Landscape 5:4</option>
            </Select>
          </Field>
          <Field label="Variations"><Select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
          <Button className="w-full" onClick={() => generate.mutate(false)} loading={generate.isPending}><Sparkles className="h-4 w-4" /> Generate visuals</Button>
          {result && <Button variant="ghost" size="sm" className="w-full" onClick={() => generate.mutate(true)}><RefreshCw className="h-3.5 w-3.5" /> Regenerate (bypass cache)</Button>}
        </div>

        {/* Results + saved */}
        <div className="space-y-5">
          {generate.isPending && (
            <div className="grid h-48 place-items-center rounded-xl border border-dashed border-border">
              <div className="flex flex-col items-center gap-2 text-muted"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /><span className="text-sm">Generating…</span></div>
            </div>
          )}
          {result && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h4 className="font-medium text-fg">Candidates</h4>
                {result.cached && <Badge className="bg-amber-500/12 text-amber-500">⚡ from cache</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {result.images.map((im, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-xl border border-border">
                    <img src={im.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 grid place-items-center bg-slate-950/50 opacity-0 group-hover:opacity-100 transition">
                      <Button size="sm" onClick={() => saveAsset.mutate(im.url)} loading={saveAsset.isPending}><Save className="h-4 w-4" /> Save</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {full?.assets?.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium text-fg">In this brief’s library</h4>
              <div className="grid grid-cols-3 gap-2">
                {full.assets.map((a) => (
                  <div key={a.id} className="relative overflow-hidden rounded-lg border border-border">
                    <img src={a.thumbnailUrl || a.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                    <span className="absolute bottom-1 right-1 rounded bg-slate-950/70 px-1 text-[10px] text-white">v{a.version}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!result && !generate.isPending && !full?.assets?.length && (
            <EmptyState icon={Wand2} title="Ready to generate" description="Pick an aspect ratio and generate on-brand visuals from this brief." className="py-10" />
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Add/remove tags on one brief. Emits the WHOLE next array, so it's idempotent. */
function TagEditor({ tags = [], onChange, saving }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim().toLowerCase();
    setDraft('');
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
  };
  return (
    <div>
      <p className="label mb-1 flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Tags</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && <span className="text-xs text-muted">No tags yet.</span>}
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-border/60 px-2 py-0.5 text-xs text-muted">
            {t}
            <button type="button" aria-label={`Remove ${t}`} className="hover:text-red-500" onClick={() => onChange(tags.filter((x) => x !== t))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="add a tag…"
          className="h-8 text-xs"
        />
        <Button size="sm" variant="secondary" onClick={add} loading={saving} disabled={!draft.trim()}>Add</Button>
      </div>
    </div>
  );
}
