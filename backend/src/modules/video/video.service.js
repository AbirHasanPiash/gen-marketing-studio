import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'fluent-ffmpeg';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { uploadMedia, cloudinaryEnabled, captionedImageUrl } from '../../lib/cloudinary.js';
import { sha256 } from '../../utils/hash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RENDER_DIR = path.resolve(__dirname, '../../../tmp/renders');
const WORK_DIR = path.resolve(__dirname, '../../../tmp/work');
/**
 * Per-scene MP4 segments, named by a content hash of the scene. This is what
 * makes regenerating one scene cheap: an untouched scene keeps its hash, so its
 * segment is reused and only the changed scene is re-encoded.
 */
export const SEGMENT_DIR = path.resolve(__dirname, '../../../tmp/segments');
fs.mkdirSync(RENDER_DIR, { recursive: true });
fs.mkdirSync(WORK_DIR, { recursive: true });
fs.mkdirSync(SEGMENT_DIR, { recursive: true });

if (env.ffmpeg.path) ffmpeg.setFfmpegPath(env.ffmpeg.path);

const ASPECTS = {
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
};

const MIN_SCENE_S = 0.5;
const DURATION_TOLERANCE_S = 0.05;

/**
 * The durations a render should use. Falls back to the old even split when a
 * project has none, so every reel created before this feature keeps working.
 */
export function resolveDurations(project) {
  const n = (project.images || []).length;
  if (!n) return [];
  const stored = (project.durations || []).slice(0, n).map(Number);
  if (stored.length === n && stored.every((d) => Number.isFinite(d) && d >= MIN_SCENE_S)) return stored;
  const per = Number((Math.min(30, Math.max(5, project.durationS || 10)) / n).toFixed(3));
  return Array.from({ length: n }, () => per);
}

/**
 * Do the per-scene durations still add up to the target runtime? Floats never
 * sum exactly (10/3 three times is 9.999), so this compares within a tolerance
 * well below a single frame at 30fps rather than with ===.
 */
export function validateDurations(durations, targetS, tolerance = DURATION_TOLERANCE_S) {
  const total = durations.reduce((a, b) => a + Number(b || 0), 0);
  const tooShort = durations.filter((d) => Number(d) < MIN_SCENE_S).length;
  return {
    total: Number(total.toFixed(3)),
    target: targetS,
    delta: Number((total - targetS).toFixed(3)),
    tooShort,
    valid: Math.abs(total - targetS) <= tolerance && tooShort === 0,
  };
}

/**
 * Keep `durations` index-aligned with `images` when scenes are added or removed:
 * extra entries are dropped and new scenes share out the runtime that's left.
 */
export function alignDurations(durations = [], count, targetS) {
  if (!count) return [];
  const kept = durations.slice(0, count).map(Number).filter((d) => Number.isFinite(d) && d >= MIN_SCENE_S);
  if (kept.length === count) return kept;
  const missing = count - kept.length;
  const used = kept.reduce((a, b) => a + b, 0);
  const per = Number((Math.max(MIN_SCENE_S * missing, targetS - used) / missing).toFixed(3));
  return [...kept, ...Array.from({ length: missing }, () => per)];
}

const FPS = 30;
const FETCH_TIMEOUT_MS = 30_000;
const RENDER_TIMEOUT_MS = 5 * 60_000;

const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];
const findFont = () => FONT_CANDIDATES.find((p) => fs.existsSync(p)) || null;

/** Renders currently owned by this process — blocks a double "Render" click. */
const inFlight = new Set();
export const isRendering = (id) => inFlight.has(id);

/**
 * Probe the ffmpeg binary once and remember what it can do. `drawtext` needs a
 * build linked against libfreetype, which plenty of ffmpeg packages omit, so it
 * has to be detected rather than assumed. Only successful probes are cached, so
 * installing ffmpeg while the server runs is picked up on the next call.
 */
let capabilities = null;
export async function ffmpegCapabilities({ refresh = false } = {}) {
  if (capabilities && !refresh) return capabilities;
  const filters = await new Promise((resolve) => {
    ffmpeg.getAvailableFilters((err, list) => resolve(err ? null : list || {}));
  });
  const font = findFont();
  const caps = {
    available: Boolean(filters),
    font,
    drawtext: Boolean(filters?.drawtext && font),
  };
  if (caps.available) capabilities = caps;
  return caps;
}

export async function ffmpegAvailable() {
  return (await ffmpegCapabilities()).available;
}

/**
 * How captions can be burned in: natively via ffmpeg, via Cloudinary delivery
 * transformations on the source images, or not at all.
 */
export async function captionSupport() {
  if ((await ffmpegCapabilities()).drawtext) return 'drawtext';
  if (cloudinaryEnabled()) return 'cloudinary';
  return 'none';
}

/**
 * Renders left mid-flight by a restart would otherwise sit at RENDERING for
 * ever, with the UI polling them for ever. Called once on boot.
 */
export async function resetStuckRenders() {
  const { count } = await prisma.videoProject.updateMany({
    where: { status: 'RENDERING' },
    data: { status: 'FAILED', error: 'Render was interrupted by a server restart — hit "Retry render".' },
  });
  if (count) logger.warn(`Reset ${count} interrupted video render(s)`);
  return count;
}

async function fetchToFile(url, dest, { expectMedia = false } = {}) {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    const body = url.slice(comma + 1);
    const isBase64 = url.slice(0, comma).includes(';base64');
    fs.writeFileSync(dest, isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8'));
    return dest;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`the link returned HTTP ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  // The usual mistake is pasting the page a track lives on rather than the file
  // itself; ffmpeg would then choke on a lump of HTML with a cryptic message.
  if (expectMedia && /^(text\/|application\/(json|xml|xhtml))/.test(type)) {
    throw new Error(`the link returned a web page (${type}), not a media file`);
  }
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

const escapeDraw = (t) =>
  String(t).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "’").replace(/%/g, '\\%');

/** Pull the useful lines out of ffmpeg's stderr so the UI shows a real reason. */
function ffmpegMessage(err, stderr) {
  const detail = String(stderr || '')
    .split('\n')
    .filter((l) => /error|invalid|no such|not found|failed|unable/i.test(l))
    .slice(-2)
    .join(' | ')
    .trim();
  return detail ? `${err.message} — ${detail}` : err.message;
}

/**
 * Resolve the image a scene should actually render from. On the `cloudinary`
 * caption path the text is baked into the delivery URL; sources that don't live
 * on Cloudinary yet are ingested first so they can carry an overlay too.
 */
async function sceneSource({ url, caption, strategy, w, h }) {
  if (strategy !== 'cloudinary' || !caption) return url;
  const opts = { text: caption, width: w, height: h, fontSize: Math.round(h / 22) };
  const direct = captionedImageUrl({ url, ...opts });
  if (direct) return direct;
  try {
    const up = await uploadMedia(url, { folder: 'mkt_studio/video' });
    return captionedImageUrl({ url: up.url, ...opts }) || url;
  } catch (err) {
    // Losing a caption beats losing the whole reel.
    logger.warn(`Caption skipped for ${url}: ${err.message}`);
    return url;
  }
}

/** Run one ffmpeg command with a hard timeout and a readable error. */
function runFfmpeg(build, output, timeoutMs = RENDER_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const cmd = build();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      cmd.kill('SIGKILL');
    }, timeoutMs);
    cmd
      .on('start', (c) => logger.debug('ffmpeg:', c))
      .on('error', (err, _stdout, stderr) => {
        clearTimeout(timer);
        reject(
          timedOut
            ? new Error(`Render timed out after ${timeoutMs / 1000}s and was cancelled`)
            : new Error(ffmpegMessage(err, stderr))
        );
      })
      .on('end', () => {
        clearTimeout(timer);
        resolve();
      })
      .save(output);
  });
}

/**
 * Content address for one scene. Anything that changes the pixels — the still,
 * the caption, the duration, the frame size, the caption strategy — changes the
 * hash and therefore the filename, so an untouched scene is never re-encoded.
 */
export function sceneKey({ image, caption, duration, w, h, strategy }) {
  return sha256(JSON.stringify({ image, caption: caption || '', duration, w, h, strategy })).slice(0, 16);
}

/**
 * Encode one scene to its own MP4, or reuse the cached one.
 * Every segment is encoded with IDENTICAL codec settings: the concat demuxer can
 * only stream-copy segments that agree on codec, resolution, fps and pixel format.
 */
async function renderSegment({ projectId, index, scene, w, h, strategy, caps, work }) {
  const key = sceneKey({ ...scene, w, h, strategy });
  const dir = path.join(SEGMENT_DIR, projectId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `s${index}-${key}.mp4`);

  if (fs.existsSync(file)) {
    logger.debug(`Video ${projectId}: scene ${index + 1} reused from cache (${key})`);
    return { file, key, reused: true };
  }

  const source = await sceneSource({ url: scene.image, caption: scene.caption, strategy, w, h });
  const still = await fetchToFile(source, path.join(work, `img${index}.jpg`));

  const caption = strategy === 'drawtext' ? scene.caption : null;
  const draw = caption
    ? `,drawtext=fontfile='${caps.font}':text='${escapeDraw(caption)}':fontcolor=white` +
      `:fontsize=${Math.round(h / 22)}:box=1:boxcolor=black@0.45:boxborderw=24` +
      `:x=(w-text_w)/2:y=h-text_h-${Math.round(h / 16)}`
    : '';

  try {
    await runFfmpeg(
      () =>
        ffmpeg()
          .input(still)
          .inputOptions(['-loop 1', `-t ${scene.duration}`])
          .videoFilters(
            `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},` +
              `setsar=1,fps=${FPS},fade=t=in:st=0:d=0.4${draw}`
          )
          .outputOptions([`-r ${FPS}`, '-pix_fmt yuv420p', '-c:v libx264', '-preset veryfast', `-g ${FPS}`, '-an']),
      file
    );
  } catch (err) {
    fs.rmSync(file, { force: true }); // never leave a half-written segment in the cache
    throw err;
  }
  return { file, key, reused: false };
}

/** Stitch the segments (stream copy — no re-encode) and mux the soundtrack. */
async function concatSegments({ segments, audioFile, output }) {
  const listPath = `${output}.txt`;
  fs.writeFileSync(listPath, segments.map((s) => `file '${s.file.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
  try {
    await runFfmpeg(() => {
      const cmd = ffmpeg().input(listPath).inputOptions(['-f concat', '-safe 0']);
      // Loop the track so a clip shorter than the reel no longer truncates it.
      if (audioFile) cmd.input(audioFile).inputOptions(['-stream_loop -1']);
      const out = ['-map 0:v:0', '-c:v copy', '-movflags +faststart'];
      if (audioFile) out.push('-map 1:a:0', '-c:a aac', '-shortest');
      else out.push('-an');
      return cmd.outputOptions(out);
    }, output);
  } finally {
    fs.rmSync(listPath, { force: true });
  }
}

const tokenFromUrl = (url) => (/-([a-z0-9]+)\.mp4/i.exec(url || '') || [])[1] || null;

/** Keep only the current and previous renders on disk. */
function pruneRenders(projectId, keepTokens) {
  const keep = new Set(keepTokens.filter(Boolean).map((t) => `${projectId}-${t}.mp4`));
  for (const f of fs.readdirSync(RENDER_DIR)) {
    if (f.startsWith(`${projectId}-`) && f.endsWith('.mp4') && !keep.has(f)) {
      fs.rmSync(path.join(RENDER_DIR, f), { force: true });
    }
  }
}

/** Keep only the segments the latest render actually used. */
function pruneSegments(projectId, keepFiles) {
  const dir = path.join(SEGMENT_DIR, projectId);
  if (!fs.existsSync(dir)) return;
  const keep = new Set(keepFiles);
  for (const f of fs.readdirSync(dir)) if (!keep.has(f)) fs.rmSync(path.join(dir, f), { force: true });
}

/** Called when a project is deleted — renders and cached segments go with it. */
export function cleanupProjectFiles(projectId) {
  fs.rmSync(path.join(SEGMENT_DIR, projectId), { recursive: true, force: true });
  fs.rmSync(path.join(WORK_DIR, projectId), { recursive: true, force: true });
  for (const f of fs.readdirSync(RENDER_DIR)) {
    if (f.startsWith(projectId) && f.endsWith('.mp4')) fs.rmSync(path.join(RENDER_DIR, f), { force: true });
  }
}

/**
 * Stitch product images + captions (+ optional audio) into a short promo reel
 * (Feature 14). Runs in the background; updates the VideoProject row with
 * status READY + outputUrl, or FAILED with a helpful error. Never throws —
 * callers fire it and forget it.
 */
export async function renderVideo(projectId) {
  if (inFlight.has(projectId)) {
    logger.warn(`Video ${projectId}: render already in progress, ignoring duplicate request`);
    return;
  }
  inFlight.add(projectId);
  try {
    await runRender(projectId);
  } catch (err) {
    logger.error(`Video ${projectId} render crashed:`, err.message);
    await prisma.videoProject
      .update({ where: { id: projectId }, data: { status: 'FAILED', error: err.message?.slice(0, 500) } })
      .catch(() => {});
  } finally {
    inFlight.delete(projectId);
  }
}

async function runRender(projectId) {
  const project = await prisma.videoProject.findUnique({ where: { id: projectId } });
  if (!project) return;

  const fail = (error) =>
    prisma.videoProject.update({ where: { id: projectId }, data: { status: 'FAILED', error } });

  const caps = await ffmpegCapabilities();
  if (!caps.available) {
    await fail(
      'FFmpeg is not installed on the server. Install it (`brew install ffmpeg`) or set FFMPEG_PATH / add the ffmpeg-static package, then re-render.'
    );
    logger.warn(`Video ${projectId}: ffmpeg unavailable`);
    return;
  }

  const images = (project.images || []).slice(0, 8);
  if (!images.length) {
    await fail('No images to render');
    return;
  }

  const { w, h } = ASPECTS[project.aspect] || ASPECTS['9:16'];
  const captions = project.captions || [];
  const durations = resolveDurations(project);

  // Second line of defence: the route already rejected an unbalanced reel, but a
  // project edited between queueing and running must not slip through.
  const check = validateDurations(durations, project.durationS);
  if (!check.valid) {
    await fail(
      `Scene durations add up to ${check.total}s but the reel is set to ${check.target}s. Fix the timings and render again.`
    );
    return;
  }

  const strategy = await captionSupport();
  const warnings = [];
  if (images.some((_, i) => captions[i]) && strategy === 'none') {
    warnings.push(
      'Captions were skipped: this ffmpeg build has no `drawtext` filter (it needs libfreetype) and Cloudinary is not configured.'
    );
  }

  const work = path.join(WORK_DIR, projectId);
  // A fresh filename per render. The live outputUrl still points at the old
  // file, so nothing the user can currently play is overwritten or deleted.
  const token = Date.now().toString(36);
  const finalPath = path.join(RENDER_DIR, `${projectId}-${token}.mp4`);

  try {
    await prisma.videoProject.update({
      where: { id: projectId },
      // outputUrl deliberately untouched — the previous render stays playable.
      data: { status: 'RENDERING', error: null, warning: null },
    });
    fs.mkdirSync(work, { recursive: true });

    // Phase 1 — scene segments. Unchanged scenes hit the cache and cost nothing.
    const segments = [];
    for (const [i, image] of images.entries()) {
      // eslint-disable-next-line no-await-in-loop
      segments.push(
        await renderSegment({
          projectId,
          index: i,
          w,
          h,
          strategy,
          caps,
          work,
          scene: { image, caption: captions[i] || '', duration: durations[i] },
        })
      );
    }
    const reused = segments.filter((s) => s.reused).length;
    logger.info(
      `Video ${projectId}: encoded ${segments.length - reused}/${segments.length} scene(s), reused ${reused} from cache`
    );

    // Phase 2 — soundtrack. A missing track never loses the reel.
    let audioFile = null;
    if (project.audioUrl) {
      audioFile = await fetchToFile(project.audioUrl, path.join(work, 'audio'), { expectMedia: true }).catch((err) => {
        logger.warn(`Video ${projectId}: audio fetch failed (${err.message}), rendering silent`);
        warnings.push(`The reel rendered without audio — ${err.message}. Upload the track instead of linking to it.`);
        return null;
      });
    }

    // Phase 3 — stitch. `-c copy` means this is a remux, not a re-encode.
    await concatSegments({ segments, audioFile, output: finalPath });

    // Phase 4 — publish. Only now is the previous render replaced.
    let outputUrl;
    if (cloudinaryEnabled()) {
      const up = await uploadMedia(finalPath, { folder: 'mkt_studio/videos', publicId: `${projectId}-${token}` });
      outputUrl = up.url;
    } else {
      outputUrl = `${env.apiBaseUrl}/media/renders/${projectId}-${token}.mp4`;
    }

    await prisma.videoProject.update({
      where: { id: projectId },
      data: {
        status: 'READY',
        outputUrl,
        previousUrl: project.outputUrl || null, // one-step rollback target
        error: null,
        warning: warnings.join(' ') || null,
      },
    });

    pruneRenders(projectId, [token, tokenFromUrl(project.outputUrl)]);
    pruneSegments(projectId, segments.map((s) => path.basename(s.file)));
    logger.success(`Video ${projectId} rendered → ${outputUrl}`);
  } catch (err) {
    // outputUrl is NOT written on this path and the half-built file is thrown
    // away, so a failed render cannot take away a working video.
    fs.rmSync(finalPath, { force: true });
    logger.error(`Video ${projectId} render failed:`, err.message);
    await fail(err.message?.slice(0, 500));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
