import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell, CartesianGrid,
} from 'recharts';
import {
  BarChart3, Eye, Heart, Users, TrendingUp, RefreshCw, Clock, CalendarClock, Trophy, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/shared/StatCard';
import { Card, CardHeader, CardBody, Button, Tabs, Badge, EmptyState, Skeleton, PlatformDot } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, post } from '../lib/api';
import { compactNumber, PLATFORM_META } from '../lib/utils';

const BRAND = '#7c3aed';
const axisTick = { fontSize: 11, fill: 'rgb(var(--muted))' };
const tooltipStyle = { background: 'rgb(var(--card))', border: '1px solid rgb(var(--border))', borderRadius: 12, fontSize: 12, color: 'rgb(var(--fg))' };

export default function AnalyticsPage() {
  const qc = useQueryClient();
  const { activeBrandId } = useActiveBrand();
  const [days, setDays] = useState('30');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', activeBrandId, days],
    queryFn: () => get(`/analytics/overview?days=${days}${activeBrandId ? `&brandId=${activeBrandId}` : ''}`),
    enabled: Boolean(activeBrandId),
  });

  const sync = useMutation({
    mutationFn: () => post('/analytics/sync'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['analytics'] }); toast.success('Analytics refreshed'); },
    onError: (e) => toast.error(e.message),
  });

  const t = data?.totals;
  const bestTime = data?.bestTime;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Engagement, best-time-to-post and campaign ROI." icon={BarChart3}
        actions={
          <>
            <Tabs tabs={[{ key: '7', label: '7d' }, { key: '30', label: '30d' }, { key: '90', label: '90d' }]} value={days} onChange={setDays} />
            <Button variant="secondary" onClick={() => sync.mutate()} loading={sync.isPending}><RefreshCw className="h-4 w-4" /> Sync</Button>
          </>
        } />

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : !t || t.posts === 0 ? (
        <Card><EmptyState icon={BarChart3} title="No analytics yet" description="Publish posts (or connect Meta) to start collecting engagement data." /></Card>
      ) : (
        <>
          {/* Hero stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total views" value={t.views} icon={Eye} tone="brand" compact hint={`across ${t.posts} posts`} />
            <StatCard label="Reach" value={t.reach} icon={Users} tone="blue" compact />
            <StatCard label="Engagements" value={t.likes + t.comments + t.shares + t.saves} icon={Heart} tone="rose" compact />
            <StatCard label="Avg. engagement" value={`${t.engagementRate}%`} icon={TrendingUp} tone="emerald" />
          </div>

          {/* Engagement over time */}
          <Card>
            <CardHeader title="Engagement over time" subtitle={`Last ${days} days`} />
            <CardBody>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.timeseries} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="a1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="date" tick={axisTick} tickFormatter={(d) => d.slice(5)} axisLine={false} tickLine={false} minTickGap={28} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={compactNumber} />
                  <RTooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="engagement" name="Engagement" stroke={BRAND} strokeWidth={2.5} fill="url(#a1)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Best time to post */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Best day to post" subtitle={bestTime?.bestDay?.engagement ? `${bestTime.bestDay.label} performs best` : 'By weekday'} action={<CalendarClock className="h-4 w-4 text-muted" />} />
              <CardBody>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bestTime?.byWeekday} margin={{ left: -18, right: 8, top: 8 }}>
                    <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
                    <RTooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--muted))', fillOpacity: 0.06 }} />
                    <Bar dataKey="engagement" radius={[4, 4, 0, 0]}>
                      {bestTime?.byWeekday?.map((d) => (
                        <Cell key={d.label} fill={d.label === bestTime?.bestDay?.label ? BRAND : 'rgb(var(--muted))'} fillOpacity={d.label === bestTime?.bestDay?.label ? 1 : 0.35} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Best hour to post" subtitle={bestTime?.bestHour ? `Peak around ${bestTime.bestHour.hour}:00` : 'By hour'} action={<Clock className="h-4 w-4 text-muted" />} />
              <CardBody>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bestTime?.byHour} margin={{ left: -18, right: 8, top: 8 }}>
                    <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="hour" tick={axisTick} axisLine={false} tickLine={false} interval={2} tickFormatter={(h) => `${h}h`} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
                    <RTooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--muted))', fillOpacity: 0.06 }} labelFormatter={(h) => `${h}:00`} />
                    <Bar dataKey="engagement" radius={[4, 4, 0, 0]}>
                      {bestTime?.byHour?.map((d) => (
                        <Cell key={d.hour} fill={d.hour === bestTime?.bestHour?.hour ? BRAND : 'rgb(var(--muted))'} fillOpacity={d.hour === bestTime?.bestHour?.hour ? 1 : 0.3} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Campaign ROI */}
            <Card>
              <CardHeader title="Campaign ROI" subtitle="Engagement per post" action={<Trophy className="h-4 w-4 text-muted" />} />
              <CardBody>
                {data.campaignROI?.length ? (
                  <ResponsiveContainer width="100%" height={Math.max(160, data.campaignROI.length * 52)}>
                    <BarChart layout="vertical" data={data.campaignROI} margin={{ left: 8, right: 24 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={110} />
                      <RTooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--muted))', fillOpacity: 0.06 }} />
                      <Bar dataKey="roi" name="Engagement / post" radius={[0, 6, 6, 0]} label={{ position: 'right', fill: 'rgb(var(--muted))', fontSize: 11 }}>
                        {data.campaignROI.map((c) => <Cell key={c.id} fill={c.color || BRAND} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="py-10 text-center text-sm text-muted">No campaign data yet.</p>}
              </CardBody>
            </Card>

            {/* Platform split */}
            <Card>
              <CardHeader title="By platform" subtitle="Views & engagement" />
              <CardBody>
                {data.byPlatform?.length ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={data.byPlatform} margin={{ left: -18, right: 8, top: 8 }}>
                        <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.5} vertical={false} />
                        <XAxis dataKey="platform" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(p) => PLATFORM_META[p]?.label || p} />
                        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} tickFormatter={compactNumber} />
                        <RTooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--muted))', fillOpacity: 0.06 }} />
                        <Bar dataKey="views" name="Views" radius={[4, 4, 0, 0]}>
                          {data.byPlatform.map((p) => <Cell key={p.platform} fill={PLATFORM_META[p.platform]?.color || BRAND} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3">
                      {data.byPlatform.map((p) => (
                        <div key={p.platform} className="flex items-center gap-2 text-sm">
                          <span className="h-3 w-3 rounded" style={{ background: PLATFORM_META[p.platform]?.color }} />
                          <span className="text-fg">{PLATFORM_META[p.platform]?.label}</span>
                          <span className="text-muted">· {p.posts} posts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="py-10 text-center text-sm text-muted">No platform data yet.</p>}
              </CardBody>
            </Card>
          </div>

          {/* Top posts */}
          <Card>
            <CardHeader title="Top performing posts" />
            <CardBody className="p-0">
              <div className="divide-y divide-border">
                {data.topPosts?.map((p, i) => (
                  <div key={p.postId || i} className="flex items-center gap-4 p-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-500">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-fg truncate">{p.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted"><PlatformDot platform={p.platform} /> {p.engagementRate}% engagement</div>
                    </div>
                    <div className="hidden sm:flex items-center gap-5 text-sm">
                      <span className="text-muted">{compactNumber(p.views)} views</span>
                      <span className="font-medium text-fg">{compactNumber(p.engagement)} eng.</span>
                    </div>
                    {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 text-muted hover:text-brand-500" /></a>}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
