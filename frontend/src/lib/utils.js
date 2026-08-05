import { clsx } from 'clsx';
import { format, formatDistanceToNow, isValid } from 'date-fns';

/** className combiner. */
export const cn = (...args) => clsx(args);

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

export const money = (amount, currency = 'BDT') => {
  if (amount == null) return '—';
  const symbol = currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${Number(amount).toLocaleString('en-IN')}`;
};

export const fmtDate = (d, f = 'MMM d, yyyy') => {
  if (!d) return '—';
  const date = new Date(d);
  return isValid(date) ? format(date, f) : '—';
};

export const fmtDateTime = (d) => fmtDate(d, 'MMM d, yyyy · h:mm a');

export const timeAgo = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : '';
};

export const compactNumber = (n) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

export const truncate = (s = '', n = 100) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Post lifecycle → tailwind classes + label. */
export const STATUS_META = {
  DRAFT: { label: 'Draft', cls: 'bg-slate-500/15 text-slate-500' },
  PENDING_REVIEW: { label: 'Pending review', cls: 'bg-amber-500/15 text-amber-500' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-500/15 text-emerald-500' },
  SCHEDULED: { label: 'Scheduled', cls: 'bg-blue-500/15 text-blue-500' },
  PUBLISHING: { label: 'Publishing', cls: 'bg-brand-500/15 text-brand-400' },
  PUBLISHED: { label: 'Published', cls: 'bg-green-500/15 text-green-500' },
  FAILED: { label: 'Failed', cls: 'bg-red-500/15 text-red-500' },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-500/15 text-rose-500' },
  ARCHIVED: { label: 'Archived', cls: 'bg-slate-500/15 text-slate-400' },
  QUEUED: { label: 'Queued', cls: 'bg-slate-500/15 text-slate-500' },
  RUNNING: { label: 'Running', cls: 'bg-blue-500/15 text-blue-500' },
  RETRYING: { label: 'Retrying', cls: 'bg-amber-500/15 text-amber-500' },
  SUCCESS: { label: 'Success', cls: 'bg-green-500/15 text-green-500' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-500/15 text-slate-400' },
  READY: { label: 'Ready', cls: 'bg-green-500/15 text-green-500' },
  RENDERING: { label: 'Rendering', cls: 'bg-brand-500/15 text-brand-400' },
  COMPLETED: { label: 'Completed', cls: 'bg-green-500/15 text-green-500' },
  GENERATING: { label: 'Generating', cls: 'bg-brand-500/15 text-brand-400' },
};

export const PLATFORM_META = {
  FACEBOOK: { label: 'Facebook', color: '#1877F2', short: 'FB' },
  INSTAGRAM: { label: 'Instagram', color: '#E4405F', short: 'IG' },
  WHATSAPP: { label: 'WhatsApp', color: '#25D366', short: 'WA' },
  GENERIC: { label: 'Generic', color: '#7c3aed', short: 'GEN' },
};

/** Read a file input as a data URL (for uploads). */
export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
