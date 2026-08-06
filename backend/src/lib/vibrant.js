import { logger } from './logger.js';

/**
 * Brand palette extraction (Feature 5). Uses node-vibrant when available
 * (declared as an optionalDependency so a native build failure never breaks
 * install), and falls back to a deterministic palette otherwise.
 */

async function toBuffer(src) {
  if (!src) return null;
  if (src.startsWith('data:')) {
    const base64 = src.slice(src.indexOf(',') + 1);
    return Buffer.from(base64, 'base64');
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error(`fetch image ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function loadVibrant() {
  // v4 exposes a Node entrypoint; v3 exposes a default export.
  try {
    const mod = await import('node-vibrant/node');
    return mod.Vibrant || mod.default?.Vibrant || mod.default;
  } catch {
    try {
      const mod = await import('node-vibrant');
      return mod.default || mod.Vibrant || mod;
    } catch {
      return null;
    }
  }
}

const ROLE_MAP = [
  ['Vibrant', 'primary'],
  ['DarkVibrant', 'secondary'],
  ['LightVibrant', 'accent'],
  ['Muted', 'muted'],
  ['DarkMuted', 'dark'],
  ['LightMuted', 'light'],
];

function fallbackPalette(seedStr = 'brand') {
  let h = 0;
  for (let i = 0; i < seedStr.length; i += 1) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  const base = h % 360;
  const hsl = (deg, s, l) => {
    // minimal hsl->hex
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n) => {
      const k = (n + deg / 30) % 12;
      const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * c)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  return [
    { hex: hsl(base, 70, 50), name: 'Primary', role: 'primary' },
    { hex: hsl((base + 30) % 360, 65, 35), name: 'Secondary', role: 'secondary' },
    { hex: hsl((base + 180) % 360, 75, 60), name: 'Accent', role: 'accent' },
    { hex: hsl(base, 20, 92), name: 'Light', role: 'light' },
    { hex: hsl(base, 25, 15), name: 'Dark', role: 'dark' },
  ];
}

export async function extractPalette(src) {
  try {
    const Vibrant = await loadVibrant();
    if (!Vibrant) {
      logger.warn('node-vibrant not installed — using fallback palette.');
      return { palette: fallbackPalette(src), source: 'fallback' };
    }
    const buffer = await toBuffer(src);
    const builder = Vibrant.from ? Vibrant.from(buffer) : new Vibrant(buffer);
    const swatches = await builder.getPalette();

    const palette = ROLE_MAP.map(([key, role]) => {
      const sw = swatches[key];
      return sw ? { hex: sw.hex, name: key, role, population: sw.population } : null;
    }).filter(Boolean);

    return {
      palette: palette.length ? palette : fallbackPalette(src),
      source: palette.length ? 'vibrant' : 'fallback',
    };
  } catch (err) {
    logger.warn('Palette extraction failed, using fallback:', err.message);
    return { palette: fallbackPalette(src), source: 'fallback' };
  }
}

export default { extractPalette };
