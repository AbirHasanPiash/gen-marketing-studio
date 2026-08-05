import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from './AuthLayout';
import { Button, Input, Field } from '../../components/ui';
import { useAuth } from '../../store/auth';

export default function LoginPage() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    setForm({ email: role === 'owner' ? 'owner@demo.com' : 'creator@demo.com', password: 'password123' });
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your studio.">
      {params.get('expired') && (
        <div className="mb-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
          Your session expired — please sign in again.
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input
            icon={Mail}
            type="email"
            required
            placeholder="you@company.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Password">
          <Input
            icon={Lock}
            type="password"
            required
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          Sign in <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="mt-6 rounded-xl border border-dashed border-border p-3">
        <p className="text-xs font-medium text-muted mb-2">Try the demo account:</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => fillDemo('owner')}>
            Owner
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => fillDemo('creator')}>
            Creator
          </Button>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        No account?{' '}
        <Link to="/register" className="font-medium text-brand-500 hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
