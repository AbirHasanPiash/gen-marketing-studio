import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'fluent-ffmpeg';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { uploadMedia, cloudinaryEnabled } from '../../lib/cloudinary.js';

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

const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];
const findFont = () => FONT_CANDIDATES.find((p) => fs.existsSync(p)) || null;

export function ffmpegAvailable() {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err) => resolve(!err));
  });
}

async function fetchToFile(url, dest) {
  if (url.startsWith('data:')) {
    fs.writeFileSync(dest, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    return dest;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

const escapeDraw = (t) =>
  String(t).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "’").replace(/%/g, '\\%');

/**
 * Stitch product images + captions (+ optional audio) into a short promo reel
 * (Feature 14). Runs in the background; updates the VideoProject row with
 * status READY + outputUrl, or FAILED with a helpful error.
 */
export async function renderVideo(projectId) {
  const project = await prisma.videoProject.findUnique({ where: { id: projectId } });
  if (!project) return;

  if (!(await ffmpegAvailable())) {
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

  const { w, h } = ASPECTS[project.aspect] || ASPECTS['9:16'];
  const images = (project.images || []).slice(0, 8);
  if (!images.length) {
    await prisma.videoProject.update({ where: { id: projectId }, data: { status: 'FAILED', error: 'No images to render' } });
    return;
  }

  const work = path.join(WORK_DIR, projectId);
  fs.mkdirSync(work, { recursive: true });
  const output = path.join(RENDER_DIR, `${projectId}.mp4`);
  const per = Math.max(1, Math.round((project.durationS || 10) / images.length));
  const font = findFont();

  try {
    await prisma.videoProject.update({ where: { id: projectId }, data: { status: 'RENDERING', error: null } });

    const localImages = [];
    for (const [i, url] of images.entries()) {
      // eslint-disable-next-line no-await-in-loop
      localImages.push(await fetchToFile(url, path.join(work, `img${i}.jpg`)));
    }
    let audioFile = null;
    if (project.audioUrl) {
      audioFile = await fetchToFile(project.audioUrl, path.join(work, 'audio.mp3')).catch(() => null);
    }

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg();
      localImages.forEach((p) => cmd.input(p).inputOptions(['-loop 1', `-t ${per}`]));
      if (audioFile) cmd.input(audioFile);

      const filters = [];
      localImages.forEach((_, i) => {
        const caption = project.captions?.[i];
        const draw =
          caption && font
            ? `,drawtext=fontfile='${font}':text='${escapeDraw(caption)}':fontcolor=white:fontsize=${Math.round(
                h / 22
              )}:box=1:boxcolor=black@0.45:boxborderw=24:x=(w-text_w)/2:y=h-text_h-120`
            : '';
        filters.push(
          `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fade=t=in:st=0:d=0.4${draw}[v${i}]`
        );
      });
      filters.push(`${localImages.map((_, i) => `[v${i}]`).join('')}concat=n=${localImages.length}:v=1:a=0[outv]`);

      cmd.complexFilter(filters, 'outv');
      const outOpts = ['-map [outv]', '-r 30', '-pix_fmt yuv420p', '-movflags +faststart', '-c:v libx264'];
      if (audioFile) outOpts.push(`-map ${localImages.length}:a`, '-c:a aac', '-shortest');
      cmd
        .outputOptions(outOpts)
        .on('start', (c) => logger.debug('ffmpeg:', c))
        .on('error', reject)
        .on('end', resolve)
        .save(output);
    });

    let outputUrl;
    if (cloudinaryEnabled()) {
      const up = await uploadMedia(output, { folder: 'mkt_studio/videos' });
      outputUrl = up.url;
    } else {
      outputUrl = `${env.apiBaseUrl}/media/renders/${projectId}.mp4`;
    }

    await prisma.videoProject.update({ where: { id: projectId }, data: { status: 'READY', outputUrl, error: null } });
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
