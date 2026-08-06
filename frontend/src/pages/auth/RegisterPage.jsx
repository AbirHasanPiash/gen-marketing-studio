import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Building2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from './AuthLayout';
import { Button, Input, Field } from '../../components/ui';
import { useAuth } from '../../store/auth';

export default function RegisterPage() {
  const register = useAuth((s) => s.register);
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', tenantName: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Your studio is ready 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthLayout title="Create your studio" subtitle="Start managing your brand’s social presence with AI.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name">
          <Input icon={User} required placeholder="Aisha Rahman" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Business / workspace name">
          <Input icon={Building2} required placeholder="Nokshi Threads" value={form.tenantName} onChange={set('tenantName')} />
        </Field>
        <Field label="Email">
          <Input icon={Mail} type="email" required placeholder="you@company.com" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="min 6 characters">
          <Input icon={Lock} type="password" required minLength={6} placeholder="••••••••" value={form.password} onChange={set('password')} />
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          Create account <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-500 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
