import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Lightbulb, Sparkles, Plus, CalendarRange, Trash2, Wand2, ArrowRight, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { Card, CardHeader, CardBody, Button, Input, Textarea, Field, Modal, Badge, EmptyState, Skeleton } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, post, del } from '../lib/api';
import { fmtDate, cn } from '../lib/utils';

export default function CampaignsPage() {
  const qc = useQueryClient();
  const { activeBrandId } = useActiveBrand();
  const [creating, setCreating] = useState(false);

  const { data: suggestions, isLoading: loadingSug } = useQuery({
    queryKey: ['suggestions', activeBrandId],
    queryFn: () => post('/ai/campaigns/suggest', { brandId: activeBrandId, withinDays: 120, limit: 4 }),
    enabled: Boolean(activeBrandId),
  });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', activeBrandId],
    queryFn: () => get(`/campaigns?brandId=${activeBrandId}`),
    enabled: Boolean(activeBrandId),
  });

  const accept = useMutation({
    mutationFn: (s) => post('/ai/campaigns/accept', { momentKey: s.momentKey, brandId: activeBrandId, draftCaption: s.draftCaption, createDraftPost: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      toast.success('Campaign created with a draft post 🎉');
    },
    onError: (e) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: (c) => post('/campaigns', { ...c, brandId: activeBrandId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); setCreating(false); toast.success('Campaign created'); },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => del(`/campaigns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Deleted'); },
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Campaign Ideas" description="AI-suggested campaigns tuned to upcoming Bangladeshi retail moments." icon={Lightbulb}
        actions={<Button variant="secondary" onClick={() => setCreating(true)} disabled={!activeBrandId}><Plus className="h-4 w-4" /> New Campaign</Button>} />

      {/* Suggested */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-500" />
          <h2 className="font-display text-lg font-semibold text-fg">Suggested for you</h2>
          <Badge className="bg-brand-500/12 text-brand-500">upcoming moments</Badge>
        </div>
        {loadingSug ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {suggestions?.map((s) => (
              <Card key={s.momentKey} className="overflow-hidden flex flex-col">
                <div className="p-5 pb-3" style={{ background: `linear-gradient(135deg, ${s.colors?.[0]}22, ${s.colors?.[1] || s.colors?.[0]}11)` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{s.moment.emoji}</span>
                    <Badge className="bg-card/80 text-fg">in {s.startsInDays}d</Badge>
                  </div>
                  <h3 className="mt-2 font-display font-semibold text-fg">{s.moment.name}</h3>
                  <p className="text-xs text-muted">{s.moment.subtitle}</p>
                </div>
                <CardBody className="flex flex-1 flex-col pt-3">
                  <p className="text-sm text-fg line-clamp-3 flex-1">{s.draftCaption}</p>
                  <div className="mt-3 flex items-center gap-1">
                    {s.colors?.map((c) => <span key={c} className="h-4 w-4 rounded ring-1 ring-border" style={{ background: c }} />)}
                  </div>
                  <Button size="sm" className="mt-3 w-full" onClick={() => accept.mutate(s)} loading={accept.isPending && accept.variables?.momentKey === s.momentKey}>
                    <Wand2 className="h-3.5 w-3.5" /> Create campaign
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Existing */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-fg">Your campaigns</h2>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        ) : campaigns?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <Card key={c.id} hover>
                <CardBody>
                  <div className="flex items-start justify-between">
                    <span className="h-3 w-3 rounded-full" style={{ background: c.color || '#7c3aed' }} />
                    <button onClick={() => remove.mutate(c.id)} className="text-muted hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <h3 className="mt-2 font-display font-semibold text-fg">{c.name}</h3>
                  {c.theme && <Badge className="mt-1">{c.theme}</Badge>}
                  <p className="mt-2 text-sm text-muted line-clamp-2">{c.description}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" /> {c._count?.posts || 0} posts</span>
                    {c.isSuggested && <Badge className="bg-brand-500/12 text-brand-500">AI</Badge>}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <Card><EmptyState icon={Lightbulb} title="No campaigns yet" description="Accept a suggestion above or create one manually." /></Card>
        )}
      </section>

      {creating && <CampaignModal onClose={() => setCreating(false)} onSave={(c) => create.mutate(c)} saving={create.isPending} />}
    </div>
  );
}

function CampaignModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: '', theme: '', description: '', color: '#7c3aed' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title="New campaign" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(form)} loading={saving} disabled={!form.name}>Create</Button></>}>
      <div className="space-y-4">
        <Field label="Name"><Input value={form.name} onChange={set('name')} placeholder="Eid Collection 2026" /></Field>
        <Field label="Theme"><Input value={form.theme} onChange={set('theme')} placeholder="premium / festive" /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={set('description')} /></Field>
        <Field label="Colour"><input type="color" value={form.color} onChange={set('color')} className="h-10 w-20 rounded-lg border border-border bg-card" /></Field>
      </div>
    </Modal>
  );
}
