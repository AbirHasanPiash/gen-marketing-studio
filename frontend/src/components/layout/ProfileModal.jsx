import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Button, Input, Field, UnderlineTabs } from '../ui';
import { ImageUploader } from '../shared/ImageUploader';
import { patch, post } from '../../lib/api';
import { useAuth } from '../../store/auth';

const MIN_PASSWORD = 8;

/**
 * Own-profile settings. Team members are created with a password their owner
 * chose, so changing it has to be reachable from inside the app.
 */
export function ProfileModal({ open, onClose }) {
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const saveProfile = useMutation({
    mutationFn: () => patch('/auth/me', { name: name.trim(), avatarUrl: avatarUrl || null }),
    onSuccess: (res) => {
      setUser(res.user);
      toast.success('Profile updated');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      post('/auth/me/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      }),
    onSuccess: () => {
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const passwordReady =
    passwords.currentPassword.length > 0 &&
    passwords.newPassword.length >= MIN_PASSWORD &&
    passwords.newPassword === passwords.confirm;

  const setPassword = (key) => (e) => setPasswords((p) => ({ ...p, [key]: e.target.value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your profile"
      subtitle={user?.email}
      size="md"
      footer={
        tab === 'profile' ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending} disabled={name.trim().length < 2}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => changePassword.mutate()} loading={changePassword.isPending} disabled={!passwordReady}>
              <KeyRound className="h-4 w-4" /> Change password
            </Button>
          </>
        )
      }
    >
      <UnderlineTabs
        tabs={[{ key: 'profile', label: 'Profile' }, { key: 'password', label: 'Password' }]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />

      {tab === 'profile' ? (
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <Field label="Avatar">
            <ImageUploader value={avatarUrl} onChange={setAvatarUrl} folder="avatars" aspect="aspect-square" />
          </Field>
          <div className="space-y-4">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aisha Rahman" />
            </Field>
            <Field label="Email" hint="ask an owner to change this">
              <Input value={user?.email || ''} disabled />
            </Field>
            <Field label="Role">
              <Input value={user?.role === 'OWNER' ? 'Owner' : 'Creator'} disabled />
            </Field>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={setPassword('currentPassword')} />
          </Field>
          <Field label="New password" hint={`min ${MIN_PASSWORD} characters`}>
            <Input type="password" autoComplete="new-password" value={passwords.newPassword} onChange={setPassword('newPassword')} />
          </Field>
          <Field
            label="Confirm new password"
            error={passwords.confirm && passwords.confirm !== passwords.newPassword ? 'These do not match' : undefined}
          >
            <Input type="password" autoComplete="new-password" value={passwords.confirm} onChange={setPassword('confirm')} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

export default ProfileModal;
