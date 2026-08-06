import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, RefreshCw, ExternalLink, AlertTriangle, Clock, CheckCircle2, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { Card, CardBody, Button, Tabs, StatusBadge, PlatformDot, EmptyState, Skeleton } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, post } from '../lib/api';
import { fmtDateTime, timeAgo, compactNumber } from '../lib/utils';

export default function PublishingPage() {
  const qc = useQueryClient();
  const { activeBrandId } = useActiveBrand();
  const [tab, setTab] = useState('jobs');

  const { data: jobs, isLoading: loadingJobs } = useQuery({
    queryKey: ['publish-jobs'],
    queryFn: () => get('/publish/jobs'),
    refetchInterval: (q) => (q.state.data?.some((j) => ['RUNNING', 'RETRYING', 'QUEUED'].includes(j.status)) ? 5000 : false),
  });
  const { data: pubs, isLoading: loadingPubs } = useQuery({
    queryKey: ['publications', activeBrandId],
    queryFn: () => get(`/publish/publications${activeBrandId ? `?brandId=${activeBrandId}` : ''}`),
    enabled: Boolean(activeBrandId),
  });

  const retry = useMutation({
    mutationFn: (postId) => post(`/publish/jobs/${postId}/retry`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['publish-jobs'] }); toast.success('Retry queued'); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Publishing" description="Monitor scheduled jobs, retries and everything you’ve published." icon={Send} />

      <Tabs tabs={[{ key: 'jobs', label: 'Jobs', icon: Clock, count: jobs?.length }, { key: 'published', label: 'Published', icon: CheckCircle2, count: pubs?.length }]} value={tab} onChange={setTab} />

      {tab === 'jobs' && (
        <Card>
          <CardBody className="p-0">
            {loadingJobs ? (
              <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : jobs?.length ? (
              <div className="divide-y divide-border">
                {jobs.map((j) => (
                  <div key={j.id} className="flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <Link to={`/posts/${j.post?.id}`} className="font-medium text-fg hover:text-brand-500 transition truncate block">
                        {j.post?.title || 'Untitled post'}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{j.post?.brand?.name}</span>
                        <span>·</span>
                        <span>Run {fmtDateTime(j.runAt)}</span>
                        {j.attempts > 0 && <span className="flex items-center gap-1"><Repeat className="h-3 w-3" /> {j.attempts} attempt{j.attempts > 1 ? 's' : ''}</span>}
                      </div>
                      {j.lastError && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="h-3 w-3 shrink-0" /> {j.lastError}</p>
                      )}
                      {j.nextRetryAt && j.status === 'RETRYING' && <p className="mt-1 text-xs text-amber-500">Next retry {timeAgo(j.nextRetryAt)}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {j.post?.platforms?.map((p) => <PlatformDot key={p} platform={p} />)}
                      <StatusBadge status={j.status} />
                      {j.status === 'FAILED' && (
                        <Button size="sm" variant="secondary" onClick={() => retry.mutate(j.post.id)} loading={retry.isPending && retry.variables === j.post.id}>
                          <RefreshCw className="h-3.5 w-3.5" /> Retry
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Clock} title="No publish jobs yet" description="Schedule or publish a post to see jobs here." />
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'published' && (
        <Card>
          <CardBody className="p-0">
            {loadingPubs ? (
              <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : pubs?.length ? (
              <div className="divide-y divide-border">
                {pubs.map((p) => {
                  const m = p.analytics?.[0];
                  return (
                    <div key={p.id} className="flex items-center gap-4 p-4">
                      <PlatformDot platform={p.platform} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/posts/${p.post?.id}`} className="font-medium text-fg hover:text-brand-500 truncate block">{p.post?.title || 'Untitled'}</Link>
                        <p className="text-xs text-muted">{fmtDateTime(p.publishedAt || p.createdAt)}</p>
                      </div>
                      {m && (
                        <div className="hidden sm:flex items-center gap-4 text-xs text-muted">
                          <span>{compactNumber(m.views)} views</span>
                          <span>{compactNumber(m.likes)} likes</span>
                          <span className="text-emerald-500">{m.engagement}% eng.</span>
                        </div>
                      )}
                      <StatusBadge status={p.status} />
                      {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer"><Button size="icon-sm" variant="ghost"><ExternalLink className="h-4 w-4" /></Button></a>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Send} title="Nothing published yet" description="Approved posts you publish will appear here." />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
