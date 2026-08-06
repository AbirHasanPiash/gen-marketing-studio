import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode, Plus, Download, Trash2, ScanLine, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { Card, CardBody, Button, Input, Field, Switch, Modal, EmptyState, Skeleton } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, post, del } from '../lib/api';
import { fmtDate, truncate } from '../lib/utils';

export default function QrPage() {
  const qc = useQueryClient();
  const { activeBrandId } = useActiveBrand();
  const [creating, setCreating] = useState(false);

  const { data: codes, isLoading } = useQuery({
    queryKey: ['qr', activeBrandId],
    queryFn: () => get(`/qr?brandId=${activeBrandId}`),
    enabled: Boolean(activeBrandId),
  });

  const create = useMutation({
    mutationFn: (c) => post('/qr', { ...c, brandId: activeBrandId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qr'] }); setCreating(false); toast.success('QR code created'); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => del(`/qr/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qr'] }); toast.success('Deleted'); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="QR Codes" description="Generate scannable codes that link to your landing pages or campaigns." icon={QrCode}
        actions={<Button onClick={() => setCreating(true)} disabled={!activeBrandId}><Plus className="h-4 w-4" /> New QR</Button>} />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
      ) : codes?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {codes.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="grid place-items-center bg-white p-6">
                {c.dataUrl ? <img src={c.dataUrl} alt={c.label} className="h-40 w-40" /> : <div className="h-40 w-40 bg-slate-100" />}
              </div>
              <CardBody className="p-4">
                <h3 className="font-medium text-fg truncate">{c.label}</h3>
                <a href={c.targetUrl} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-xs text-brand-500 hover:underline truncate">
                  <ExternalLink className="h-3 w-3 shrink-0" /> {truncate(c.targetUrl, 30)}
                </a>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="flex items-center gap-1 text-xs text-muted"><ScanLine className="h-3.5 w-3.5" /> {c.scanCount} scans</span>
                  <div className="flex gap-1">
                    <a href={c.dataUrl} download={`qr-${c.label}.png`}><Button size="icon-sm" variant="ghost"><Download className="h-4 w-4" /></Button></a>
                    <Button size="icon-sm" variant="ghost" className="text-red-500" onClick={() => remove.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card><EmptyState icon={QrCode} title="No QR codes yet" description="Create a QR code that tracks scans and redirects to any URL."
          action={<Button onClick={() => setCreating(true)} disabled={!activeBrandId}><Plus className="h-4 w-4" /> New QR</Button>} /></Card>
      )}

      {creating && <QrModal onClose={() => setCreating(false)} onSave={(c) => create.mutate(c)} saving={create.isPending} />}
    </div>
  );
}

function QrModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ label: '', targetUrl: '', fgColor: '#000000', bgColor: '#ffffff', tracked: true });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title="New QR code" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(form)} loading={saving} disabled={!form.label || !form.targetUrl}>Generate</Button></>}>
      <div className="space-y-4">
        <Field label="Label"><Input value={form.label} onChange={set('label')} placeholder="Eid campaign" /></Field>
        <Field label="Target URL"><Input value={form.targetUrl} onChange={set('targetUrl')} placeholder="https://…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Foreground"><input type="color" value={form.fgColor} onChange={set('fgColor')} className="h-10 w-full rounded-lg border border-border" /></Field>
          <Field label="Background"><input type="color" value={form.bgColor} onChange={set('bgColor')} className="h-10 w-full rounded-lg border border-border" /></Field>
        </div>
        <Switch checked={form.tracked} onChange={(v) => setForm({ ...form, tracked: v })} label="Track scans (redirect through mkt_studio)" />
      </div>
    </Modal>
  );
}
