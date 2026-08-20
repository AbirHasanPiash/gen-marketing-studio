import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Send, CheckCircle2, XCircle, CalendarClock, Rocket, RefreshCw, Hash,
  Wand2, MessageCircle, History, Copy, Trash2, X, Undo2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { ImageUploader } from '../components/shared/ImageUploader';
import { RejectDialog } from '../components/shared/RejectDialog';
import {
  Card, CardHeader, CardBody, Button, Input, Textarea, Field, Select, StatusBadge, PlatformDot,
  Modal, UnderlineTabs, Avatar, Spinner,
} from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { useAuth } from '../store/auth';
import { get, post, patch, del } from '../lib/api';
import { PLATFORM_META, fmtDateTime, timeAgo, copyToClipboard, cn } from '../lib/utils';

const PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP'];
const toLocalInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  const off = dt.getTimezoneOffset();
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
};

export default function PostEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { activeBrandId } = useActiveBrand();
  const { user } = useAuth();

  const [form, setForm] = useState({
    title: '', body: '', hashtags: [], mediaUrls: [], platforms: ['FACEBOOK', 'INSTAGRAM'],
    scheduledAt: params.get('date') ? toLocalInput(params.get('date')) : '', campaignId: '',
  });
  const [hashtagInput, setHashtagInput] = useState('');
  const [waModal, setWaModal] = useState(null);
  const [adaptTab, setAdaptTab] = useState('FACEBOOK');

  const { data: post_, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => get(`/posts/${id}`),
    enabled: !isNew,
  });
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', activeBrandId],
    queryFn: () => get(`/campaigns?brandId=${activeBrandId}`),
    enabled: Boolean(activeBrandId),
  });

  useEffect(() => {
    if (post_) {
      setForm({
        title: post_.title || '', body: post_.body || '', hashtags: post_.hashtags || [],
        mediaUrls: post_.mediaUrls || [], platforms: post_.platforms || [],
        scheduledAt: toLocalInput(post_.scheduledAt), campaignId: post_.campaignId || '',
      });
    }
  }, [post_]);

  const status = post_?.status || 'DRAFT';
  const isOwner = user?.role === 'OWNER';
  const locked = ['PUBLISHING', 'PUBLISHED'].includes(status);

  const buildBody = () => ({
    ...form,
    scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
    campaignId: form.campaignId || null,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isNew && !activeBrandId) {
        throw new Error('Select or create a brand before saving a post');
      }
      if (isNew) return post('/posts', { ...buildBody(), brandId: activeBrandId });
      return patch(`/posts/${id}`, buildBody());
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['post', id] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      toast.success('Saved');
      if (isNew) navigate(`/posts/${saved.id}`, { replace: true });
    },
    onError: (e) => toast.error(e.message),
  });

  const action = useMutation({
    mutationFn: async ({ verb, payload }) => {
      if (!isNew) await patch(`/posts/${id}`, buildBody()); // persist edits first
      return post(`/posts/${id}/${verb}`, payload || {});
    },
    onSuccess: (_, { verb }) => {
      qc.invalidateQueries({ queryKey: ['post', id] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast.success(`Post ${verb}${verb.endsWith('e') ? 'd' : 'ed'}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const adapt = useMutation({
    mutationFn: () => post(`/posts/${id}/adapt`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['post', id] }); toast.success('Adapted for each platform'); },
    onError: (e) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: () => del(`/posts/${id}`),
    onSuccess: () => { toast.success('Post deleted'); navigate('/calendar'); },
  });

  const openWhatsApp = async () => {
    try {
      const res = await get(`/posts/${id}/whatsapp`);
      setWaModal(res);
    } catch (e) {
      toast.error(e.message || 'Could not prepare WhatsApp message');
    }
  };

  const addHashtag = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && hashtagInput.trim()) {
      e.preventDefault();
      const tag = hashtagInput.replace(/[#,\s]/g, '');
      if (tag && !form.hashtags.includes(tag)) setForm({ ...form, hashtags: [...form.hashtags, tag] });
      setHashtagInput('');
    }
  };

  const togglePlatform = (p) =>
    setForm({ ...form, platforms: form.platforms.includes(p) ? form.platforms.filter((x) => x !== p) : [...form.platforms, p] });

  const addMedia = (url) => url && setForm({ ...form, mediaUrls: [...form.mediaUrls, url].slice(0, 4) });
  const removeMedia = (i) => setForm({ ...form, mediaUrls: form.mediaUrls.filter((_, x) => x !== i) });

  if (!isNew && isLoading) {
    return <div className="grid h-64 place-items-center"><Spinner className="h-8 w-8" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-bold text-fg truncate">{isNew ? 'New Post' : form.title || 'Untitled post'}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {!isNew && <StatusBadge status={status} />}
            {post_?.author && <span className="text-xs text-muted">by {post_.author.name}</span>}
          </div>
        </div>
        {!locked && <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending}><Save className="h-4 w-4" /> Save</Button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-4">
              <Field label="Title"><Input value={form.title} disabled={locked} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Give this post a title" /></Field>
              <Field label="Caption / body">
                <Textarea rows={6} disabled={locked} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write your caption…" className="min-h-[140px]" />
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <Link to="/copy" className="text-brand-500 hover:underline flex items-center gap-1"><Wand2 className="h-3 w-3" /> Write with AI</Link>
                  <span>{form.body.length} chars</span>
                </div>
              </Field>

              <Field label="Hashtags">
                <Input icon={Hash} value={hashtagInput} disabled={locked} onChange={(e) => setHashtagInput(e.target.value)} onKeyDown={addHashtag} placeholder="Type a tag and press Enter" />
                {form.hashtags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.hashtags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs text-brand-500">
                        #{t}
                        {!locked && <button onClick={() => setForm({ ...form, hashtags: form.hashtags.filter((x) => x !== t) })}><X className="h-3 w-3" /></button>}
                      </span>
                    ))}
                  </div>
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Media" subtitle="Up to 4 images" />
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {form.mediaUrls.map((url, i) => (
                  <div key={i} className="relative group aspect-square overflow-hidden rounded-xl border border-border">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {!locked && (
                      <button onClick={() => removeMedia(i)} className="absolute top-1.5 right-1.5 rounded-lg bg-slate-950/60 p-1 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {!locked && form.mediaUrls.length < 4 && <ImageUploader value="" onChange={addMedia} folder="posts" aspect="aspect-square" />}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publishing settings */}
          <Card>
            <CardHeader title="Settings" />
            <CardBody className="space-y-4">
              <Field label="Platforms">
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const on = form.platforms.includes(p);
                    return (
                      <button key={p} disabled={locked} onClick={() => togglePlatform(p)}
                        className={cn('inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition',
                          on ? 'border-brand-500 bg-brand-500/10 text-fg' : 'border-border text-muted hover:bg-elevated')}>
                        <PlatformDot platform={p} /> {PLATFORM_META[p].label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Campaign">
                <Select value={form.campaignId} disabled={locked} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                  <option value="">No campaign</option>
                  {campaigns?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Schedule date">
                <Input type="datetime-local" disabled={locked} value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
              </Field>
            </CardBody>
          </Card>

          {/* Lifecycle actions */}
          {!isNew && (
            <Card>
              <CardHeader title="Workflow" subtitle="Approval & publishing" />
              <CardBody className="space-y-2">
                {post_?.rejectReason && status === 'REJECTED' && (
                  <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">
                    <p className="font-medium">Changes requested</p>
                    <p className="text-rose-500/80">{post_.rejectReason}</p>
                  </div>
                )}
                <LifecycleActions status={status} isOwner={isOwner} form={form} action={action} openWhatsApp={openWhatsApp} />
                <button onClick={() => removeMut.mutate()} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm text-red-500 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" /> Delete post
                </button>
              </CardBody>
            </Card>
          )}

          {/* Platform adaptation (Feature 11) */}
          {!isNew && (
            <Card>
              <CardHeader title="Multi-platform" action={<Button size="sm" variant="subtle" onClick={() => adapt.mutate()} loading={adapt.isPending}><Wand2 className="h-3.5 w-3.5" /> Adapt</Button>} />
              <CardBody>
                {post_?.platformCopy ? (
                  <>
                    <UnderlineTabs tabs={[{ key: 'FACEBOOK', label: 'Facebook' }, { key: 'INSTAGRAM', label: 'Instagram' }]} value={adaptTab} onChange={setAdaptTab} className="mb-3" />
                    <div className="rounded-xl bg-elevated p-3 text-sm text-fg whitespace-pre-wrap">{post_.platformCopy[adaptTab]}</div>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => copyToClipboard(post_.platformCopy[adaptTab]).then(() => toast.success('Copied'))}>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted">Auto-generate Facebook & Instagram variants from one idea.</p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Activity */}
          {!isNew && post_?.activities?.length > 0 && (
            <Card>
              <CardHeader title="Activity" />
              <CardBody className="space-y-3">
                {post_.activities.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex gap-2.5 text-sm">
                    <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-elevated"><History className="h-3.5 w-3.5 text-muted" /></div>
                    <div>
                      <p className="text-fg"><span className="font-medium">{a.actor?.name}</span> · {a.action?.toLowerCase().replace('_', ' ')}</p>
                      <p className="text-xs text-muted">{timeAgo(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* WhatsApp export modal (Feature 12) */}
      <Modal open={Boolean(waModal)} onClose={() => setWaModal(null)} title="Push to WhatsApp" size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => copyToClipboard(waModal?.text).then(() => toast.success('Copied for WhatsApp'))}><Copy className="h-4 w-4" /> Copy</Button>
            <a href={waModal?.waLink} target="_blank" rel="noreferrer"><Button variant="success"><MessageCircle className="h-4 w-4" /> Open WhatsApp</Button></a>
          </>
        }>
        <p className="mb-2 text-sm text-muted">Formatted for WhatsApp — copy it or open WhatsApp with the message ready.</p>
        <pre className="whitespace-pre-wrap rounded-xl bg-elevated p-4 text-sm text-fg font-sans">{waModal?.text}</pre>
      </Modal>
    </div>
  );
}

function ActBtn({ children, ...props }) {
  return <Button className="w-full justify-start" {...props}>{children}</Button>;
}

function LifecycleActions({ status, isOwner, form, action, openWhatsApp }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const run = (verb, payload) => action.mutate({ verb, payload });
  const scheduleNow = () => {
    if (!form.scheduledAt) return toast.error('Pick a schedule date first');
    run('schedule', { scheduledAt: new Date(form.scheduledAt).toISOString() });
  };
  const reject = (reason) => {
    setRejectOpen(false);
    run('reject', { reason });
  };

  return (
    <div className="space-y-2">
      {(status === 'DRAFT' || status === 'REJECTED') && (
        <ActBtn variant="primary" onClick={() => run('submit')} loading={action.isPending}><Send className="h-4 w-4" /> Submit for review</ActBtn>
      )}
      {status === 'PENDING_REVIEW' && isOwner && (
        <>
          <ActBtn variant="success" onClick={() => run('approve')} loading={action.isPending}><CheckCircle2 className="h-4 w-4" /> Approve</ActBtn>
          <ActBtn variant="danger" onClick={() => setRejectOpen(true)}><XCircle className="h-4 w-4" /> Request changes</ActBtn>
        </>
      )}
      {status === 'PENDING_REVIEW' && !isOwner && (
        <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-600">Waiting for an owner to review.</p>
      )}
      {(status === 'APPROVED' || status === 'SCHEDULED') && isOwner && (
        <>
          <ActBtn variant="primary" onClick={scheduleNow} loading={action.isPending}><CalendarClock className="h-4 w-4" /> {status === 'SCHEDULED' ? 'Reschedule' : 'Schedule'}</ActBtn>
          {status === 'SCHEDULED' && <ActBtn variant="secondary" onClick={() => run('unschedule')}><Undo2 className="h-4 w-4" /> Unschedule</ActBtn>}
          <ActBtn variant="success" onClick={() => run('publish')}><Rocket className="h-4 w-4" /> Publish now</ActBtn>
        </>
      )}
      {status === 'FAILED' && isOwner && (
        <ActBtn variant="primary" onClick={() => run('retry')}><RefreshCw className="h-4 w-4" /> Retry publishing</ActBtn>
      )}
      <ActBtn variant="secondary" onClick={openWhatsApp}><MessageCircle className="h-4 w-4" /> Push to WhatsApp</ActBtn>
      <RejectDialog open={rejectOpen} onClose={() => setRejectOpen(false)} onSubmit={reject} loading={action.isPending} />
    </div>
  );
}
