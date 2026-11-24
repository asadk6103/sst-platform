import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { KeyRound, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { api, ApiError, setAccessToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, ErrorBox, Loading, PageHeader, Section, useFeedback } from '../components/ui';
import { FormRow, SelectInput, TextInput } from '../components/fields';

export function useSetupStatus() {
  return useQuery({ queryKey: ['setup-status'], queryFn: () => api.get<{ required: boolean; suggestedPublicUrl?: string }>('/admin/setup/status'), staleTime: 0, retry: 2 });
}

// ─────────────────────────── First-run setup wizard ───────────────────────────
export function SetupPage() {
  const status = useSetupStatus();
  const { reload } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    password: '',
    confirm: '',
    nameLine1: 'SARGODHAN SPIRIT TRUST',
    nameLine2: 'PUBLIC SCHOOL',
    nameLine3: 'RASHIDABAD',
    publicUrl: '',
    theme: 'navy',
  });
  useEffect(() => {
    if (!form.publicUrl) setForm((f) => ({ ...f, publicUrl: window.location.origin }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status.isLoading) return <Loading label="Checking installation…" />;
  if (status.data && !status.data.required) return <Navigate to="/login" replace />;
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  const steps = ['Setup code', 'Administrator', 'Website'];
  const next = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step === 1 && form.password !== form.confirm) return setErrors({ confirm: 'Passwords do not match' });
    setErrors({});
    if (step < 2) return setStep(step + 1);
    submit();
  };
  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ accessToken: string }>('/admin/setup', {
        code: form.code,
        admin: { name: form.name, email: form.email, password: form.password },
        site: { nameLine1: form.nameLine1, nameLine2: form.nameLine2, nameLine3: form.nameLine3, publicUrl: form.publicUrl, theme: form.theme },
      });
      setAccessToken(res.accessToken);
      await reload();
      qc.invalidateQueries({ queryKey: ['setup-status'] });
      nav('/', { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        const fe = e.fieldErrors;
        const map: Record<string, string> = Object.fromEntries(Object.entries(fe).map(([k, v]) => [k.replace(/^(admin|site)\./, ''), v]));
        setErrors(map);
        if (e.code === 'INVALID_SETUP_CODE' || map.code) setStep(0);
        else if (map.name || map.email || map.password) setStep(1);
      }
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 font-serif text-lg font-bold text-brand-900">SST</div>
          <p className="font-serif text-lg font-bold text-white">Welcome — let’s set up your website</p>
          <p className="text-xs uppercase tracking-widest text-gold-400">First-run setup</p>
        </div>
        <ol className="mb-4 flex justify-center gap-2" aria-label="Setup steps">
          {steps.map((s, i) => (
            <li key={s} className={clsx('flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold', i === step ? 'bg-white text-brand-800' : i < step ? 'bg-white/30 text-white' : 'bg-white/10 text-white/70')} aria-current={i === step ? 'step' : undefined}>
              <span>{i + 1}</span> {s}
            </li>
          ))}
        </ol>
        <form onSubmit={next} className="space-y-4 rounded-lg bg-white p-6 shadow-xl" noValidate>
          <ErrorBox error={error} />
          {step === 0 && (
            <>
              <div className="flex gap-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
                <p>
                  To prove you control this server, enter the one-time setup code printed by the installer and in the API log. Show it with:
                  <code className="mt-1 block rounded bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100">docker compose logs api</code>
                  <span className="mt-1 block text-xs">Bare-metal install:</span>
                  <code className="mt-1 block rounded bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100">sudo cat /opt/sst/data/config/setup-code.txt</code>
                </p>
              </div>
              <TextInput label="Setup code" required value={form.code} onChange={(v) => set('code')(v.toUpperCase())} error={errors.code} placeholder="XXXXX-XXXXX" />
            </>
          )}
          {step === 1 && (
            <>
              <p className="text-sm text-slate-600">Create the first <strong>Super Administrator</strong>. You can add more users and roles later.</p>
              <TextInput label="Full name" required value={form.name} onChange={set('name')} error={errors.name} />
              <TextInput label="Email" type="email" required value={form.email} onChange={set('email')} error={errors.email} />
              <TextInput label="Password" type="password" required value={form.password} onChange={set('password')} error={errors.password} help="At least 10 characters with upper- and lower-case letters and a number." />
              <TextInput label="Confirm password" type="password" required value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
            </>
          )}
          {step === 2 && (
            <>
              <p className="text-sm text-slate-600">These can all be changed later in the administration portal.</p>
              <TextInput label="School name — first line" required value={form.nameLine1} onChange={set('nameLine1')} error={errors.nameLine1} />
              <TextInput label="Second line" value={form.nameLine2} onChange={set('nameLine2')} />
              <TextInput label="Third line" value={form.nameLine3} onChange={set('nameLine3')} />
              <TextInput label="Public website address" required value={form.publicUrl} onChange={set('publicUrl')} error={errors.publicUrl} help="The address visitors use, e.g. https://www.sst.edu.pk. Used in shared links, previews and password-reset emails." />
              <SelectInput label="Colour scheme" required value={form.theme} onChange={(v) => set('theme')(v ?? 'navy')} options={[{ value: 'navy', label: 'Navy (default)' }, { value: 'purple', label: 'Royal purple' }]} />
            </>
          )}
          <div className="flex justify-between pt-2">
            {step > 0 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
            <Button type="submit" loading={busy}>{step < 2 ? 'Continue' : 'Finish setup'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────── Administration → System ───────────────────────────
const KEY_INFO: Record<string, { name: string; text: string; warn?: string }> = {
  jwtAccess: { name: 'Sign-in key', text: 'Signs administrator sessions.', warn: 'Rotating signs out every user, including you.' },
  preview: { name: 'Preview key', text: 'Signs preview links for unpublished content.', warn: 'Open preview links stop working.' },
  revalidate: { name: 'Website refresh key', text: 'Lets the API tell the website to refresh after publishing.' },
};

export function SystemPage() {
  const { toast, confirm } = useFeedback();
  const { logout } = useAuth();
  const q = useQuery({ queryKey: ['system'], queryFn: () => api.get('/admin/system') });
  const [form, setForm] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (q.data) setForm({ ...q.data.settings });
  }, [q.data]);
  if (q.isLoading || !form) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const ov = q.data.overriddenByEnvironment ?? {};
  const envNote = (k: string) => (ov[k] ? <Badge tone="amber">Set by the server environment — this value is not used</Badge> : null);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      await api.put('/admin/system', { ...form, maxUploadMb: Number(form.maxUploadMb) });
      toast('System settings saved');
      q.refetch();
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const rotate = async (key: string) => {
    const info = KEY_INFO[key]!;
    if (!(await confirm({ title: `Rotate the ${info.name.toLowerCase()}?`, text: `A new random key is generated immediately. ${info.warn ?? ''}`, confirmLabel: 'Rotate key', danger: !!info.warn }))) return;
    try {
      const r = await api.post('/admin/system/rotate-key', { key });
      toast(`${info.name} rotated`);
      if (r.signedOut) await logout();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  return (
    <>
      <PageHeader title="System" description="Server-level settings. They are stored in the database and take effect within seconds — no server restart or .env file needed." />
      <div className="space-y-6">
        <Section title="Website address & uploads" actions={<Button size="sm" icon={<Save className="h-3.5 w-3.5" />} loading={saving} onClick={save}>Save</Button>}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <TextInput label="Public website address" required value={form.publicUrl} onChange={(v) => setForm({ ...form, publicUrl: v })} error={errors.publicUrl} help="The address visitors use, e.g. https://www.sst.edu.pk. Used in share links, previews, the sitemap and password-reset links." />
              {envNote('publicUrl')}
            </div>
            <div>
              <TextInput label="Maximum upload size (MB per file)" type="number" required value={form.maxUploadMb} onChange={(v) => setForm({ ...form, maxUploadMb: v })} error={errors.maxUploadMb} help={`1 – ${q.data.uploadCeilingMb} MB`} />
              {envNote('maxUploadMb')}
            </div>
            <div>
              <SelectInput
                label="Secure (HTTPS-only) cookies"
                required
                value={form.secureCookies}
                onChange={(v) => setForm({ ...form, secureCookies: v })}
                options={[
                  { value: 'auto', label: 'Automatic — on when the site uses HTTPS (recommended)' },
                  { value: 'on', label: 'Always on' },
                  { value: 'off', label: 'Off (plain HTTP only)' },
                ]}
              />
              {envNote('secureCookies')}
            </div>
          </div>
        </Section>
        <Section title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold-600" />Security keys</span>} description="Generated automatically when the system was installed and stored privately on the server. They are never shown. Rotate a key if you believe it may have been exposed.">
          <ul className="divide-y divide-slate-100">
            {q.data.keys.map((k: any) => (
              <li key={k.key} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{KEY_INFO[k.key]?.name}</p>
                  <p className="text-sm text-slate-500">{KEY_INFO[k.key]?.text}</p>
                </div>
                {k.managedByEnvironment ? <Badge tone="amber">Set by the server environment</Badge> : <Button size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => rotate(k.key)}>Rotate</Button>}
              </li>
            ))}
          </ul>
        </Section>
        <FormRow label="">
          <p className="text-xs text-slate-500">The database password and the server port are infrastructure settings: the database is reachable only inside the server, and the port is set in docker-compose.yml.</p>
        </FormRow>
      </div>
    </>
  );
}
