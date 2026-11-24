import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, ErrorBox } from '../components/ui';
import { useSetupStatus } from './setup';

function AuthShell({ title, children, subtitle }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 font-serif text-lg font-bold text-brand-900">SST</div>
          <p className="font-serif text-lg font-bold text-white">SST Public School Rashidabad</p>
          <p className="text-xs uppercase tracking-widest text-gold-400">Administration Portal</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const setup = useSetupStatus();
  if (user) return <Navigate to={loc.state?.from ?? '/'} replace />;
  if (setup.data?.required) return <Navigate to="/setup" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password, needTotp ? totp : undefined);
      nav(loc.state?.from ?? '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TWO_FACTOR_REQUIRED') setNeedTotp(true);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Use your SST administration account.">
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox error={error} />
        {!needTotp ? (
          <>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </>
        ) : (
          <div>
            <label className="label" htmlFor="totp">Authentication code</label>
            <input id="totp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="input tracking-[0.4em]" value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))} />
            <p className="mt-1 text-xs text-slate-500">Enter the 6-digit code from your authenticator app.</p>
          </div>
        )}
        <Button type="submit" className="w-full" loading={busy}>
          {needTotp ? 'Verify' : 'Sign in'}
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-brand-700 hover:underline">Forgot your password?</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Reset your password" subtitle="We will send a reset link to your email address.">
      {sent ? (
        <div className="space-y-4 text-sm text-slate-600">
          <p>If an account exists for <strong>{email}</strong>, a password reset link has been sent. The link is valid for one hour.</p>
          <Link to="/login" className="text-brand-700 hover:underline">← Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ErrorBox error={error} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" loading={busy}>Send reset link</Button>
          <p className="text-center text-sm"><Link to="/login" className="text-brand-700 hover:underline">Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError(new Error('The passwords do not match'));
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/auth/reset-password', { token: params.get('token'), password });
      setDone(true);
      setTimeout(() => nav('/login'), 2000);
    } catch (err) {
      setError(err instanceof ApiError && err.fieldErrors.password ? new Error(err.fieldErrors.password) : err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Choose a new password" subtitle="At least 10 characters with upper- and lower-case letters and a number.">
      {done ? (
        <p className="text-sm text-emerald-700">Your password has been changed. Redirecting to sign in…</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ErrorBox error={error} />
          <div>
            <label className="label" htmlFor="pw">New password</label>
            <input id="pw" type="password" autoComplete="new-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pw2">Confirm password</label>
            <input id="pw2" type="password" autoComplete="new-password" required className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" loading={busy}>Set password</Button>
        </form>
      )}
    </AuthShell>
  );
}
