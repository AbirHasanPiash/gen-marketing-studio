import { useRef, useState } from 'react';
import { UploadCloud, X, Loader2, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { post } from '../../lib/api';
import { fileToDataUrl, cn } from '../../lib/utils';
import { Button, Input, Modal } from '../ui';

const isUsableUrl = (value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' || protocol === 'data:';
  } catch {
    return false;
  }
};

/**
 * Image picker with drag-drop + URL entry. Uploads to Cloudinary via the
 * backend (falls back to the data URI in mock mode) and returns the URL.
 */
export function ImageUploader({ value, onChange, folder = 'uploads', aspect = 'aspect-video', className, upload = true }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return toast.error('Please choose an image file');
    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (upload) {
        const res = await post('/media/upload', { source: dataUrl, folder });
        onChange(res.url, res);
      } else {
        onChange(dataUrl);
      }
    } catch (e) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
    return undefined;
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const openUrlDialog = () => {
    setUrlDraft('');
    setUrlError('');
    setUrlOpen(true);
  };

  const submitUrl = () => {
    const url = urlDraft.trim();
    if (!isUsableUrl(url)) {
      setUrlError('Enter a full image URL starting with http:// or https://');
      return;
    }
    onChange(url);
    setUrlOpen(false);
  };

  const urlDialog = (
    <Modal
      open={urlOpen}
      onClose={() => setUrlOpen(false)}
      title="Use an image URL"
      subtitle="Paste a direct link to a PNG, JPG or WEBP file."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setUrlOpen(false)}>Cancel</Button>
          <Button onClick={submitUrl} disabled={!urlDraft.trim()}>Use image</Button>
        </>
      }
    >
      <Input
        autoFocus
        value={urlDraft}
        onChange={(e) => { setUrlDraft(e.target.value); setUrlError(''); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitUrl();
          }
        }}
        placeholder="https://example.com/product.png"
      />
      {urlError && <p className="mt-2 text-xs text-red-500">{urlError}</p>}
    </Modal>
  );

  if (value) {
    return (
      <div className={cn('relative group overflow-hidden rounded-xl border border-border bg-elevated', aspect, className)}>
        <img src={value} alt="" className="h-full w-full object-cover" />
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/40">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-2 right-2 rounded-lg bg-slate-950/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    /* The dialog is a sibling of the dropzone: React portals still bubble events
       through the component tree, so nesting it would re-open the file picker. */
    <>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition',
          aspect,
          dragging ? 'border-brand-500 bg-brand-500/5' : 'border-border hover:border-brand-500/60 hover:bg-elevated',
          className
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        ) : (
          <>
            <UploadCloud className="h-7 w-7 text-muted" />
            <p className="mt-2 text-sm font-medium text-fg">Drop image or click to upload</p>
            <p className="text-xs text-muted">PNG, JPG, WEBP</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation();
                openUrlDialog();
              }}
            >
              <LinkIcon className="h-3.5 w-3.5" /> Use URL
            </Button>
          </>
        )}
      </div>
      {urlDialog}
    </>
  );
}

export default ImageUploader;
