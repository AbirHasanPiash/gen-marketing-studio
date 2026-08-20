import { useRef, useState } from 'react';
import { Music, Upload, X, Loader2, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { post } from '../../lib/api';
import { fileToDataUrl, cn } from '../../lib/utils';
import { Button, Input, Modal } from '../ui';

const MAX_BYTES = 12 * 1024 * 1024;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm|mp4)$/i;

const fileNameFromUrl = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop()) || url;
  } catch {
    return url;
  }
};

/**
 * Soundtrack picker for the Video Studio. Uploads the file itself rather than
 * storing a link, because the render job has to be able to fetch the audio
 * server-side — most music sites serve a player page, not the file.
 */
export function AudioUploader({ value, onChange, className }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('Choose an audio file — MP3, WAV, M4A, OGG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name} is ${(file.size / 1e6).toFixed(1)} MB — the limit is 12 MB.`);
      return;
    }
    setLoading(true);
    try {
      const source = await fileToDataUrl(file);
      const res = await post('/media/upload-audio', { source });
      setName(file.name);
      onChange(res.url, res);
      toast.success(`${file.name} attached`);
    } catch (e) {
      toast.error(e.message || 'Audio upload failed');
    } finally {
      setLoading(false);
    }
  };

  const submitUrl = () => {
    const url = urlDraft.trim();
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      setUrlError('Enter a full URL starting with http:// or https://');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      setUrlError('Enter a full URL starting with http:// or https://');
      return;
    }
    setName('');
    onChange(url);
    setUrlOpen(false);
  };

  // Warn rather than block: plenty of CDNs serve audio from extensionless paths.
  const looksLikeAPage = urlDraft.trim() && !AUDIO_EXT.test((() => {
    try { return new URL(urlDraft.trim()).pathname; } catch { return ''; }
  })());

  const urlDialog = (
    <Modal
      open={urlOpen}
      onClose={() => setUrlOpen(false)}
      title="Link a soundtrack"
      subtitle="The server downloads this during the render, so it must point straight at the audio file."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setUrlOpen(false)}>Cancel</Button>
          <Button onClick={submitUrl} disabled={!urlDraft.trim()}>Use link</Button>
        </>
      }
    >
      <Input
        autoFocus
        value={urlDraft}
        onChange={(e) => { setUrlDraft(e.target.value); setUrlError(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitUrl(); } }}
        placeholder="https://cdn.example.com/track.mp3"
      />
      {urlError ? (
        <p className="mt-2 text-xs text-red-500">{urlError}</p>
      ) : looksLikeAPage ? (
        <p className="mt-2 text-xs text-amber-600">
          This doesn&apos;t end in a file extension. A page like <code>pixabay.com/music/…</code> won&apos;t work —
          download the track and upload it instead.
        </p>
      ) : null}
    </Modal>
  );

  if (value) {
    return (
      <>
        <div className={cn('flex items-center gap-3 rounded-xl border border-border bg-elevated p-3', className)}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500">
            <Music className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{name || fileNameFromUrl(value)}</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={value} controls className="mt-1.5 h-8 w-full" />
          </div>
          <button
            type="button"
            onClick={() => { setName(''); onChange(''); }}
            className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-card hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {urlDialog}
      </>
    );
  }

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-3', className)}>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload audio
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setUrlDraft(''); setUrlError(''); setUrlOpen(true); }}>
          <LinkIcon className="h-3.5 w-3.5" /> Use URL
        </Button>
        <span className="text-xs text-muted">MP3, WAV, M4A · up to 12 MB</span>
      </div>
      {urlDialog}
    </>
  );
}

export default AudioUploader;
