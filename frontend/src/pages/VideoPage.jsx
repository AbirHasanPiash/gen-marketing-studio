import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clapperboard, Plus, Play, Loader2, Trash2, Music, AlertTriangle, Film, X, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { ImageUploader } from '../components/shared/ImageUploader';
import { Card, CardBody, Button, Input, Field, Select, Modal, StatusBadge, EmptyState, Skeleton } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, post, del } from '../lib/api';
import { fmtDate, cn } from '../lib/utils';

export default function VideoPage() {
  const qc = useQueryClient();
  const { activeBrandId } = useActiveBrand();
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState(null);

  const { data: videos, isLoading } = useQuery({
    queryKey: ['videos', activeBrandId],
    queryFn: () => get(`/videos?brandId=${activeBrandId}`),
    enabled: Boolean(activeBrandId),
    refetchInterval: (q) => (q.state.data?.some((v) => v.status === 'RENDERING') ? 4000 : false),
  });

  const create = useMutation({
    mutationFn: (v) => post('/videos', { ...v, brandId: activeBrandId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['videos'] }); setCreating(false); toast.success('Video project created'); },
    onError: (e) => toast.error(e.message),
  });
  const render = useMutation({
    mutationFn: (id) => post(`/videos/${id}/render`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['videos'] }); toast('Rendering started…', { icon: '🎬' }); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => del(`/videos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['videos'] }); toast.success('Deleted'); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Video Studio" description="Stitch product images, captions and audio into short promo reels (server-side FFmpeg)." icon={Clapperboard}
        actions={<Button onClick={() => setCreating(true)} disabled={!activeBrandId}><Plus className="h-4 w-4" /> New Reel</Button>} />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
      ) : videos?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <div className="relative aspect-[9/16] max-h-72 bg-elevated overflow-hidden">
                {v.status === 'READY' && v.outputUrl ? (
                  <button onClick={() => setPreview(v)} className="group h-full w-full">
                    <img src={v.images?.[0]} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 grid place-items-center bg-slate-950/30 group-hover:bg-slate-950/50 transition">
                      <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-brand-700"><Play className="h-6 w-6 fill-current" /></span>
                    </div>
                  </button>
                ) : (
                  <>
                    {v.images?.[0] && <img src={v.images[0]} alt="" className="h-full w-full object-cover opacity-60" />}
                    <div className="absolute inset-0 grid place-items-center">
                      {v.status === 'RENDERING' ? (
                        <div className="flex flex-col items-center gap-2 text-white"><Loader2 className="h-8 w-8 animate-spin" /><span className="text-sm">Rendering…</span></div>
                      ) : v.status === 'FAILED' ? (
                        <div className="flex flex-col items-center gap-1 px-4 text-center text-amber-300"><AlertTriangle className="h-7 w-7" /><span className="text-xs">Render failed</span></div>
                      ) : (
                        <Film className="h-10 w-10 text-muted" />
                      )}
                    </div>
                  </>
                )}
                <div className="absolute top-2 left-2"><StatusBadge status={v.status} /></div>
              </div>
              <CardBody className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-medium text-fg truncate">{v.title}</h3>
                    <p className="text-xs text-muted">{v.aspect} · {v.durationS}s · {v.images?.length || 0} scenes</p>
                  </div>
                  <button onClick={() => remove.mutate(v.id)} className="text-muted hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
                {v.status === 'FAILED' && v.error && <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600">{v.error}</p>}
                {v.status !== 'RENDERING' && (
                  <Button size="sm" variant={v.status === 'READY' ? 'secondary' : 'primary'} className="mt-3 w-full" onClick={() => render.mutate(v.id)} loading={render.isPending && render.variables === v.id}>
                    <Play className="h-3.5 w-3.5" /> {v.status === 'READY' ? 'Re-render' : v.status === 'FAILED' ? 'Retry render' : 'Render reel'}
                  </Button>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card><EmptyState icon={Clapperboard} title="No reels yet" description="Create a reel from your product images and captions."
          action={<Button onClick={() => setCreating(true)} disabled={!activeBrandId}><Plus className="h-4 w-4" /> New Reel</Button>} /></Card>
      )}

      {creating && <VideoModal onClose={() => setCreating(false)} onSave={(v) => create.mutate(v)} saving={create.isPending} />}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title} size="md"
        footer={preview?.outputUrl && <a href={preview.outputUrl} target="_blank" rel="noreferrer" download><Button variant="secondary"><Download className="h-4 w-4" /> Download</Button></a>}>
        {preview?.outputUrl && (
          <video src={preview.outputUrl} controls autoPlay loop className="mx-auto max-h-[70vh] rounded-xl" />
        )}
      </Modal>
    </div>
  );
}

function VideoModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ title: '', aspect: '9:16', durationS: 10, audioUrl: '' });
  const [scenes, setScenes] = useState([{ image: '', caption: '' }]);

  const updateScene = (i, key, val) => setScenes((s) => s.map((sc, x) => (x === i ? { ...sc, [key]: val } : sc)));
  const addScene = () => scenes.length < 6 && setScenes([...scenes, { image: '', caption: '' }]);
  const removeScene = (i) => setScenes(scenes.filter((_, x) => x !== i));

  const submit = () => {
    const filled = scenes.filter((s) => s.image);
    if (!filled.length) return toast.error('Add at least one image');
    onSave({ ...form, images: filled.map((s) => s.image), captions: filled.map((s) => s.caption) });
    return undefined;
  };

  return (
    <Modal open onClose={onClose} title="New promo reel" size="xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={saving} disabled={!form.title}>Create project</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Title" className="sm:col-span-3"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Eid Reel" /></Field>
        <Field label="Aspect"><Select value={form.aspect} onChange={(e) => setForm({ ...form, aspect: e.target.value })}><option value="9:16">9:16 Reel</option><option value="1:1">1:1 Square</option><option value="16:9">16:9 Wide</option></Select></Field>
        <Field label="Duration (s)"><Input type="number" min={5} max={30} value={form.durationS} onChange={(e) => setForm({ ...form, durationS: Number(e.target.value) })} /></Field>
        <Field label="Audio URL" hint="optional"><Input icon={Music} value={form.audioUrl} onChange={(e) => setForm({ ...form, audioUrl: e.target.value })} placeholder="https://…mp3" /></Field>
      </div>

      <p className="label mt-5">Scenes (max 6)</p>
      <div className="space-y-3">
        {scenes.map((sc, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-border p-3">
            <div className="w-28 shrink-0"><ImageUploader value={sc.image} onChange={(url) => updateScene(i, 'image', url)} folder="video" aspect="aspect-[9/16]" /></div>
            <div className="flex-1">
              <Field label={`Scene ${i + 1} caption`}><Input value={sc.caption} onChange={(e) => updateScene(i, 'caption', e.target.value)} placeholder="This Eid, wear heritage." /></Field>
              {scenes.length > 1 && <button onClick={() => removeScene(i)} className="mt-2 flex items-center gap-1 text-xs text-red-500"><X className="h-3.5 w-3.5" /> Remove scene</button>}
            </div>
          </div>
        ))}
      </div>
      {scenes.length < 6 && <Button variant="ghost" size="sm" className="mt-2" onClick={addScene}><Plus className="h-4 w-4" /> Add scene</Button>}
    </Modal>
  );
}
