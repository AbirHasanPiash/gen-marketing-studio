import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, DragOverlay,
} from '@dnd-kit/core';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths,
  addWeeks, subWeeks, isSameDay, isSameMonth, isToday, format,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, GripVertical, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { Card, Button, StatusBadge, PlatformDot, Tabs, EmptyState } from '../components/ui';
import { useActiveBrand } from '../hooks/useBrands';
import { get, patch } from '../lib/api';
import { cn } from '../lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayKey = (d) => format(d, 'yyyy-MM-dd');

function PostChip({ post, overlay }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id, data: { post } });
  const navigate = useNavigate();
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !overlay && navigate(`/posts/${post.id}`)}
      className={cn(
        'group flex items-center gap-1 rounded-lg border px-1.5 py-1 text-xs cursor-grab active:cursor-grabbing bg-card',
        'border-l-[3px] hover:bg-elevated transition',
        isDragging && 'opacity-30',
        overlay && 'shadow-card rotate-2'
      )}
      style={{ borderLeftColor: post.campaign?.color || '#7c3aed' }}
    >
      <GripVertical className="h-3 w-3 text-muted opacity-0 group-hover:opacity-100 shrink-0" />
      <span className="truncate flex-1 text-fg">{post.title || post.body?.slice(0, 24) || 'Untitled'}</span>
      {post.platforms?.[0] && <PlatformDot platform={post.platforms[0]} className="scale-90" />}
    </div>
  );
}

function DayCell({ date, posts, inMonth, onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(date), data: { date } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative min-h-[104px] border-b border-r border-border p-1.5 transition',
        !inMonth && 'bg-elevated/40',
        isOver && 'bg-brand-500/10 ring-2 ring-inset ring-brand-500/40'
      )}
    >
      <div className="flex items-center justify-between px-0.5">
        <span
          className={cn(
            'grid h-6 w-6 place-items-center rounded-full text-xs font-medium',
            isToday(date) ? 'bg-brand-600 text-white' : inMonth ? 'text-fg' : 'text-muted/50'
          )}
        >
          {format(date, 'd')}
        </span>
        <button
          onClick={() => onAdd(date)}
          className="rounded-md p-0.5 text-muted opacity-0 group-hover:opacity-100 hover:bg-elevated hover:text-brand-500 transition"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1 space-y-1">
        {posts.slice(0, 4).map((p) => <PostChip key={p.id} post={p} />)}
        {posts.length > 4 && <p className="px-1 text-[10px] text-muted">+{posts.length - 4} more</p>}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { activeBrandId } = useActiveBrand();
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date());
  const [dragging, setDragging] = useState(null);

  const range = useMemo(() => {
    if (view === 'week') return { start: startOfWeek(cursor), end: endOfWeek(cursor) };
    return { start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) };
  }, [cursor, view]);

  const days = useMemo(() => eachDayOfInterval(range), [range]);

  const { data } = useQuery({
    queryKey: ['calendar', activeBrandId, dayKey(range.start), dayKey(range.end)],
    queryFn: () =>
      get(`/posts/calendar?brandId=${activeBrandId}&from=${range.start.toISOString()}&to=${range.end.toISOString()}`),
    enabled: Boolean(activeBrandId),
  });

  const scheduled = data?.scheduled || [];
  const unscheduled = data?.unscheduled || [];

  const byDay = useMemo(() => {
    const map = {};
    scheduled.forEach((p) => {
      if (!p.scheduledAt) return;
      const k = dayKey(new Date(p.scheduledAt));
      (map[k] ||= []).push(p);
    });
    return map;
  }, [scheduled]);

  const reschedule = useMutation({
    mutationFn: ({ id, scheduledAt }) => patch(`/posts/${id}/reschedule`, { scheduledAt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
    onError: (e) => toast.error(e.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = ({ active, over }) => {
    setDragging(null);
    if (!over) return;
    const post = active.data.current.post;
    const targetDate = over.data.current.date;
    const orig = post.scheduledAt ? new Date(post.scheduledAt) : null;
    const time = orig ? format(orig, 'HH:mm') : '10:00';
    const scheduledAt = new Date(`${dayKey(targetDate)}T${time}:00`);
    if (orig && isSameDay(orig, targetDate)) return;
    reschedule.mutate({ id: post.id, scheduledAt });
    toast.success(`Moved to ${format(targetDate, 'MMM d')}`);
  };

  const addOnDay = (date) =>
    navigate(`/posts/new?brandId=${activeBrandId}&date=${new Date(`${dayKey(date)}T10:00:00`).toISOString()}`);

  const label = view === 'week' ? `${format(range.start, 'MMM d')} – ${format(range.end, 'MMM d, yyyy')}` : format(cursor, 'MMMM yyyy');
  const step = (dir) => setCursor((c) => (view === 'week' ? (dir > 0 ? addWeeks(c, 1) : subWeeks(c, 1)) : dir > 0 ? addMonths(c, 1) : subMonths(c, 1)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Calendar"
        description="Plan and schedule posts. Drag any post to reschedule it."
        icon={CalendarDays}
        actions={<Button onClick={() => navigate('/posts/new')}><Plus className="h-4 w-4" /> New Post</Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon-sm" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="secondary" size="icon-sm" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
          <h2 className="ml-2 font-display text-lg font-semibold text-fg">{label}</h2>
        </div>
        <Tabs
          tabs={[{ key: 'month', label: 'Month' }, { key: 'week', label: 'Week' }]}
          value={view}
          onChange={setView}
        />
      </div>

      <DndContext sensors={sensors} onDragStart={({ active }) => setDragging(active.data.current.post)} onDragEnd={onDragEnd}>
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          {/* Calendar grid */}
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-elevated/50">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-muted">{d}</div>
              ))}
            </div>
            <div className={cn('grid grid-cols-7', view === 'week' && 'min-h-[420px]')}>
              {days.map((d) => (
                <DayCell key={dayKey(d)} date={d} posts={byDay[dayKey(d)] || []} inMonth={view === 'week' || isSameMonth(d, cursor)} onAdd={addOnDay} />
              ))}
            </div>
          </Card>

          {/* Backlog */}
          <Card className="h-fit">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Inbox className="h-4 w-4 text-muted" />
              <h3 className="font-display font-semibold text-fg">Unscheduled</h3>
              <span className="ml-auto rounded-full bg-border/70 px-2 py-0.5 text-xs">{unscheduled.length}</span>
            </div>
            <div className="max-h-[480px] space-y-2 overflow-y-auto p-3">
              {unscheduled.length ? (
                unscheduled.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border p-2">
                    <PostChip post={p} />
                    <div className="mt-1.5 flex items-center gap-1.5 px-1">
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState icon={Inbox} title="Backlog empty" description="Drafts without a date appear here." className="py-8" />
              )}
              <p className="px-1 pt-1 text-[11px] text-muted">Drag a post onto a day to schedule it.</p>
            </div>
          </Card>
        </div>

        <DragOverlay>{dragging ? <PostChip post={dragging} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
