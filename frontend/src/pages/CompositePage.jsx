import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Save, Type, Image as ImageIcon, Eraser, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { ImageUploader } from '../components/shared/ImageUploader';
import { Card, CardHeader, CardBody, Button, Input, Field, Select } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { post } from '../lib/api';

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

/**
 * Cloudinary derives `e_background_removal` asynchronously — the first requests
 * for a fresh cutout come back 423 while it renders. Poll until the PNG really
 * exists, otherwise the canvas just drops the layer with no explanation.
 */
const waitForCutout = async (url, { attempts = 8, delayMs = 1500 } = {}) => {
  for (let i = 0; i < attempts; i += 1) {
    if (i) await new Promise((r) => { setTimeout(r, delayMs); });
    let res;
    try {
      res = await fetch(url, { cache: 'reload' });
    } catch {
      continue; // transient network blip → retry
    }
    if (res.ok) return url;
    if (res.status !== 423 && res.status !== 404) throw new Error(`Background removal failed (${res.status})`);
  }
  throw new Error('Cutout is still rendering — try Remove background again in a moment.');
};

const POSITIONS = { bottom: 'Bottom', center: 'Center', top: 'Top' };

export default function CompositePage() {
  const qc = useQueryClient();
  const { activeBrandId } = useActiveBrand();
  const canvasRef = useRef(null);
  const [bg, setBg] = useState('');
  const [bgId, setBgId] = useState(null);
  const [product, setProduct] = useState('');          // the layer actually composited
  const [productOriginal, setProductOriginal] = useState('');
  const [productId, setProductId] = useState(null);
  const [cutout, setCutout] = useState('');            // background-removed PNG, once derived
  const [text, setText] = useState('New Arrival');
  const [textColor, setTextColor] = useState('#ffffff');
  const [accent, setAccent] = useState('#7c3aed');
  const [fontSize, setFontSize] = useState(72);
  const [pos, setPos] = useState('bottom');
  const [tainted, setTainted] = useState(false);

  const usingCutout = Boolean(cutout) && product === cutout;
  const SIZE = 1080;

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, SIZE, SIZE);
      // Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, SIZE, SIZE);
      if (bg) {
        try {
          const img = await loadImage(bg);
          if (cancelled) return;
          const scale = Math.max(SIZE / img.width, SIZE / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
        } catch { /* ignore */ }
      }
      // Product cutout — a transparent PNG keeps its alpha here, so the shadow
      // below traces the product silhouette instead of a rectangle.
      if (product) {
        try {
          const img = await loadImage(product);
          if (cancelled) return;
          const maxW = SIZE * 0.68;
          const scale = Math.min(maxW / img.width, (SIZE * 0.62) / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const y = pos === 'top' ? SIZE * 0.28 : pos === 'center' ? (SIZE - h) / 2 : SIZE * 0.4;
          ctx.shadowColor = 'rgba(0,0,0,0.35)';
          ctx.shadowBlur = 40;
          ctx.shadowOffsetY = 20;
          ctx.drawImage(img, (SIZE - w) / 2, y - h / 2 + SIZE * 0.1, w, h);
          ctx.shadowColor = 'transparent';
        } catch { /* ignore */ }
      }
      // Text overlay
      if (text) {
        const y = pos === 'top' ? 120 : pos === 'center' ? SIZE / 2 : SIZE - 150;
        ctx.font = `800 ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        const metrics = ctx.measureText(text);
        const padX = 44;
        const boxW = Math.min(SIZE - 80, metrics.width + padX * 2);
        const boxH = fontSize + 44;
        ctx.fillStyle = accent;
        const rx = (SIZE - boxW) / 2;
        const ry = y - boxH / 2;
        const r = 24;
        ctx.beginPath();
        ctx.moveTo(rx + r, ry);
        ctx.arcTo(rx + boxW, ry, rx + boxW, ry + boxH, r);
        ctx.arcTo(rx + boxW, ry + boxH, rx, ry + boxH, r);
        ctx.arcTo(rx, ry + boxH, rx, ry, r);
        ctx.arcTo(rx, ry, rx + boxW, ry, r);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, SIZE / 2, y + 2);
      }
      // Detect taint
      try {
        canvas.getContext('2d').getImageData(0, 0, 1, 1);
        setTainted(false);
      } catch {
        setTainted(true);
      }
    };
    draw();
    return () => { cancelled = true; };
  }, [bg, product, text, textColor, accent, fontSize, pos]);

  const pickProduct = (url, meta) => {
    setProduct(url);
    setProductOriginal(url);
    setProductId(meta?.publicId ?? null);
    setCutout('');
  };

  /** Feature 5 background removal, fed straight into the product layer. */
  const removeBg = useMutation({
    mutationFn: async () => {
      if (cutout) return cutout; // already derived — just swap it back in
      let publicId = productId;
      if (!publicId) {
        // Pasted URLs never went through Cloudinary; e_background_removal needs
        // a public id, so ingest it first.
        const up = await post('/media/upload', { source: productOriginal, folder: 'composite' });
        publicId = up.publicId;
        setProductId(publicId);
      }
      const res = await post('/media/remove-bg', { publicId, url: productOriginal });
      if (!res.applied) throw new Error('Background removal needs Cloudinary credentials on the server.');
      return waitForCutout(res.url);
    },
    onSuccess: (url) => {
      setCutout(url);
      setProduct(url);
      toast.success('Background removed — compositing the cutout');
    },
    onError: (e) => toast.error(e.message || 'Background removal failed'),
  });

  const saveComposite = useMutation({
    mutationFn: async () => {
      let dataUrl;
      try {
        dataUrl = canvasRef.current.toDataURL('image/png');
      } catch {
        // Canvas tainted by cross-origin images → composite server-side instead.
        // When the cutout is active we pass its URL (not the original public id)
        // so Cloudinary re-ingests the transparent PNG as the overlay layer.
        const res = await post('/media/composite', {
          backgroundPublicId: bgId,
          backgroundUrl: bg,
          productPublicId: usingCutout ? null : productId,
          productUrl: product,
          text,
          textColor: textColor.replace('#', ''),
        });
        if (!res.url) throw new Error('Compositing needs Cloudinary for these images. Upload images instead of using external URLs.');
        return post('/assets', { url: res.url, source: 'COMPOSITED', brandId: activeBrandId, prompt: text });
      }
      const up = await post('/media/upload', { source: dataUrl, folder: 'composites' });
      return post('/assets', { url: up.url, source: 'COMPOSITED', brandId: activeBrandId, prompt: text });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Composite saved to library'); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Compositing" description="Layer product cutouts onto backgrounds with branded text overlays." icon={Layers} />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Layers</span>} />
            <CardBody className="space-y-4">
              <Field label="Background">
                <ImageUploader value={bg} onChange={(url, meta) => { setBg(url); setBgId(meta?.publicId ?? null); }} folder="composite" aspect="aspect-video" />
              </Field>
              <Field label="Product (PNG cutout works best)">
                <ImageUploader value={product} onChange={pickProduct} folder="composite" aspect="aspect-video" />
              </Field>
              {productOriginal && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="subtle"
                    onClick={() => removeBg.mutate()}
                    loading={removeBg.isPending}
                    disabled={usingCutout}
                  >
                    <Eraser className="h-3.5 w-3.5" /> {usingCutout ? 'Background removed' : 'Remove background'}
                  </Button>
                  {cutout && (
                    <Button size="sm" variant="ghost" onClick={() => setProduct(usingCutout ? productOriginal : cutout)}>
                      <RotateCcw className="h-3.5 w-3.5" /> {usingCutout ? 'Use original' : 'Use cutout'}
                    </Button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted">Tip: generate a background in the Image Studio, drop the product photo on top, then hit Remove background — the transparent cutout is what gets composited and shadowed.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Type className="h-4 w-4" /> Text overlay</span>} />
            <CardBody className="space-y-4">
              <Field label="Text"><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="New Arrival" /></Field>
              <Field label="Position"><Select value={pos} onChange={(e) => setPos(e.target.value)}>{Object.entries(POSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Text colour"><input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card" /></Field>
                <Field label="Badge colour"><input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card" /></Field>
              </div>
              <Field label={`Font size · ${fontSize}px`}><input type="range" min={40} max={120} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full accent-brand-600" /></Field>
            </CardBody>
          </Card>
        </div>

        {/* Preview */}
        <Card>
          <CardHeader title="Preview" subtitle="1080 × 1080" action={<Button onClick={() => saveComposite.mutate()} loading={saveComposite.isPending} disabled={!bg && !product}><Save className="h-4 w-4" /> Save to library</Button>} />
          <CardBody>
            <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-border shadow-card">
              <canvas ref={canvasRef} width={SIZE} height={SIZE} className="block h-auto w-full" />
            </div>
            {(!bg && !product) && (
              <p className="mt-4 text-center text-sm text-muted">Add a background and product to start compositing.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
