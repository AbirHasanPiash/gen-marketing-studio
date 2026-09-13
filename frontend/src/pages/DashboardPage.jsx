import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip, XAxis,
} from 'recharts';
import {
  FileText, Clock, CalendarCheck, Send, TrendingUp, Sparkles, ImagePlus,
  Lightbulb, ArrowUpRight, CheckSquare, Plus,
} from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/shared/StatCard';
import { Card, CardHeader, CardBody, Button, StatusBadge, Avatar, Skeleton, EmptyState } from '../components/ui';
import { STATUS_META } from '../lib/utils';
import { useActiveBrand } from '../hooks/useBrands';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuth } from '../store/auth';
import { get } from '../lib/api';
import { activityVerb, fmtDateTime, timeAgo, compactNumber } from '../lib/utils';

const QUICK = [
  { to: '/copy', label: 'Write copy', icon: Sparkles },
  { to: '/images', label: 'Generate image', icon: ImagePlus },
  { to: '/posts/new', label: 'New post', icon: Plus },
  { to: '/campaigns', label: 'Campaign ideas', icon: Lightbulb },
];

/** The lifecycle, in the order work actually moves through it. */
const PIPELINE = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED'];
const PIPELINE_BAR = {
  DRAFT: 'bg-slate-400',
  PENDING_REVIEW: 'bg-amber-500',
  APPROVED: 'bg-emerald-500',
  SCHEDULED: 'bg-blue-500',
  PUBLISHED: 'bg-green-500',
  FAILED: 'bg-red-500',
};

/**
 * Where the workspace's content actually sits. Four headline numbers say how
 * much exists; this says how much is stuck, and where.
 */
function PipelineCard({ statusCounts = {} }) {
  const rows = PIPELINE.map((status) => ({ status, count: statusCounts[status] || 0 }));
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card>
      <CardHeader title="Content pipeline" subtitle={total ? `${total} posts across every stage` : 'Nothing in flight yet'} />
      <CardBody className="space-y-2.5">
        {total === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Create a post to see it move through the pipeline.</p>
        ) : (
          rows.map(({ status, count }) => (
            <Link
              key={status}
              to={status === 'PENDING_REVIEW' ? '/approvals' : '/calendar'}
              className="flex items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-elevated"
            >
              <span className="w-28 shrink-0 text-xs text-muted">{STATUS_META[status]?.label || status}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-border/60">
                <span
                  className={`block h-full rounded-full ${PIPELINE_BAR[status]}`}
                  style={{ width: `${Math.round((count / max) * 100)}%` }}
                />
              </span>
              <span className="w-7 shrink-0 text-right text-sm font-medium tabular-nums text-fg">{count}</span>
            </Link>
          ))
        )}
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeBrandId, activeBrand } = useActiveBrand();
  useDocumentTitle('Dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', activeBrandId],
    queryFn: () => get(`/dashboard${activeBrandId ? `?brandId=${activeBrandId}` : ''}`),
    enabled: Boolean(activeBrandId),
  });
  const { data: overview } = useQuery({
    queryKey: ['overview-mini', activeBrandId],
    queryFn: () => get(`/analytics/overview?days=14${activeBrandId ? `&brandId=${activeBrandId}` : ''}`),
    enabled: Boolean(activeBrandId),
  });

  const c = data?.counts || {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${user?.name?.split(' ')[0] || 'there'} 👋`}
        description={activeBrand ? `Here’s what’s happening with ${activeBrand.name}.` : 'Create a brand to get started.'}
        actions={
          <Link to="/posts/new">
            <Button><Plus className="h-4 w-4" /> New Post</Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Total posts" value={c.posts || 0} icon={FileText} tone="brand" />
            <StatCard label="Pending review" value={c.pendingReview || 0} icon={Clock} tone="amber"
              hint={c.pendingReview ? 'Needs your attention' : 'All clear'} />
            <StatCard label="Scheduled" value={data?.statusCounts?.SCHEDULED || 0} icon={CalendarCheck} tone="blue" />
            <StatCard label="Published" value={data?.statusCounts?.PUBLISHED || 0} icon={Send} tone="emerald" />
          </>
        )}
      </div>

      {/* `items-start` keeps each card at its natural height. Stretching them to
          match the tallest column left a block of dead space under the chart. */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Engagement trend */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Engagement (last 14 days)"
            subtitle={overview ? `${compactNumber(overview.totals.views)} views · ${overview.totals.engagementRate}% avg rate` : '—'}
            action={<Link to="/analytics"><Button variant="ghost" size="sm">View all <ArrowUpRight className="h-4 w-4" /></Button></Link>}
          />
          <CardBody>
            {overview?.timeseries?.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={overview.timeseries} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="eng" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} tickFormatter={(d) => d.slice(5)} axisLine={false} tickLine={false} minTickGap={24} />
                  <RTooltip
                    contentStyle={{ background: 'rgb(var(--card))', border: '1px solid rgb(var(--border))', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: 'rgb(var(--muted))' }}
                  />
                  <Area type="monotone" dataKey="engagement" stroke="#7c3aed" strokeWidth={2.5} fill="url(#eng)" name="Engagement" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-[240px] place-items-center text-sm text-muted">No analytics yet</div>
            )}
          </CardBody>
        </Card>

        {/* Quick actions + status mix */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Quick actions" />
            <CardBody className="grid grid-cols-2 gap-2">
              {QUICK.map((q) => (
                <Link key={q.to} to={q.to}
                  className="flex flex-col items-start gap-2 rounded-xl border border-border p-3 transition hover:border-brand-500/50 hover:bg-elevated">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/10 text-brand-500">
                    <q.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-fg">{q.label}</span>
                </Link>
              ))}
            </CardBody>
          </Card>

          <PipelineCard statusCounts={data?.statusCounts} />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Upcoming */}
        <Card>
          <CardHeader title="Upcoming schedule" action={<Link to="/calendar"><Button variant="ghost" size="sm">Calendar</Button></Link>} />
          <CardBody className="space-y-1">
            {data?.upcoming?.length ? (
              data.upcoming.map((p) => (
                <Link key={p.id} to={`/posts/${p.id}`}
                  className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-elevated">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-500">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg truncate">{p.title || 'Untitled post'}</p>
                    <p className="text-xs text-muted">{fmtDateTime(p.scheduledAt)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))
            ) : (
              <EmptyState icon={CalendarCheck} title="Nothing scheduled" description="Schedule an approved post from the calendar." />
            )}
          </CardBody>
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader title="Recent activity" action={<Link to="/approvals"><Button variant="ghost" size="sm"><CheckSquare className="h-4 w-4" /> Approvals</Button></Link>} />
          <CardBody className="space-y-1">
            {data?.recentActivity?.length ? (
              data.recentActivity.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl p-2.5">
                  <Avatar name={a.actor?.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg">
                      <span className="font-medium">{a.actor?.name}</span>{' '}
                      <span className="text-muted">{activityVerb(a.action)}</span>{' '}
                      <span className="font-medium">{a.post?.title || 'a post'}</span>
                    </p>
                    <p className="text-xs text-muted">{timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={TrendingUp} title="No activity yet" description="Actions on posts will show up here." />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
