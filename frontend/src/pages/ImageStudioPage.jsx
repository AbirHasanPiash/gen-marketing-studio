import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ImagePlus, Sparkles, Save, Database, Zap, RefreshCw, TrendingUp, Loader2, Wand2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { Card, CardHeader, CardBody, Button, Textarea, Field, Select, Badge, EmptyState } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, post } from '../lib/api';
import { timeAgo, truncate, cn } from '../lib/utils';

const SIZES = [
  { key: 'square', label: 'Square 1:1' },
  { key: 'portrait', label: 'Portrait 4:5' },
  { key: 'story', label: 'Story 9:16' },
  { key: 'landscape', label: 'Landscape 5:4' },
];

export default function ImageStudioPage() {
  const qc = useQueryClient();
  const { activeBrandId, activeBrand } = useActiveBrand();
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('square');
  const [count, setCount] = useState(2);
  const [result, setResult] = useState(null);

  const { data: cache } = useQuery({ queryKey: ['prompt-cache'], queryFn: () => get('/assets/cache') });

  const generate = useMutation({
    mutationFn: (force) => post('/assets/generate', { prompt, size, count, force }),
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ['prompt-cache'] });
      if (res.cached) toast('⚡ Prompt cache hit — no API call made', { icon: '♻️' });
      else toast.success('Images generated');
    },
    onError: (e) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: (url) => post('/assets', { url, source: 'AI_GENERATED', prompt: result?.prompt, brandId: activeBrandId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Saved to library'); },
    onError: (e) => toast.error(e.message),
  });

  const boost = useMutation({
    mutationFn: (id) => post(`/assets/cache/${id}/boost`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prompt-cache'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Image Studio" description="Text-to-image generation with a smart caching layer that avoids redundant API calls." icon={ImagePlus} />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Controls + cache */}
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-4">
              <Field label="Prompt">
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="A handwoven jamdani saree on a marble surface, festive alta-red and gold, soft studio lighting…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Aspect"><Select value={size} onChange={(e) => setSize(e.target.value)}>{SIZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></Field>
                <Field label="Count"><Select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} images</option>)}</Select></Field>
              </div>
              <Button className="w-full" onClick={() => generate.mutate(false)} loading={generate.isPending} disabled={prompt.length < 3}>
                <Sparkles className="h-4 w-4" /> Generate
              </Button>
              {result && <Button variant="ghost" size="sm" className="w-full" onClick={() => generate.mutate(true)}><RefreshCw className="h-3.5 w-3.5" /> Regenerate (bypass cache)</Button>}
            </CardBody>
          </Card>

          {/* Prompt cache (Feature 7) */}
          <Card>
            <CardHeader title="Prompt cache" subtitle="High-performing, reusable prompts" action={<Database className="h-4 w-4 text-muted" />} />
            <CardBody className="space-y-2">
              {cache?.length ? (
                cache.slice(0, 8).map((c) => (
                  <div key={c.id} className="rounded-xl border border-border p-2.5 transition hover:border-brand-500/40">
                    <p className="text-sm text-fg line-clamp-2">{truncate(c.prompt, 80)}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge className="bg-blue-500/12 text-blue-500"><Zap className="h-3 w-3" /> {c.hitCount} hits</Badge>
                      {c.performance > 0 && <Badge className="bg-emerald-500/12 text-emerald-500"><TrendingUp className="h-3 w-3" /> {c.performance}</Badge>}
                      <button onClick={() => setPrompt(c.prompt)} className="ml-auto text-xs text-brand-500 hover:underline">Reuse</button>
                      <button onClick={() => boost.mutate(c.id)} className="text-xs text-muted hover:text-emerald-500" title="Mark high-performing">★</button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-muted">Generated prompts are cached here to save API calls.</p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Output */}
        <Card className="min-h-[400px]">
          <CardHeader
            title="Generated images"
            subtitle={result ? `${result.provider}${result.cached ? ' · from cache' : ''}` : 'Your candidates appear here'}
            action={result?.cached && <Badge className="bg-amber-500/12 text-amber-500"><Zap className="h-3 w-3" /> cache hit</Badge>}
          />
          <CardBody>
            {generate.isPending ? (
              <div className="grid h-80 place-items-center">
                <div className="flex flex-col items-center gap-2 text-muted"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /><span className="text-sm">Painting your idea…</span></div>
              </div>
            ) : result?.images?.length ? (
              <div className={cn('grid gap-4', result.images.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-2')}>
                {result.images.map((im, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-xl border border-border bg-elevated">
                    <img src={im.url} alt="" className={cn('w-full object-cover', size === 'story' ? 'aspect-[9/16]' : size === 'portrait' ? 'aspect-[4/5]' : size === 'landscape' ? 'aspect-[5/4]' : 'aspect-square')} loading="lazy" />
                    <div className="absolute inset-0 grid place-items-center bg-slate-950/50 opacity-0 group-hover:opacity-100 transition">
                      <Button size="sm" onClick={() => save.mutate(im.url)} loading={save.isPending}><Save className="h-4 w-4" /> Save to library</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Wand2} title="Describe your visual" description="Write a prompt and generate on-brand images. Identical prompts are served instantly from cache." className="py-16" />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
