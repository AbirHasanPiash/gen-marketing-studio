import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, Wand2, Copy, Check, Hash, Megaphone, MessageSquareText, Loader2,
  RotateCcw, FilePlus2, History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { Card, CardHeader, CardBody, Button, Input, Textarea, Field, Select, Tabs, Badge } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { streamPost } from '../lib/stream';
import { get, post } from '../lib/api';
import { copyToClipboard, cn, timeAgo } from '../lib/utils';

const TONES = ['friendly', 'elegant', 'playful', 'bold', 'professional', 'festive', 'urgent'];
const KINDS = [
  { key: 'caption', label: 'Caption', icon: MessageSquareText },
  { key: 'ad_copy', label: 'Ad copy', icon: Megaphone },
  { key: 'hashtags', label: 'Hashtags', icon: Hash },
];
const EXAMPLES = [
  {
    label: 'Eid fashion',
    kind: 'caption',
    form: {
      product: 'Jamdani Saree Eid collection',
      tone: 'festive',
      platform: 'Instagram',
      details: 'New Eid arrival, premium handwoven fabric, elegant pastel colors, free delivery inside Dhaka, limited stock.',
    },
  },
  {
    label: 'Skincare launch',
    kind: 'ad_copy',
    form: {
      product: 'Organic skincare starter kit',
      tone: 'professional',
      platform: 'Facebook',
      details: 'Includes cleanser, moisturizer and sunscreen. Made for sensitive skin. 20% launch discount this week.',
    },
  },
  {
    label: 'Gift hashtags',
    kind: 'hashtags',
    form: {
      product: 'Handmade leather wallets',
      tone: 'bold',
      platform: 'Instagram',
      details: 'Made in Bangladesh, genuine leather, minimalist design, perfect gift for men.',
    },
  },
];

export default function CopyStudioPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeBrand, activeBrandId } = useActiveBrand();
  const [kind, setKind] = useState('caption');
  const [form, setForm] = useState({ product: '', tone: 'friendly', platform: 'Instagram', details: '' });
  const [streamText, setStreamText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [variations, setVariations] = useState([]);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const platformEnum = { Instagram: 'INSTAGRAM', Facebook: 'FACEBOOK', WhatsApp: 'WHATSAPP' };
  const cleanTags = (text = '') =>
    [...new Set((text.match(/#[A-Za-z0-9_]+/g) || []).map((t) => t.replace('#', '')))];

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['copy-history'],
    queryFn: () => get('/ai/copy/history'),
  });

  const runStream = () => {
    if (!form.product) return toast.error('Tell me what to write about');
    setStreamText('');
    setVariations([]);
    setStreaming(true);
    streamPost(
      '/ai/copy/stream',
      { kind: kind === 'hashtags' ? 'caption' : kind, ...form, brandName: activeBrand?.name },
      {
        onToken: (t) => setStreamText((s) => s + t),
        onDone: () => {
          setStreaming(false);
          qc.invalidateQueries({ queryKey: ['copy-history'] });
        },
        onError: (e) => { toast.error(e.message); setStreaming(false); },
      }
    );
    return undefined;
  };

  const variationsMut = useMutation({
    mutationFn: () => post('/ai/copy/variations', { kind, count: 5, input: { ...form, brandName: activeBrand?.name } }),
    onSuccess: (res) => {
      setStreamText('');
      setVariations(res.variations || []);
      qc.invalidateQueries({ queryKey: ['copy-history'] });
      toast.success('5 variations ready');
    },
    onError: (e) => toast.error(e.message),
  });

  const createPostMut = useMutation({
    mutationFn: ({ text, sourceKind = kind, sourceInput = form }) => {
      if (!activeBrandId) throw new Error('Select or create a brand before creating a post');
      const hashtags = cleanTags(text);
      return post('/posts', {
        brandId: activeBrandId,
        title: sourceInput.product ? `AI draft: ${sourceInput.product}` : 'AI copy draft',
        body: sourceKind === 'hashtags' ? '' : text,
        hashtags,
        mediaUrls: [],
        platforms: [platformEnum[sourceInput.platform] || 'INSTAGRAM'],
        scheduledAt: null,
        campaignId: null,
      });
    },
    onSuccess: (saved) => {
      toast.success('Draft post created');
      qc.invalidateQueries({ queryKey: ['calendar'] });
      navigate(`/posts/${saved.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const doCopy = (text, idx) => {
    copyToClipboard(text).then(() => {
      setCopiedIdx(idx);
      toast.success('Copied');
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Copy Studio"
        description="Generate captions, ad copy and hashtags with OpenRouter, then turn the best option into a draft post."
        icon={Sparkles}
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr_320px]">
        {/* Controls */}
        <Card className="h-fit">
          <CardBody className="space-y-4">
            <Tabs tabs={KINDS} value={kind} onChange={setKind} />
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <Button
                  key={example.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setKind(example.kind);
                    setForm(example.form);
                    setStreamText('');
                    setVariations([]);
                  }}
                >
                  {example.label}
                </Button>
              ))}
            </div>
            <Field label="What are you promoting?">
              <Input value={form.product} onChange={set('product')} placeholder="Jamdani Saree · Eid collection" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tone"><Select value={form.tone} onChange={set('tone')}>{TONES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
              <Field label="Platform"><Select value={form.platform} onChange={set('platform')}><option>Instagram</option><option>Facebook</option><option>WhatsApp</option></Select></Field>
            </div>
            <Field label="Extra details" hint="optional"><Textarea value={form.details} onChange={set('details')} placeholder="Free delivery before Eid, limited stock…" /></Field>
            <div className="flex gap-2">
              {kind !== 'hashtags' && (
                <Button className="flex-1" onClick={runStream} loading={streaming}><Wand2 className="h-4 w-4" /> Generate</Button>
              )}
              <Button variant={kind === 'hashtags' ? 'primary' : 'secondary'} className="flex-1" onClick={() => variationsMut.mutate()} loading={variationsMut.isPending}>
                <Sparkles className="h-4 w-4" /> 5 variations
              </Button>
            </div>
            {activeBrand && <p className="text-xs text-muted">Writing for <span className="font-medium text-fg">{activeBrand.name}</span></p>}
          </CardBody>
        </Card>

        {/* Output */}
        <div className="space-y-4">
          {kind !== 'hashtags' && (
            <Card>
              <CardHeader title="Live generation" subtitle="Streaming output" action={streamText && <Button variant="ghost" size="sm" onClick={() => doCopy(streamText, 'stream')}>{copiedIdx === 'stream' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy</Button>} />
              <CardBody>
                {streamText ? (
                  <>
                    <div className="whitespace-pre-wrap rounded-xl bg-elevated p-4 text-fg leading-relaxed">
                      {streamText}
                      {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand-500 align-middle" />}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => doCopy(streamText, 'stream')}>
                        {copiedIdx === 'stream' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
                      </Button>
                      <Button size="sm" onClick={() => createPostMut.mutate({ text: streamText })} loading={createPostMut.isPending}>
                        <FilePlus2 className="h-4 w-4" /> Use in post
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="grid h-32 place-items-center text-center text-muted">
                    {streaming ? <Loader2 className="h-6 w-6 animate-spin text-brand-500" /> : <p className="text-sm">Your generated copy will stream here</p>}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {variations.length > 0 && (
            <Card>
              <CardHeader title={`${variations.length} variations`} subtitle="Pick your favourite" action={<Button variant="ghost" size="sm" onClick={() => variationsMut.mutate()}><RotateCcw className="h-4 w-4" /> Regenerate</Button>} />
              <CardBody className="grid gap-3 sm:grid-cols-2">
                {variations.map((v, i) => (
                  <div key={i} className="group relative rounded-xl border border-border p-4 transition hover:border-brand-500/50">
                    <span className="absolute -top-2 -left-2 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
                    <p className={cn('whitespace-pre-wrap text-sm text-fg', kind === 'hashtags' && 'text-brand-500')}>{v}</p>
                    <div className="mt-3 flex flex-wrap gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                      <Button variant="ghost" size="sm" onClick={() => doCopy(v, i)}>
                        {copiedIdx === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
                      </Button>
                      <Button variant="subtle" size="sm" onClick={() => createPostMut.mutate({ text: v })} loading={createPostMut.isPending}>
                        <FilePlus2 className="h-3.5 w-3.5" /> Use
                      </Button>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {!streamText && !variations.length && (
            <Card><CardBody><div className="grid h-40 place-items-center text-center"><div><Sparkles className="mx-auto h-8 w-8 text-brand-500/50" /><p className="mt-2 text-sm text-muted">Fill in the details and generate your copy.</p></div></div></CardBody></Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="Recent AI copy" subtitle="Saved automatically" action={<History className="h-4 w-4 text-muted" />} />
          <CardBody className="space-y-3">
            {historyLoading && <div className="text-sm text-muted">Loading history...</div>}
            {!historyLoading && history.length === 0 && <p className="text-sm text-muted">Generated copy will appear here.</p>}
            {history.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge>{item.kind?.replace('_', ' ')}</Badge>
                  <span className="text-xs text-muted">{timeAgo(item.createdAt)}</span>
                </div>
                <p className="line-clamp-3 whitespace-pre-wrap text-sm text-fg">{item.variations?.[0]}</p>
                {item.variations?.[0] && (
                  <div className="mt-2 flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => doCopy(item.variations[0], item.id)}>
                      {copiedIdx === item.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
                    </Button>
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => createPostMut.mutate({ text: item.variations[0], sourceKind: item.kind, sourceInput: item.input || {} })}
                    >
                      <FilePlus2 className="h-3.5 w-3.5" /> Use
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
