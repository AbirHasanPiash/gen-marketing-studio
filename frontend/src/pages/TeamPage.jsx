import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Shield, Crown, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/shared/PageHeader';
import { Card, CardBody, Button, Input, Field, Select, Modal, Avatar, Badge, Switch, EmptyState, Skeleton } from '../components/ui';
import { useAuth } from '../store/auth';
import { get, post, patch } from '../lib/api';
import { fmtDate } from '../lib/utils';

export default function TeamPage() {
  const qc = useQueryClient();
  const me = useAuth((s) => s.user);
  const [inviting, setInviting] = useState(false);

  const { data: users, isLoading } = useQuery({ queryKey: ['team'], queryFn: () => get('/auth/users') });

  const invite = useMutation({
    mutationFn: (u) => post('/auth/users', u),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); setInviting(false); toast.success('Team member added'); },
    onError: (e) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }) => patch(`/auth/users/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); toast.success('Updated'); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Owners approve content; creators draft and submit it." icon={Users}
        actions={<Button onClick={() => setInviting(true)}><UserPlus className="h-4 w-4" /> Add member</Button>} />

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : users?.length ? (
            <div className="divide-y divide-border">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-4 p-4">
                  <Avatar name={u.name} src={u.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg flex items-center gap-2">
                      {u.name} {u.id === me?.id && <Badge className="bg-slate-500/12 text-slate-500">You</Badge>}
                    </p>
                    <p className="text-sm text-muted truncate">{u.email}</p>
                  </div>
                  <Badge className={u.role === 'OWNER' ? 'bg-brand-500/12 text-brand-500' : 'bg-blue-500/12 text-blue-500'}>
                    {u.role === 'OWNER' ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />} {u.role.toLowerCase()}
                  </Badge>
                  {u.id !== me?.id && (
                    <div className="flex items-center gap-3">
                      <Select value={u.role} onChange={(e) => update.mutate({ id: u.id, role: e.target.value })} className="h-8 w-28 py-1 text-xs">
                        <option value="OWNER">Owner</option>
                        <option value="CREATOR">Creator</option>
                      </Select>
                      <Switch checked={u.isActive} onChange={(v) => update.mutate({ id: u.id, isActive: v })} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title="No team members" description="Invite creators to collaborate on content." />
          )}
        </CardBody>
      </Card>

      {inviting && <InviteModal onClose={() => setInviting(false)} onSave={(u) => invite.mutate(u)} saving={invite.isPending} />}
    </div>
  );
}

function InviteModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CREATOR' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title="Add team member" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(form)} loading={saving} disabled={!form.name || !form.email || form.password.length < 6}>Add member</Button></>}>
      <div className="space-y-4">
        <Field label="Name"><Input value={form.name} onChange={set('name')} placeholder="Rohan Ahmed" /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} placeholder="creator@brand.com" /></Field>
        <Field label="Temporary password" hint="min 6 chars"><Input type="text" value={form.password} onChange={set('password')} placeholder="Share with them to sign in" /></Field>
        <Field label="Role"><Select value={form.role} onChange={set('role')}><option value="CREATOR">Creator — drafts & submits</option><option value="OWNER">Owner — approves & publishes</option></Select></Field>
      </div>
    </Modal>
  );
}
