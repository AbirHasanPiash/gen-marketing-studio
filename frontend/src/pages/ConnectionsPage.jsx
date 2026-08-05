import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlugZap, Plus, Unplug, CheckCircle2, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { Card, CardHeader, CardBody, Button, EmptyState, Skeleton, PlatformDot } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, post, del } from '../lib/api';
import { fmtDate } from '../lib/utils';

export default function ConnectionsPage() {
  const qc = useQueryClient();
  const { activeBrandId, activeBrand } = useActiveBrand();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get('connected')) { toast.success('Account connected 🎉'); setParams({}); }
    if (params.get('error')) { toast.error(`Connection failed: ${params.get('error')}`); setParams({}); }
  }, [params, setParams]);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['social', activeBrandId],
    queryFn: () => get(`/social/accounts?brandId=${activeBrandId}`),
    enabled: Boolean(activeBrandId),
  });

  const connect = useMutation({
    mutationFn: () => get(`/social/meta/connect?brandId=${activeBrandId}`),
    onSuccess: (res) => {
      if (res.devMode) devConnect.mutate();
      else if (res.url) window.location.assign(res.url);
    },
    onError: (e) => toast.error(e.message),
  });

  const devConnect = useMutation({
    mutationFn: () => post('/social/meta/dev-connect', { brandId: activeBrandId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['social'] }); toast.success('Demo accounts connected'); },
    onError: (e) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: (id) => del(`/social/accounts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['social'] }); toast.success('Disconnected'); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Connections" description="Connect Facebook & Instagram to publish and pull analytics." icon={PlugZap} />

      <Card className="border-brand-500/30 bg-brand-500/5">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-500"><PlugZap className="h-6 w-6" /></div>
            <div>
              <h3 className="font-display font-semibold text-fg">Connect Meta for {activeBrand?.name || 'your brand'}</h3>
              <p className="text-sm text-muted">Authorize once to publish to Facebook Pages and Instagram Business accounts.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => connect.mutate()} loading={connect.isPending || devConnect.isPending} disabled={!activeBrandId}>
              <Plus className="h-4 w-4" /> Connect Meta
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-border bg-elevated/50 p-3 text-sm text-muted">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-brand-500" />
        <p>No Meta app configured? “Connect Meta” attaches <span className="font-medium text-fg">demo accounts</span> so you can test the full publishing & analytics pipeline offline. Add <code className="rounded bg-border/60 px-1">META_APP_ID</code> / <code className="rounded bg-border/60 px-1">META_APP_SECRET</code> to go live.</p>
      </div>

      <Card>
        <CardHeader title="Connected accounts" subtitle={accounts?.length ? `${accounts.length} connected` : 'None yet'} />
        <CardBody>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : accounts?.length ? (
            <div className="space-y-3">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl font-bold" style={{ background: a.platform === 'INSTAGRAM' ? '#E4405F18' : '#1877F218', color: a.platform === 'INSTAGRAM' ? '#E4405F' : '#1877F2' }}>
                    {a.platform === 'INSTAGRAM' ? 'IG' : 'f'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg truncate">{a.name}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Connected {fmtDate(a.createdAt)}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => disconnect.mutate(a.id)}><Unplug className="h-4 w-4" /> Disconnect</Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={PlugZap} title="No connections yet" description="Connect Meta to start publishing to Facebook and Instagram." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
