import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, CheckCircle2, XCircle, Clock, CalendarCheck, Send, FileImage } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { RejectDialog } from '../components/shared/RejectDialog';
import { Card, Button, StatusBadge, PlatformDot, Avatar, EmptyState, Skeleton } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { useAuth } from '../store/auth';
import { get, post } from '../lib/api';
import { timeAgo, truncate, cn } from '../lib/utils';

const COLUMNS = [
  { status: 'PENDING_REVIEW', label: 'Pending Review', icon: Clock, tone: 'text-amber-500' },
  { status: 'APPROVED', label: 'Approved', icon: CheckCircle2, tone: 'text-emerald-500' },
  { status: 'SCHEDULED', label: 'Scheduled', icon: CalendarCheck, tone: 'text-blue-500' },
  { status: 'PUBLISHED', label: 'Published', icon: Send, tone: 'text-green-500' },
];

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const { activeBrandId } = useActiveBrand();
  const isOwner = useAuth((s) => s.user?.role === 'OWNER');
  const [rejectingId, setRejectingId] = useState(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ['approvals', activeBrandId],
    queryFn: () => get(`/posts?brandId=${activeBrandId}`),
    enabled: Boolean(activeBrandId),
  });

  const act = useMutation({
    mutationFn: ({ id, verb, payload }) => post(`/posts/${id}/${verb}`, payload || {}),
    onSuccess: (_, { verb }) => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast.success(verb === 'approve' ? 'Approved ✓' : 'Changes requested');
    },
    onError: (e) => toast.error(e.message),
  });

  const grouped = (status) => (posts || []).filter((p) => p.status === status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description={isOwner ? 'Review and approve content submitted by your team.' : 'Track your submissions through the pipeline.'}
        icon={CheckSquare}
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = grouped(col.status);
            return (
              <div key={col.status} className="flex flex-col">
                <div className="flex items-center gap-2 px-1 pb-3">
                  <col.icon className={cn('h-4 w-4', col.tone)} />
                  <h3 className="font-display font-semibold text-fg">{col.label}</h3>
                  <span className="ml-auto rounded-full bg-border/70 px-2 py-0.5 text-xs">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.length ? (
                    items.map((p) => (
                      <Card key={p.id} className="overflow-hidden">
                        {p.mediaUrls?.[0] && (
                          <Link to={`/posts/${p.id}`} className="block aspect-video overflow-hidden bg-elevated">
                            <img src={p.mediaUrls[0]} alt="" className="h-full w-full object-cover" />
                          </Link>
                        )}
                        <div className="p-3">
                          <Link to={`/posts/${p.id}`}>
                            <p className="font-medium text-fg hover:text-brand-500 transition truncate">{p.title || 'Untitled'}</p>
                            <p className="mt-1 text-xs text-muted line-clamp-2">{truncate(p.body, 90) || 'No caption'}</p>
                          </Link>
                          <div className="mt-2.5 flex items-center gap-1.5">
                            {p.platforms?.map((pl) => <PlatformDot key={pl} platform={pl} />)}
                            <span className="ml-auto flex items-center gap-1 text-xs text-muted">
                              <Avatar name={p.author?.name} size="xs" /> {timeAgo(p.updatedAt)}
                            </span>
                          </div>

                          {col.status === 'PENDING_REVIEW' && isOwner && (
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="success" className="flex-1"
                                onClick={() => act.mutate({ id: p.id, verb: 'approve' })}>
                                <CheckCircle2 className="h-4 w-4" /> Approve
                              </Button>
                              <Button size="sm" variant="danger"
                                onClick={() => setRejectingId(p.id)}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {col.status !== 'PENDING_REVIEW' && <StatusBadge status={p.status} className="mt-3" />}
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">
                      Nothing here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RejectDialog
        open={Boolean(rejectingId)}
        onClose={() => setRejectingId(null)}
        loading={act.isPending}
        onSubmit={(reason) => {
          act.mutate({ id: rejectingId, verb: 'reject', payload: { reason } });
          setRejectingId(null);
        }}
      />

      {posts && posts.length === 0 && (
        <Card><EmptyState icon={FileImage} title="No posts yet" description="Create and submit posts to see them flow through the approval pipeline."
          action={<Link to="/posts/new"><Button>Create a post</Button></Link>} /></Card>
      )}
    </div>
  );
}
