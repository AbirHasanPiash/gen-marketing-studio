import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clapperboard, Plus, Play, Loader2, Trash2, Pencil, AlertTriangle, Film, X, Download, Info,
  Layers, Music, Timer, ArrowUp, ArrowDown, Wand2, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { ImageUploader } from '../components/shared/ImageUploader';
import { AudioUploader } from '../components/shared/AudioUploader';
import {
  Card, CardBody, Button, Input, Textarea, Field, Select, Modal, ConfirmDialog, EmptyState, Skeleton,
} from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { get, post, patch, del } from '../lib/api';
import { cn } from '../lib/utils';

const ASPECT_LABEL = { '9:16': 'Reel', '1:1': 'Square', '16:9': 'Wide' };

// Poster overlays need their own status treatment: the shared StatusBadge uses
// translucent tints tuned for a light card surface and disappears over artwork.
const STATUS_DOT = {
  DRAFT: 'bg-slate-300',
  RENDERING: 'bg-brand-400 animate-pulse',
  READY: 'bg-emerald-400',
  FAILED: 'bg-red-400',
};
const STATUS_LABEL = { DRAFT: 'Draft', RENDERING: 'Rendering', READY: 'Ready', FAILED: 'Failed' };

/** Small pill for the poster overlays. */
function Chip({ icon: Icon, children, className }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md bg-slate-950/65 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm', className)}>
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}

/** Icon-only action with a real touch target — the old bare icons were 16px. */
function IconAction({ icon: Icon, label, danger, disabled, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted transition',
        'hover:bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20',
        danger && 'hover:border-red-500/40 hover:text-red-500',
        disabled && 'pointer-events-none opacity-40'
      )}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * Poster frame for a reel.
 *
 * The old markup put `aspect-[9/16]` and `max-h-72` on the same box, which the
 * browser resolves by shrinking the *width* to keep the ratio — a 9:16 card in
 * a 363px column collapsed to 162px and left a dead gap beside it. Here the
 * frame is a fixed 4:5 box and the still sits inside it with `object-contain`
 * over a blurred copy of itself, so 9:16, 1:1 and 16:9 reels all fill the same
 * card without bars or gaps.
 */
function Poster({ project, onPlay, canPlay }) {
  const still = project.images?.[0];
  const scenes = project.images?.length || 0;
  const Wrapper = canPlay ? 'button' : 'div';

  return (
    <Wrapper
      {...(canPlay ? { type: 'button', onClick: onPlay, 'aria-label': `Play ${project.title}` } : {})}
      className={cn('group/poster relative block aspect-[4/5] w-full overflow-hidden bg-slate-950 text-left', canPlay && 'cursor-pointer')}
    >
      {still ? (
        <>
          <img src={still} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
          <img
            src={still}
            alt=""
            loading="lazy"
            className={cn(
              'relative h-full w-full object-contain p-3 transition duration-300',
              project.status === 'RENDERING' && 'opacity-40',
              canPlay && 'group-hover/poster:scale-[1.03]'
            )}
          />
        </>
      ) : (
        <div className="grid h-full place-items-center text-slate-600"><Film className="h-10 w-10" /></div>
      )}

      {project.status === 'RENDERING' && !project.outputUrl && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-xs font-medium">Rendering…</span>
          </div>
        </div>
      )}
      {project.status === 'FAILED' && !project.outputUrl && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-500/20 text-amber-300 backdrop-blur-sm">
            <AlertTriangle className="h-6 w-6" />
          </span>
        </div>
      )}
      {canPlay && (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/15 transition group-hover/poster:bg-slate-950/40">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/95 text-brand-700 shadow-lg transition group-hover/poster:scale-110">
            <Play className="h-6 w-6 fill-current" />
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
        <Chip>
          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[project.status] || 'bg-slate-300')} />
          {STATUS_LABEL[project.status] || project.status}
        </Chip>
        <Chip>{project.aspect}</Chip>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1.5 bg-gradient-to-t from-slate-950/85 to-transparent p-2 pt-8">
        <Chip icon={Timer}>{project.durationS}s</Chip>
        <Chip icon={Layers}>{scenes} {scenes === 1 ? 'scene' : 'scenes'}</Chip>
        {project.audioUrl && <Chip icon={Music}>Audio</Chip>}
        <span className="ml-auto text-[11px] font-medium text-white/75">{ASPECT_LABEL[project.aspect] || project.aspect}</span>
      </div>
    </Wrapper>
  );
}

function ReelCard({ project, canRender, rendering, onPlay, onEdit, onDelete, onRender, onRollback }) {
  const isRendering = project.status === 'RENDERING';
  // Anything with an outputUrl is playable — including the previous render while
  // a new one builds, or after a re-render failed.
  const canPlay = Boolean(project.outputUrl);
  const stale = canPlay && project.status !== 'READY';

  return (
    <Card className="flex flex-col overflow-hidden">
      <Poster project={project} onPlay={onPlay} canPlay={canPlay} />

      <CardBody className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 font-display font-semibold leading-snug text-fg" title={project.title}>
          {project.title}
        </h3>

        {project.status === 'FAILED' && project.error && (
          <p className="rounded-lg bg-red-500/10 p-2 text-xs leading-relaxed text-red-600 dark:text-red-400">{project.error}</p>
        )}
        {project.status === 'READY' && project.warning && (
          <p className="rounded-lg bg-amber-500/10 p-2 text-xs leading-relaxed text-amber-600">{project.warning}</p>
        )}
        {stale && (
          <p className="rounded-lg bg-emerald-500/10 p-2 text-xs leading-relaxed text-emerald-600">
            {isRendering
              ? 'Playing the last good render while the new one builds.'
              : 'The last successful render is still available — press play.'}
          </p>
        )}


        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={canPlay ? 'secondary' : 'primary'}
            className="min-w-0 flex-1"
            onClick={onRender}
            disabled={isRendering || !canRender}
            loading={rendering}
            title={canRender ? undefined : 'FFmpeg is not installed on the server'}
          >
            <Play className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {isRendering ? 'Rendering…' : canPlay ? 'Re-render' : project.status === 'FAILED' ? 'Retry render' : 'Render reel'}
            </span>
          </Button>
          <IconAction icon={Pencil} label="Edit reel" onClick={onEdit} disabled={isRendering} />
          {project.previousUrl && (
            <IconAction icon={RotateCcw} label="Restore previous render" onClick={onRollback} disabled={isRendering} />
          )}
          <IconAction icon={Trash2} label="Delete reel" danger onClick={onDelete} disabled={isRendering} />
        </div>
      </CardBody>
    </Card>
  );
}

export default function VideoPage() {
  const qc = useQueryClient();
  const { activeBrandId } = useActiveBrand();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  useDocumentTitle('Video Studio');

  // Surface the server's FFmpeg capabilities up front — otherwise the only way
  // to discover a missing binary or a drawtext-less build is a failed render.
  const { data: ffmpeg } = useQuery({
    queryKey: ['ffmpeg-status'],
    queryFn: () => get('/videos/status/ffmpeg'),
    staleTime: 5 * 60_000,
  });
  const canRender = ffmpeg?.available !== false;

  const { data: videos, isLoading } = useQuery({
    queryKey: ['videos', activeBrandId],
    queryFn: () => get(`/videos?brandId=${activeBrandId}`),
    enabled: Boolean(activeBrandId),
    refetchInterval: (q) => (q.state.data?.some((v) => v.status === 'RENDERING') ? 4000 : false),
  });

  const create = useMutation({
    mutationFn: (v) => post('/videos', { ...v, brandId: activeBrandId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['videos'] }); setCreating(false); toast.success('Reel created'); },
    onError: (e) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, ...v }) => patch(`/videos/${id}`, v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['videos'] }); setEditing(null); toast.success('Reel updated — re-render to apply'); },
    onError: (e) => toast.error(e.message),
  });
  const render = useMutation({
    mutationFn: (id) => post(`/videos/${id}/render`),
    onSuccess: (queued) => {
      // Seat the RENDERING row straight away so refetchInterval kicks in.
      qc.setQueryData(['videos', activeBrandId], (old) => old?.map((v) => (v.id === queued.id ? queued : v)));
      qc.invalidateQueries({ queryKey: ['videos'] });
      toast('Rendering started…', { icon: '🎬' });
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => del(`/videos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['videos'] }); setToDelete(null); toast.success('Reel deleted'); },
    onError: (e) => toast.error(e.message),
  });
  const rollback = useMutation({
    mutationFn: (id) => post(`/videos/${id}/rollback`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['videos'] }); toast.success('Restored the previous render'); },
    onError: (e) => toast.error(e.message),
  });

  const newReelBtn = (
    <Button onClick={() => setCreating(true)} disabled={!activeBrandId}>
      <Plus className="h-4 w-4" /> New Reel
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Studio"
        description="Stitch product images, captions and a soundtrack into short promo reels."
        icon={Clapperboard}
        actions={newReelBtn}
      />

      {ffmpeg?.available === false && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-start">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-fg">FFmpeg isn’t available on this server</p>
            <p className="mt-1 leading-relaxed text-muted">
              You can still build and save reel projects, but rendering is disabled until FFmpeg is installed —
              <code className="mx-1 rounded bg-border/60 px-1">brew install ffmpeg</code> (macOS) or
              <code className="mx-1 rounded bg-border/60 px-1">apt install ffmpeg</code> (Linux), or point
              <code className="mx-1 rounded bg-border/60 px-1">FFMPEG_PATH</code> at the binary. The Docker image ships with it.
            </p>
          </div>
        </div>
      )}

      {ffmpeg?.available && ffmpeg.captions === 'none' && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-elevated/50 p-4 sm:flex-row sm:items-start">
          <Info className="h-5 w-5 shrink-0 text-brand-500" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-fg">Captions will be skipped on render</p>
            <p className="mt-1 leading-relaxed text-muted">
              This FFmpeg build has no <code className="rounded bg-border/60 px-1">drawtext</code> filter (it needs
              libfreetype) and Cloudinary isn’t configured, so scene text can’t be burned in. Reels still render.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[430px] rounded-2xl" />)}
        </div>
      ) : videos?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {videos.map((v) => (
            <ReelCard
              key={v.id}
              project={v}
              canRender={canRender}
              rendering={render.isPending && render.variables === v.id}
              onPlay={() => setPreview(v)}
              onEdit={() => setEditing(v)}
              onDelete={() => setToDelete(v)}
              onRender={() => render.mutate(v.id)}
              onRollback={() => rollback.mutate(v.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Clapperboard}
            title="No reels yet"
            description="Turn your product images into a short promo reel — up to six scenes, with captions and a soundtrack."
            action={newReelBtn}
          />
        </Card>
      )}

      {(creating || editing) && (
        <VideoModal
          project={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(v) => (editing ? update.mutate({ id: editing.id, ...v }) : create.mutate(v))}
          saving={create.isPending || update.isPending}
        />
      )}

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title}
        subtitle={preview ? `${preview.aspect} · ${preview.durationS}s · ${preview.images?.length || 0} scenes` : undefined}
        size="md"
        footer={
          preview?.outputUrl && (
            <a href={preview.outputUrl} target="_blank" rel="noreferrer" download>
              <Button variant="secondary"><Download className="h-4 w-4" /> Download</Button>
            </a>
          )
        }
      >
        {preview?.outputUrl && (
          <div className="grid place-items-center rounded-xl bg-slate-950 p-2">
            <video
              key={preview.outputUrl}
              src={preview.outputUrl}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[60vh] w-auto max-w-full rounded-lg"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => remove.mutate(toDelete.id)}
        title={`Delete “${toDelete?.title}”?`}
        message="The project and any rendered video are removed. This can't be undone."
        confirmLabel="Delete reel"
        danger
        loading={remove.isPending}
      />
    </div>
  );
}

function VideoModal({ project, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    title: project?.title || '',
    aspect: project?.aspect || '9:16',
    durationS: project?.durationS || 10,
    audioUrl: project?.audioUrl || '',
  });
  const [scenes, setScenes] = useState(
    project?.images?.length
      ? project.images.map((image, i) => ({
          image,
          caption: project.captions?.[i] || '',
          duration: project.durations?.[i] ?? Number((project.durationS / project.images.length).toFixed(2)),
        }))
      : [{ image: '', caption: '', duration: 10 }]
  );
  const [regenIndex, setRegenIndex] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updateScene = (i, key, val) => setScenes((s) => s.map((sc, x) => (x === i ? { ...sc, [key]: val } : sc)));
  const addScene = () =>
    setScenes((s) =>
      s.length < 6 ? [...s, { image: '', caption: '', duration: Number((form.durationS / (s.length + 1)).toFixed(2)) }] : s
    );
  const removeScene = (i) => setScenes((s) => s.filter((_, x) => x !== i));
  const move = (i, dir) => setScenes((s) => {
    const arr = [...s];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return s;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return arr;
  });

  const filled = scenes.filter((s) => s.image);
  const total = Number(filled.reduce((a, s) => a + Number(s.duration || 0), 0).toFixed(2));
  const delta = Number((total - form.durationS).toFixed(2));
  // Floats never sum exactly (10/3 three times is 9.999), so compare within a
  // tolerance — the same one the server uses.
  const balanced = Math.abs(delta) <= 0.05 && filled.every((s) => Number(s.duration) >= 0.5);

  /** The old behaviour, now on demand. */
  const splitEvenly = () => {
    const per = Number((form.durationS / (scenes.length || 1)).toFixed(2));
    setScenes((s) => s.map((sc) => ({ ...sc, duration: per })));
  };
  /** Push the whole difference into the last scene so the total lands exactly. */
  const fixLast = () =>
    setScenes((s) => {
      if (!s.length) return s;
      const arr = [...s];
      const last = arr.length - 1;
      const others = arr.slice(0, last).reduce((a, x) => a + Number(x.duration || 0), 0);
      arr[last] = { ...arr[last], duration: Number(Math.max(0.5, form.durationS - others).toFixed(2)) };
      return arr;
    });

  const submit = () => {
    if (!filled.length) return toast.error('Add at least one scene image');
    if (!balanced) return toast.error(`Scene durations add up to ${total}s, not ${form.durationS}s`);
    onSave({
      ...form,
      images: filled.map((s) => s.image),
      captions: filled.map((s) => s.caption),
      durations: filled.map((s) => Number(s.duration)),
    });
    return undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={project ? 'Edit reel' : 'New promo reel'}
      subtitle={filled.length ? `${filled.length} ${filled.length === 1 ? 'scene' : 'scenes'} · ${total}s of ${form.durationS}s` : 'Add up to six scenes'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!form.title}>
            {project ? 'Save changes' : 'Create reel'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Eid Collection Reel" />
          </Field>
          <Field label="Aspect ratio">
            <Select value={form.aspect} onChange={(e) => set('aspect', e.target.value)}>
              <option value="9:16">9:16 — Reel / Story</option>
              <option value="1:1">1:1 — Square feed</option>
              <option value="16:9">16:9 — Wide</option>
            </Select>
          </Field>
          <Field label="Total duration" hint="seconds">
            <Input type="number" min={5} max={30} value={form.durationS} onChange={(e) => set('durationS', Number(e.target.value))} />
          </Field>
          <Field label="Soundtrack" hint="optional" className="sm:col-span-2">
            <AudioUploader value={form.audioUrl} onChange={(url) => set('audioUrl', url)} />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="label mb-0">Scenes</p>
            <span className="text-xs text-muted">{scenes.length} of 6</span>
          </div>

          {/* Recompute + validate the timeline before a render is allowed. */}
          <div
            className={cn(
              'mb-3 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm',
              balanced ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/10'
            )}
          >
            <span className="font-medium text-fg">
              {total}s of {form.durationS}s
              {!balanced && <span className="ml-2 text-amber-600">({delta > 0 ? '+' : ''}{delta}s)</span>}
            </span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={splitEvenly}>Split evenly</Button>
            <Button size="sm" variant="ghost" onClick={fixLast} disabled={balanced}>Fix last scene</Button>
          </div>

            
          <div className="space-y-3">
            {scenes.map((sc, i) => (
              // Stacks under 640px so the thumbnail and caption never fight for width.
              <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row">
                <div className="flex items-start gap-3">
                  <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-500">
                    {i + 1}
                  </span>
                  <div className="w-24 shrink-0 sm:w-28">
                    <ImageUploader value={sc.image} onChange={(url) => updateScene(i, 'image', url)} folder="video" aspect="aspect-[9/16]" />
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <Field label={`Scene ${i + 1} caption`} hint="optional">
                    <Input value={sc.caption} onChange={(e) => updateScene(i, 'caption', e.target.value)} placeholder="This Eid, wear heritage." />
                  </Field>
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Seconds" className="w-24">
                      <Input
                        type="number"
                        min={0.5}
                        max={30}
                        step={0.5}
                        value={sc.duration}
                        onChange={(e) => updateScene(i, 'duration', Number(e.target.value))}
                      />
                    </Field>
                    <IconAction icon={ArrowUp} label="Move scene up" onClick={() => move(i, -1)} disabled={i === 0} />
                    <IconAction icon={ArrowDown} label="Move scene down" onClick={() => move(i, 1)} disabled={i === scenes.length - 1} />
                    {project?.id && (
                      <Button size="sm" variant="subtle" onClick={() => setRegenIndex(i)}>
                        <Wand2 className="h-3.5 w-3.5" /> Regenerate
                      </Button>
                    )}
                    {scenes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeScene(i)}
                        className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-red-500 transition hover:bg-red-500/10"
                      >
                        <X className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {scenes.length < 6 && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={addScene}>
              <Plus className="h-4 w-4" /> Add scene
            </Button>
          )}
        </div>
      </div>

      {regenIndex !== null && (
        <RegenerateSceneDialog
          index={regenIndex}
          scene={scenes[regenIndex]}
          projectId={project.id}
          onClose={() => setRegenIndex(null)}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

/**
 * Regenerate one scene. The server swaps that scene and re-renders, but only this
 * scene's segment is re-encoded — its content hash changed, the others didn't.
 */
function RegenerateSceneDialog({ index, scene, projectId, onClose, onDone }) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState('');
  const [caption, setCaption] = useState(scene.caption || '');
  const [duration, setDuration] = useState(scene.duration);

  const regenerate = useMutation({
    mutationFn: (body) => post(`/videos/${projectId}/scenes/${index}/regenerate`, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      toast.success(`Scene ${res.regeneratedScene + 1} regenerated — re-encoding just that scene`);
      onClose();
      onDone?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const untouched =
    !prompt.trim() && !image && caption === (scene.caption || '') && Number(duration) === Number(scene.duration);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Regenerate scene ${index + 1}`}
      subtitle="Only this scene is re-encoded — the rest of the reel is copied from the segment cache."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            loading={regenerate.isPending}
            disabled={untouched}
            onClick={() =>
              regenerate.mutate({
                caption,
                duration: Number(duration),
                ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
                ...(image ? { image } : {}),
              })
            }
          >
            <Wand2 className="h-4 w-4" /> Regenerate &amp; render
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="New still from a prompt" hint="optional">
          <Textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="the same saree folded on a marble step, golden hour…"
          />
        </Field>
        <Field label="…or upload a replacement still">
          <div className="w-28">
            <ImageUploader value={image} onChange={setImage} folder="video" aspect="aspect-[9/16]" />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Caption"><Input value={caption} onChange={(e) => setCaption(e.target.value)} /></Field>
          <Field label="Seconds">
            <Input type="number" min={0.5} max={30} step={0.5} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
