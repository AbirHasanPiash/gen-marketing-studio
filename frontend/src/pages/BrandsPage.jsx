import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store, Plus, Pencil, Trash2, Palette, Package, FileText, Images, Check, Sparkles, Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { ImageUploader } from '../components/shared/ImageUploader';
import {
  Card, CardBody, Button, Input, Textarea, Field, Modal, ConfirmDialog, Avatar, Badge, EmptyState, Skeleton, Menu, MenuItem,
} from '../components/ui';
import { useBrands } from '../hooks/useBrands';
import { useAuth } from '../store/auth';
import { get, post, patch, put, del } from '../lib/api';

const empty = { name: '', tagline: '', description: '', industry: '', website: '', logoUrl: '', email: '', phone: '', address: '' };

export default function BrandsPage() {
  const qc = useQueryClient();
  const { data: brands, isLoading } = useBrands();
  const isOwner = useAuth((s) => s.user?.role === 'OWNER');
  const [editing, setEditing] = useState(null); // brand or {} for new
  const [kitBrand, setKitBrand] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const save = useMutation({
    mutationFn: (b) => (b.id ? patch(`/brands/${b.id}`, b) : post('/brands', b)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brands'] });
      setEditing(null);
      toast.success('Brand saved');
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => del(`/brands/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brands'] });
      setToDelete(null);
      toast.success('Brand deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands"
        description="Manage your business profiles and brand kits."
        icon={Store}
        actions={isOwner && <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4" /> New Brand</Button>}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : brands?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => (
            <Card key={b.id} hover className="overflow-hidden">
              <div className="h-20 bg-gradient-to-r from-brand-500/20 to-brand-700/20" />
              <CardBody className="-mt-12">
                <div className="flex items-start justify-between">
                  <Avatar name={b.name} src={b.logoUrl} size="lg" className="ring-4 ring-card" />
                  {isOwner && (
                    <Menu
                      trigger={() => (
                        <button className="mt-12 rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-fg">⋯</button>
                      )}
                    >
                      <MenuItem icon={Pencil} onClick={() => setEditing(b)}>Edit</MenuItem>
                      <MenuItem icon={Palette} onClick={() => setKitBrand(b)}>Brand kit</MenuItem>
                      <MenuItem icon={Trash2} danger onClick={() => setToDelete(b)}>Delete</MenuItem>
                    </Menu>
                  )}
                </div>
                <h3 className="mt-3 font-display font-semibold text-fg">{b.name}</h3>
                <p className="text-sm text-muted line-clamp-1">{b.tagline || b.industry || '—'}</p>

                {b.brandKit?.palette?.length ? (
                  <div className="mt-3 flex items-center gap-1">
                    {b.brandKit.palette.slice(0, 5).map((c, i) => (
                      <span key={i} className="h-5 w-5 rounded-md ring-1 ring-border" style={{ background: c.hex }} title={c.hex} />
                    ))}
                    {b.brandKit.locked && <Lock className="h-3.5 w-3.5 text-muted ml-1" />}
                  </div>
                ) : (
                  <button onClick={() => setKitBrand(b)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand-500 hover:underline">
                    <Palette className="h-3.5 w-3.5" /> Create brand kit
                  </button>
                )}

                <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted">
                  <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {b._count?.products || 0}</span>
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {b._count?.posts || 0}</span>
                  <span className="flex items-center gap-1"><Images className="h-3.5 w-3.5" /> {b._count?.assets || 0}</span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Store}
            title="No brands yet"
            description="Create your first brand profile to start planning content."
            action={isOwner && <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4" /> New Brand</Button>}
          />
        </Card>
      )}

      {editing && <BrandModal brand={editing} onClose={() => setEditing(null)} onSave={(b) => save.mutate(b)} saving={save.isPending} />}
      {kitBrand && <BrandKitModal brand={kitBrand} onClose={() => setKitBrand(null)} />}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => remove.mutate(toDelete.id)}
        title={`Delete ${toDelete?.name}?`}
        message="This permanently removes the brand and all its posts, products and assets."
        confirmLabel="Delete brand"
        danger
        loading={remove.isPending}
      />
    </div>
  );
}

function BrandModal({ brand, onClose, onSave, saving }) {
  const [form, setForm] = useState(brand);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal
      open
      onClose={onClose}
      title={brand.id ? 'Edit brand' : 'New brand'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} loading={saving} disabled={!form.name}>Save brand</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Logo">
            <ImageUploader value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} folder="logos" aspect="aspect-[3/1]" />
          </Field>
        </div>
        <Field label="Brand name"><Input value={form.name} onChange={set('name')} placeholder="Nokshi Threads" /></Field>
        <Field label="Industry"><Input value={form.industry || ''} onChange={set('industry')} placeholder="Fashion & Apparel" /></Field>
        <div className="sm:col-span-2">
          <Field label="Tagline"><Input value={form.tagline || ''} onChange={set('tagline')} placeholder="Handwoven heritage, reimagined." /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description"><Textarea value={form.description || ''} onChange={set('description')} placeholder="What does this brand do?" /></Field>
        </div>
        <Field label="Website"><Input value={form.website || ''} onChange={set('website')} placeholder="https://…" /></Field>
        <Field label="Email"><Input value={form.email || ''} onChange={set('email')} placeholder="hello@brand.com" /></Field>
        <Field label="Phone"><Input value={form.phone || ''} onChange={set('phone')} placeholder="+8801…" /></Field>
        <Field label="Address"><Input value={form.address || ''} onChange={set('address')} placeholder="Dhaka" /></Field>
      </div>
    </Modal>
  );
}

function BrandKitModal({ brand, onClose }) {
  const qc = useQueryClient();
  const [palette, setPalette] = useState(brand.brandKit?.palette || []);
  const [logoUrl, setLogoUrl] = useState(brand.brandKit?.logoUrl || brand.logoUrl || '');

  const extract = useMutation({
    mutationFn: () => post(`/brands/${brand.id}/kit/extract`, { logoUrl }),
    onSuccess: (res) => {
      setPalette(res.palette);
      toast.success(`Palette extracted (${res.source})`);
    },
    onError: (e) => toast.error(e.message),
  });

  const saveKit = useMutation({
    mutationFn: (locked) => put(`/brands/${brand.id}/kit`, { palette, logoUrl, locked }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand kit saved');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${brand.name} — Brand Kit`}
      subtitle="Extract and lock your brand colours from your logo."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="secondary" onClick={() => saveKit.mutate(false)} disabled={!palette.length} loading={saveKit.isPending && !saveKit.variables}>Save</Button>
          <Button onClick={() => saveKit.mutate(true)} disabled={!palette.length}><Lock className="h-4 w-4" /> Save & lock</Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Field label="Logo source">
            <ImageUploader value={logoUrl} onChange={setLogoUrl} folder="logos" aspect="aspect-square" />
          </Field>
          <Button className="mt-3 w-full" variant="subtle" onClick={() => extract.mutate()} loading={extract.isPending} disabled={!logoUrl}>
            <Sparkles className="h-4 w-4" /> Extract palette
          </Button>
        </div>
        <div>
          <p className="label">Palette</p>
          {palette.length ? (
            <div className="space-y-2">
              {palette.map((c, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-2">
                  <span className="h-9 w-9 rounded-lg ring-1 ring-border" style={{ background: c.hex }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-fg">{c.hex}</p>
                    <p className="text-xs text-muted capitalize">{c.role || c.name}</p>
                  </div>
                  <Check className="h-4 w-4 text-brand-500" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border text-sm text-muted">
              Extract a palette from your logo
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
