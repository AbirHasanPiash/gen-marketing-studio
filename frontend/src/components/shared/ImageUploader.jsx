import { useRef, useState } from 'react';
import { UploadCloud, X, Loader2, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { post } from '../../lib/api';
import { fileToDataUrl, cn } from '../../lib/utils';
import { Button } from '../ui';

/**
 * Image picker with drag-drop + URL entry. Uploads to Cloudinary via the
 * backend (falls back to the data URI in mock mode) and returns the URL.
 */
export function ImageUploader({ value, onChange, folder = 'uploads', aspect = 'aspect-video', className, upload = true }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

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

  const addByUrl = () => {
    const url = window.prompt('Paste an image URL');
    if (url) onChange(url);
  };

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
              addByUrl();
            }}
          >
            <LinkIcon className="h-3.5 w-3.5" /> Use URL
          </Button>
        </>
      )}
    </div>
  );
}

export default ImageUploader;
