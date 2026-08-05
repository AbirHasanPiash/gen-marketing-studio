import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { ImageUploader } from '../components/shared/ImageUploader';
import {
  Card, CardBody, Button, Input, Textarea, Field, Modal, ConfirmDialog, Badge, EmptyState, Skeleton, Menu, MenuItem,
} from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { useAuth } from '../store/auth';
import { get, post, patch, del } from '../lib/api';
import { money } from '../lib/utils';

const emptyProduct = { name: '', sku: '', description: '', price: '', currency: 'BDT', category: '', images: [], tags: [] };

export default function ProductsPage() {
  const qc = useQueryClient();
  const { activeBrandId, activeBrand } = useActiveBrand();
  const isOwner = useAuth((s) => s.user?.role === 'OWNER');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products', activeBrandId, search],
    queryFn: () => get(`/products?brandId=${activeBrandId}&limit=100${search ? `&search=${search}` : ''}`),
    enabled: Boolean(activeBrandId),
  });

  const save = useMutation({
    mutationFn: (p) => {
      const body = { ...p, brandId: activeBrandId, price: p.price === '' ? null : Number(p.price) };
      return p.id ? patch(`/products/${p.id}`, body) : post('/products', body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setEditing(null); toast.success('Product saved'); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => del(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setToDelete(null); toast.success('Deleted'); },
    onError: (e) => toast.error(e.message),
  });

  const products = data?.data || data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description={activeBrand ? `Catalog for ${activeBrand.name}` : 'Select a brand'}
        icon={Package}
        actions={<Button onClick={() => setEditing({ ...emptyProduct })} disabled={!activeBrandId}><Plus className="h-4 w-4" /> Add Product</Button>}
      />

      <Input icon={Search} placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : products.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <Card key={p.id} hover className="overflow-hidden group">
              <div className="aspect-square overflow-hidden bg-elevated">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="grid h-full place-items-center text-muted"><Package className="h-10 w-10" /></div>
                )}
              </div>
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-fg truncate">{p.name}</h3>
                    {p.category && <Badge className="mt-1">{p.category}</Badge>}
                  </div>
                  <Menu trigger={() => <button className="rounded-lg p-1 text-muted hover:bg-elevated hover:text-fg">⋯</button>}>
                    <MenuItem icon={Pencil} onClick={() => setEditing(p)}>Edit</MenuItem>
                    {isOwner && <MenuItem icon={Trash2} danger onClick={() => setToDelete(p)}>Delete</MenuItem>}
                  </Menu>
                </div>
                <p className="mt-2 font-display text-lg font-bold text-brand-500">{money(p.price, p.currency)}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Package} title="No products yet" description="Add products to reference them in briefs and posts."
            action={<Button onClick={() => setEditing({ ...emptyProduct })} disabled={!activeBrandId}><Plus className="h-4 w-4" /> Add Product</Button>} />
        </Card>
      )}

      {editing && <ProductModal product={editing} onClose={() => setEditing(null)} onSave={(p) => save.mutate(p)} saving={save.isPending} />}
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} onConfirm={() => remove.mutate(toDelete.id)}
        title={`Delete ${toDelete?.name}?`} message="This product will be removed from your catalog." confirmLabel="Delete" danger loading={remove.isPending} />
    </div>
  );
}

function ProductModal({ product, onClose, onSave, saving }) {
  const [form, setForm] = useState({ ...product, tags: (product.tags || []).join(', ') });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = () => onSave({ ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) });

  return (
    <Modal open onClose={onClose} title={product.id ? 'Edit product' : 'Add product'} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={saving} disabled={!form.name}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Product image">
            <ImageUploader value={form.images?.[0] || ''} onChange={(url) => setForm({ ...form, images: url ? [url] : [] })} folder="products" aspect="aspect-video" />
          </Field>
        </div>
        <Field label="Name"><Input value={form.name} onChange={set('name')} placeholder="Jamdani Saree" /></Field>
        <Field label="SKU"><Input value={form.sku || ''} onChange={set('sku')} placeholder="SAR-001" /></Field>
        <Field label="Price"><Input type="number" value={form.price ?? ''} onChange={set('price')} placeholder="8500" /></Field>
        <Field label="Category"><Input value={form.category || ''} onChange={set('category')} placeholder="Saree" /></Field>
        <div className="sm:col-span-2"><Field label="Description"><Textarea value={form.description || ''} onChange={set('description')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Tags" hint="comma separated"><Input value={form.tags} onChange={set('tags')} placeholder="handloom, deshi" /></Field></div>
      </div>
    </Modal>
  );
}
