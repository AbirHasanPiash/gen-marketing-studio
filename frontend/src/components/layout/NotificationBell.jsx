import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Menu } from '../ui';
import { get, patch, post } from '../../lib/api';
import { timeAgo, cn } from '../../lib/utils';

const TYPE_EMOJI = {
  APPROVAL_REQUEST: '📝',
  APPROVED: '✅',
  REJECTED: '✋',
  PUBLISHED: '🎉',
  PUBLISH_FAILED: '⚠️',
  SYSTEM: '🔔',
};

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => get('/notifications'),
    refetchInterval: 30_000,
  });
  const items = data?.items || [];
  const unread = data?.unread || 0;

  const readAll = useMutation({
    mutationFn: () => post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readOne = useMutation({
    mutationFn: (id) => patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <Menu
      width="w-80"
      trigger={() => (
        <button className="relative grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-elevated hover:text-fg transition">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}
    >
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-sm font-semibold text-fg">Notifications</span>
        {unread > 0 && (
          <button
            onClick={() => readAll.mutate()}
            className="flex items-center gap-1 text-xs text-brand-500 hover:underline"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">You’re all caught up ✨</p>}
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              if (!n.read) readOne.mutate(n.id);
              if (n.link) navigate(n.link);
            }}
            className={cn(
              'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-elevated',
              !n.read && 'bg-brand-500/5'
            )}
          >
            <span className="text-base leading-none mt-0.5">{TYPE_EMOJI[n.type] || '🔔'}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg truncate">{n.title}</p>
              {n.body && <p className="text-xs text-muted line-clamp-2">{n.body}</p>}
              <p className="text-[11px] text-muted/70 mt-0.5">{timeAgo(n.createdAt)}</p>
            </div>
            {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
          </button>
        ))}
      </div>
    </Menu>
  );
}

export default NotificationBell;
