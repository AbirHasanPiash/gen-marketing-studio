import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'fluent-ffmpeg';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { uploadMedia, cloudinaryEnabled, captionedImageUrl } from '../../lib/cloudinary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RENDER_DIR = path.resolve(__dirname, '../../../tmp/renders');
const WORK_DIR = path.resolve(__dirname, '../../../tmp/work');
fs.mkdirSync(RENDER_DIR, { recursive: true });
fs.mkdirSync(WORK_DIR, { recursive: true });

if (env.ffmpeg.path) ffmpeg.setFfmpegPath(env.ffmpeg.path);

const ASPECTS = {
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
};

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

async function fetchToFile(url, dest) {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    const body = url.slice(comma + 1);
    const isBase64 = url.slice(0, comma).includes(';base64');
    fs.writeFileSync(dest, isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8'));
    return dest;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
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

  const caps = await ffmpegCapabilities();
  if (!caps.available) {
    await prisma.videoProject.update({
      where: { id: projectId },
      data: {
        status: 'FAILED',
        error:
          'FFmpeg is not installed on the server. Install it (`brew install ffmpeg`) or set FFMPEG_PATH / add the ffmpeg-static package, then re-render.',
      },
    });
    logger.warn(`Video ${projectId}: ffmpeg unavailable`);
    return;
  }

  const images = (project.images || []).slice(0, 8);
  if (!images.length) {
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: 'FAILED', error: 'No images to render' },
    });
    return;
  }

  const { w, h } = ASPECTS[project.aspect] || ASPECTS['9:16'];
  const captions = project.captions || [];
  const hasCaptions = images.some((_, i) => captions[i]);
  const strategy = await captionSupport();
  const warning =
    hasCaptions && strategy === 'none'
      ? 'Captions were skipped: this ffmpeg build has no `drawtext` filter (it needs libfreetype) and Cloudinary is not configured.'
      : null;

  // Split the requested runtime evenly instead of rounding each scene to whole
  // seconds, which used to turn a 10s reel into a 9s one.
  const totalS = Math.min(30, Math.max(5, project.durationS || 10));
  const per = Number((totalS / images.length).toFixed(3));

  const work = path.join(WORK_DIR, projectId);
  const output = path.join(RENDER_DIR, `${projectId}.mp4`);

  try {
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: 'RENDERING', error: null, warning: null },
    });
    fs.mkdirSync(work, { recursive: true });

    const localImages = [];
    for (const [i, url] of images.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const source = await sceneSource({ url, caption: captions[i], strategy, w, h });
      // eslint-disable-next-line no-await-in-loop
      localImages.push(await fetchToFile(source, path.join(work, `img${i}.jpg`)));
    }
    let audioFile = null;
    if (project.audioUrl) {
      audioFile = await fetchToFile(project.audioUrl, path.join(work, 'audio.mp3')).catch((err) => {
        logger.warn(`Video ${projectId}: audio fetch failed (${err.message}), rendering silent`);
        return null;
      });
    }

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg();
      localImages.forEach((p) => cmd.input(p).inputOptions(['-loop 1', `-t ${per}`]));
      // Loop the track so a clip shorter than the reel no longer truncates it.
      if (audioFile) cmd.input(audioFile).inputOptions(['-stream_loop -1']);

      const filters = [];
      localImages.forEach((_, i) => {
        const caption = strategy === 'drawtext' ? captions[i] : null;
        const draw = caption
          ? `,drawtext=fontfile='${caps.font}':text='${escapeDraw(caption)}':fontcolor=white:fontsize=${Math.round(
              h / 22
            )}:box=1:boxcolor=black@0.45:boxborderw=24:x=(w-text_w)/2:y=h-text_h-${Math.round(h / 16)}`
          : '';
        filters.push(
          `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=${FPS},fade=t=in:st=0:d=0.4${draw}[v${i}]`
        );
      });
      filters.push(`${localImages.map((_, i) => `[v${i}]`).join('')}concat=n=${localImages.length}:v=1:a=0[outv]`);

      // complexFilter's second argument already emits `-map [outv]`; adding it
      // to the output options too made ffmpeg reject the whole command.
      cmd.complexFilter(filters, 'outv');
      const outOpts = [`-r ${FPS}`, '-pix_fmt yuv420p', '-movflags +faststart', '-c:v libx264'];
      if (audioFile) outOpts.push(`-map ${localImages.length}:a`, '-c:a aac', '-shortest');

      let timedOut = false;
      let timer;
      cmd
        .outputOptions(outOpts)
        .on('start', (c) => logger.debug('ffmpeg:', c))
        .on('error', (err, _stdout, stderr) => {
          clearTimeout(timer);
          reject(
            timedOut
              ? new Error(`Render timed out after ${RENDER_TIMEOUT_MS / 1000}s and was cancelled`)
              : new Error(ffmpegMessage(err, stderr))
          );
        })
        .on('end', () => {
          clearTimeout(timer);
          resolve();
        })
        .save(output);
      timer = setTimeout(() => {
        timedOut = true;
        cmd.kill('SIGKILL');
      }, RENDER_TIMEOUT_MS);
    });

    let outputUrl;
    if (cloudinaryEnabled()) {
      // A stable public id means a re-render overwrites the old file (and still
      // returns a fresh versioned URL) instead of leaving an orphan behind.
      const up = await uploadMedia(output, { folder: 'mkt_studio/videos', publicId: projectId });
      outputUrl = up.url;
    } else {
      // Locally the filename is reused, so version the URL to defeat the cache.
      outputUrl = `${env.apiBaseUrl}/media/renders/${projectId}.mp4?v=${Date.now()}`;
    }

    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: 'READY', outputUrl, error: null, warning },
    });
    logger.success(`Video ${projectId} rendered → ${outputUrl}`);
  } catch (err) {
    logger.error(`Video ${projectId} render failed:`, err.message);
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: 'FAILED', error: err.message?.slice(0, 500) },
    });
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
