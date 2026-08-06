import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link2, Plus, Trash2, GripVertical, Save, ExternalLink, Copy, Eye, EyeOff, ArrowUp, ArrowDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { ImageUploader } from '../components/shared/ImageUploader';
import { Card, CardHeader, CardBody, Button, Input, Textarea, Field, Switch, EmptyState } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, put } from '../lib/api';
import { copyToClipboard, cn } from '../lib/utils';

const emptyState = { title: '', bio: '', avatarUrl: '', slug: '', published: false, theme: { bg: '#1D3557', accent: '#E9C46A' }, links: [] };

export default function LinkBioBuilderPage() {
  const qc = useQueryClient();
  const { activeBrandId, activeBrand } = useActiveBrand();
  const [state, setState] = useState(emptyState);

  const { data } = useQuery({
    queryKey: ['linkbio', activeBrandId],
    queryFn: () => get(`/linkbio/${activeBrandId}`),
    enabled: Boolean(activeBrandId),
  });

  useEffect(() => {
    if (data) setState({ ...emptyState, ...data, theme: data.theme || emptyState.theme, links: data.links || [] });
    else if (activeBrand) setState((s) => ({ ...s, title: s.title || activeBrand.name, avatarUrl: s.avatarUrl || activeBrand.logoUrl || '' }));
  }, [data, activeBrand]);

  const save = useMutation({
    mutationFn: () => put(`/linkbio/${activeBrandId}`, {
      title: state.title, bio: state.bio, avatarUrl: state.avatarUrl, slug: state.slug || undefined,
      theme: state.theme, published: state.published,
      links: state.links.map((l, i) => ({ id: l.id, label: l.label, url: l.url, icon: l.icon, order: i, isActive: l.isActive !== false })),
    }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['linkbio'] }); setState((s) => ({ ...s, slug: res.slug, links: res.links })); toast.success('Link-in-bio saved'); },
    onError: (e) => toast.error(e.message),
  });

  const setLink = (i, key, val) => setState((s) => ({ ...s, links: s.links.map((l, x) => (x === i ? { ...l, [key]: val } : l)) }));
  const addLink = () => setState((s) => ({ ...s, links: [...s.links, { label: '', url: '', isActive: true }] }));
  const removeLink = (i) => setState((s) => ({ ...s, links: s.links.filter((_, x) => x !== i) }));
  const move = (i, dir) => setState((s) => {
    const arr = [...s.links];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return s;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...s, links: arr };
  });

  const publicUrl = state.slug ? `${window.location.origin}/l/${state.slug}` : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Link-in-Bio" description="A public mini landing page for your brand’s bio link." icon={Link2}
        actions={
          <>
            {publicUrl && <Button variant="secondary" onClick={() => copyToClipboard(publicUrl).then(() => toast.success('Link copied'))}><Copy className="h-4 w-4" /> Copy link</Button>}
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!activeBrandId}><Save className="h-4 w-4" /> Save</Button>
          </>
        } />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Page details" action={<Switch checked={state.published} onChange={(v) => setState({ ...state, published: v })} label={state.published ? 'Published' : 'Draft'} />} />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                <Field label="Avatar"><ImageUploader value={state.avatarUrl} onChange={(url) => setState({ ...state, avatarUrl: url })} folder="linkbio" aspect="aspect-square" /></Field>
                <div className="space-y-4">
                  <Field label="Title"><Input value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} placeholder="Nokshi Threads" /></Field>
                  <Field label="Handle" hint="your public URL slug"><Input value={state.slug} onChange={(e) => setState({ ...state, slug: e.target.value })} placeholder="nokshi-threads" /></Field>
                </div>
              </div>
              <Field label="Bio"><Textarea value={state.bio || ''} onChange={(e) => setState({ ...state, bio: e.target.value })} placeholder="Handwoven heritage, reimagined. Dhaka 🇧🇩" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Background"><input type="color" value={state.theme.bg} onChange={(e) => setState({ ...state, theme: { ...state.theme, bg: e.target.value } })} className="h-10 w-full rounded-lg border border-border" /></Field>
                <Field label="Accent"><input type="color" value={state.theme.accent} onChange={(e) => setState({ ...state, theme: { ...state.theme, accent: e.target.value } })} className="h-10 w-full rounded-lg border border-border" /></Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Links" action={<Button size="sm" variant="subtle" onClick={addLink}><Plus className="h-4 w-4" /> Add link</Button>} />
            <CardBody className="space-y-2">
              {state.links.length ? state.links.map((l, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-border p-2">
                  <div className="flex flex-col">
                    <button onClick={() => move(i, -1)} className="text-muted hover:text-fg"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => move(i, 1)} className="text-muted hover:text-fg"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <Input value={l.label} onChange={(e) => setLink(i, 'label', e.target.value)} placeholder="Button label" />
                    <Input value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} placeholder="https://…" />
                  </div>
                  <button onClick={() => removeLink(i)} className="text-muted hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              )) : <EmptyState icon={Link2} title="No links yet" description="Add buttons that appear on your page." className="py-8" />}
            </CardBody>
          </Card>
        </div>

        {/* Live phone preview */}
        <div className="lg:sticky lg:top-24 h-fit">
          <p className="mb-3 text-center text-sm text-muted">Live preview</p>
          <div className="mx-auto w-[300px] rounded-[2.5rem] border-8 border-slate-800 bg-slate-800 shadow-card">
            <div className="relative overflow-hidden rounded-[2rem]" style={{ background: state.theme.bg, minHeight: 560 }}>
              <div className="flex flex-col items-center px-6 py-10 text-center">
                {state.avatarUrl ? (
                  <img src={state.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-white/20" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-white/20" />
                )}
                <h3 className="mt-4 font-display text-lg font-bold text-white">{state.title || 'Your brand'}</h3>
                {state.bio && <p className="mt-1 text-sm text-white/70">{state.bio}</p>}
                <div className="mt-6 w-full space-y-3">
                  {state.links.filter((l) => l.isActive !== false && l.label).map((l, i) => (
                    <div key={i} className="rounded-xl px-4 py-3 text-sm font-medium text-center transition"
                      style={{ background: state.theme.accent, color: '#111' }}>
                      {l.label || 'Link'}
                    </div>
                  ))}
                  {!state.links.some((l) => l.label) && <p className="text-xs text-white/40">Add links to see them here</p>}
                </div>
              </div>
              {!state.published && (
                <div className="absolute top-2 right-2 rounded-full bg-slate-950/50 px-2 py-0.5 text-[10px] text-white/80">Draft</div>
              )}
            </div>
          </div>
          {publicUrl && state.published && (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 text-sm text-brand-500 hover:underline">
              <ExternalLink className="h-4 w-4" /> View live page
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
