import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, ShieldCheck } from 'lucide-react';
import { api, ApiError, qs, type Paged } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, EmptyState, ErrorBox, fmtDate, Loading, Modal, PageHeader, Pagination, SearchInput, Section, useFeedback } from '../components/ui';
import { TextInput, Toggle } from '../components/fields';
import { itemLink } from './dashboard';

// ─────────────────────────── Users ───────────────────────────
export function UsersPage() {
  const { can, user: me } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const q = useQuery({ queryKey: ['users', search, page], queryFn: () => api.get<Paged<any>>(`/admin/users${qs({ search, page, pageSize: 20 })}`) });
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api.get<{ roles: any[] }>('/admin/roles') });
  const manage = can('users.manage');
  const save = async () => {
    setErrors({});
    try {
      const body = { name: edit.name, email: edit.email, roleIds: edit.roleIds, isActive: edit.isActive, password: edit.password || undefined };
      if (edit.id) await api.put(`/admin/users/${edit.id}`, { ...body, password: edit.password ?? '' });
      else await api.post('/admin/users', body);
      toast(edit.id ? 'User updated' : 'User created');
      setEdit(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast((e as Error).message, 'error');
    }
  };
  return (
    <>
      <PageHeader
        title="Users"
        description="Administration accounts. Each user receives the permissions of their roles."
        actions={manage && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ name: '', email: '', password: '', roleIds: [], isActive: true })}>New user</Button>}
      />
      <div className="card">
        <div className="border-b border-slate-100 p-3"><SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Search name or email…" /></div>
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <EmptyState title="No users found" /> : (
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50"><tr><th className="th">Name</th><th className="th hidden md:table-cell">Roles</th><th className="th">Status</th><th className="th hidden lg:table-cell">Last sign-in</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="td"><p className="font-medium text-slate-800">{u.name}{u.id === me?.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                  <td className="td hidden md:table-cell"><div className="flex flex-wrap gap-1">{u.roles.map((r: any) => <Badge key={r.id} tone="blue">{r.name}</Badge>)}</div></td>
                  <td className="td">{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}{u.twoFactorEnabled && <span className="ml-1" title="Two-factor enabled"><ShieldCheck className="inline h-4 w-4 text-emerald-600" /></span>}</td>
                  <td className="td hidden text-xs text-slate-500 lg:table-cell">{fmtDate(u.lastLoginAt, true)}</td>
                  <td className="td text-right">
                    {manage && <Button size="sm" variant="ghost" onClick={() => setEdit({ ...u, roleIds: u.roles.map((r: any) => r.id), password: '' })}>Edit</Button>}
                    {manage && u.id !== me?.id && <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (await confirm({ title: `Delete ${u.name}?`, text: 'The account is deactivated and hidden. Audit history is kept.', danger: true, confirmLabel: 'Delete' })) { try { await api.del(`/admin/users/${u.id}`); qc.invalidateQueries({ queryKey: ['users'] }); } catch (e: any) { toast(e.message, 'error'); } } }}>Delete</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pagination {...q.data.pagination} onPage={setPage} />}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit user' : 'New user'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            <TextInput label="Full name" required value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} error={errors.name} />
            <TextInput label="Email" type="email" required value={edit.email} onChange={(v) => setEdit({ ...edit, email: v })} error={errors.email} />
            <TextInput label={edit.id ? 'New password (leave empty to keep)' : 'Password'} type="password" required={!edit.id} value={edit.password} onChange={(v) => setEdit({ ...edit, password: v })} error={errors.password} help="At least 10 characters with upper- and lower-case letters and a number." />
            <div>
              <p className="label">Roles <span className="text-red-500">*</span></p>
              {errors.roleIds && <p className="mb-1 text-xs text-red-600">{errors.roleIds}</p>}
              <div className="space-y-2">
                {roles.data?.roles.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5" checked={edit.roleIds.includes(r.id)} onChange={(e) => setEdit({ ...edit, roleIds: e.target.checked ? [...edit.roleIds, r.id] : edit.roleIds.filter((x: string) => x !== r.id) })} />
                    <span><span className="font-medium">{r.name}</span><span className="block text-xs text-slate-500">{r.description}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <Toggle label="Account active" checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} help="Deactivated users are signed out immediately and cannot sign in." />
          </div>
        )}
      </Modal>
    </>
  );
}

// ─────────────────────────── Roles & permissions ───────────────────────────
export function RolesPage() {
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['roles'], queryFn: () => api.get<{ roles: any[]; permissions: { key: string; module: string; description: string }[] }>('/admin/roles') });
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const role = q.data?.roles.find((r) => r.id === selected) ?? q.data?.roles[0];
  useEffect(() => {
    if (role) setDraft({ ...role, permissions: [...role.permissions] });
  }, [role?.id, q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.isLoading || !q.data) return <Loading />;
  const modules: Record<string, typeof q.data.permissions> = {};
  for (const p of q.data.permissions) (modules[p.module] ??= []).push(p);
  const locked = draft?.key === 'super_admin';
  const save = async () => {
    try {
      if (draft.id) await api.put(`/admin/roles/${draft.id}`, { name: draft.name, description: draft.description, permissions: draft.permissions });
      else {
        const r = await api.post('/admin/roles', { name: draft.name, description: draft.description, permissions: draft.permissions });
        setSelected(r.id);
      }
      toast('Role saved — permissions apply within 30 seconds');
      qc.invalidateQueries({ queryKey: ['roles'] });
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const toggle = (k: string) => setDraft({ ...draft, permissions: draft.permissions.includes(k) ? draft.permissions.filter((x: string) => x !== k) : [...draft.permissions, k] });
  return (
    <>
      <PageHeader title="Roles & permissions" description="Configure what each role can do. Users can hold several roles." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => (setSelected('new'), setDraft({ name: 'New role', description: '', permissions: ['dashboard.view'] }))}>New role</Button>} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="card divide-y divide-slate-100 self-start">
          {q.data.roles.map((r) => (
            <button key={r.id} onClick={() => setSelected(r.id)} className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${draft?.id === r.id ? 'bg-brand-50' : ''}`}>
              <p className="text-sm font-medium text-slate-800">{r.name}</p>
              <p className="text-xs text-slate-500">{r.userCount} user{r.userCount === 1 ? '' : 's'} · {r.permissions.length} permissions</p>
            </button>
          ))}
        </div>
        {draft && (
          <Section
            title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-gold-600" />{draft.id ? draft.name : 'New role'}</span>}
            description={locked ? 'The Super Administrator always has every permission.' : draft.isSystem ? 'Built-in role — permissions can be adjusted.' : undefined}
            actions={
              !locked && (
                <div className="flex gap-2">
                  {draft.id && !draft.isSystem && <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (await confirm({ title: `Delete role ${draft.name}?`, danger: true, confirmLabel: 'Delete' })) { try { await api.del(`/admin/roles/${draft.id}`); setSelected(null); qc.invalidateQueries({ queryKey: ['roles'] }); } catch (e: any) { toast(e.message, 'error'); } } }}>Delete</Button>}
                  <Button size="sm" onClick={save}>Save role</Button>
                </div>
              )
            }
          >
            <fieldset disabled={locked} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Role name" required value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
                <TextInput label="Description" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(modules).map(([mod, perms]) => (
                  <div key={mod} className="rounded-md border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{mod}</p>
                    <div className="space-y-1.5">
                      {perms.map((p) => (
                        <label key={p.key} className="flex cursor-pointer items-start gap-2 text-sm">
                          <input type="checkbox" className="mt-0.5" checked={draft.permissions.includes(p.key)} onChange={() => toggle(p.key)} />
                          <span>{p.description}<span className="block font-mono text-[10px] text-slate-400">{p.key}</span></span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </Section>
        )}
      </div>
    </>
  );
}

// ─────────────────────────── Revision history (all content) ───────────────────────────
export function RevisionsPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const q = useQuery({ queryKey: ['revisions', page, type], queryFn: () => api.get<Paged<any>>(`/admin/revisions${qs({ page, pageSize: 30, entityType: type })}`) });
  const MOD: Record<string, string> = { page: 'pages', person: 'people', message: 'messages', post: 'posts', event: 'events', story: 'stories', faculty: 'faculty', result: 'results', vacancy: 'vacancies' };
  return (
    <>
      <PageHeader title="Revision history" description="Every saved, published and restored version across the website. Open an item to compare or restore versions." />
      <div className="card">
        <div className="border-b border-slate-100 p-3">
          <select className="input w-56" value={type} onChange={(e) => (setType(e.target.value), setPage(1))} aria-label="Content type">
            <option value="">All content types</option>
            {['page', 'person', 'message', 'post', 'event', 'story', 'setting'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <EmptyState title="No revisions" /> : (
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50"><tr><th className="th">Item</th><th className="th">Version</th><th className="th hidden md:table-cell">By</th><th className="th">When</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.items.map((r) => (
                <tr key={r.id}>
                  <td className="td">
                    {MOD[r.entityType] ? <Link to={itemLink(MOD[r.entityType]!, r.entityId)} className="font-medium text-brand-800 hover:underline">{r.title ?? r.entityId}</Link> : <span className="font-medium">{r.title ?? r.entityId}</span>}
                    <span className="ml-2"><Badge>{r.entityType}</Badge></span>
                  </td>
                  <td className="td text-sm">v{r.version} <Badge tone={r.action === 'PUBLISH' ? 'green' : r.action === 'RESTORE' ? 'purple' : 'slate'}>{r.action.toLowerCase()}</Badge></td>
                  <td className="td hidden text-sm text-slate-600 md:table-cell">{r.createdByName ?? 'System'}</td>
                  <td className="td text-xs text-slate-500">{fmtDate(r.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pagination {...q.data.pagination} onPage={setPage} />}
      </div>
    </>
  );
}

// ─────────────────────────── Audit logs ───────────────────────────
export function AuditPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<any>(null);
  const q = useQuery({ queryKey: ['audit', search, page, from, to], queryFn: () => api.get<Paged<any>>(`/admin/audit-logs${qs({ search, page, pageSize: 30, from, to: to ? `${to}T23:59:59` : '' })}`) });
  return (
    <>
      <PageHeader title="Audit logs" description="A permanent record of sign-ins, content changes, workflow actions, uploads and configuration changes." />
      <div className="card">
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Search actions…" />
          <label className="text-xs text-slate-500">From<input type="date" className="input" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} /></label>
          <label className="text-xs text-slate-500">To<input type="date" className="input" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} /></label>
        </div>
        {q.isLoading ? <Loading /> : q.error ? <div className="p-4"><ErrorBox error={q.error} /></div> : !q.data?.items.length ? <EmptyState title="No entries" /> : (
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50"><tr><th className="th">When</th><th className="th">User</th><th className="th">Action</th><th className="th hidden lg:table-cell">IP</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.items.map((a) => (
                <tr key={a.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setView(a)}>
                  <td className="td whitespace-nowrap text-xs text-slate-500">{fmtDate(a.createdAt, true)}</td>
                  <td className="td text-sm">{a.user?.name ?? <span className="text-slate-400">System / anonymous</span>}</td>
                  <td className="td text-sm"><span className="font-mono text-xs text-slate-500">{a.action}</span><br />{a.summary}</td>
                  <td className="td hidden font-mono text-xs text-slate-400 lg:table-cell">{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pagination {...q.data.pagination} onPage={setPage} />}
      </div>
      <Modal open={!!view} onClose={() => setView(null)} title="Audit entry" wide>
        <pre className="max-h-[60vh] overflow-auto rounded bg-slate-900 p-4 text-xs text-slate-100">{JSON.stringify(view, null, 2)}</pre>
      </Modal>
    </>
  );
}

// ─────────────────────────── My account ───────────────────────────
export function AccountPage() {
  const { user, reload } = useAuth();
  const { toast } = useFeedback();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [code, setCode] = useState('');
  const changePw = async () => {
    setPwErr({});
    if (pw.newPassword !== pw.confirm) return setPwErr({ confirm: 'Passwords do not match' });
    try {
      await api.post('/admin/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast('Password changed');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) {
      if (e instanceof ApiError) setPwErr(e.fieldErrors);
      toast((e as Error).message, 'error');
    }
  };
  const twoFactor = async (action: 'enable' | 'disable') => {
    try {
      await api.post(`/admin/auth/2fa/${action}`, { code });
      toast(action === 'enable' ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled');
      setSetup(null);
      setCode('');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  return (
    <>
      <PageHeader title="My account" description={`${user?.email} · ${user?.roles.map((r) => r.name).join(', ')}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Change password">
          <div className="space-y-4">
            <TextInput label="Current password" type="password" value={pw.currentPassword} onChange={(v) => setPw({ ...pw, currentPassword: v })} error={pwErr.currentPassword} />
            <TextInput label="New password" type="password" value={pw.newPassword} onChange={(v) => setPw({ ...pw, newPassword: v })} error={pwErr.newPassword} help="At least 10 characters with upper- and lower-case letters and a number." />
            <TextInput label="Confirm new password" type="password" value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} error={pwErr.confirm} />
            <Button onClick={changePw} disabled={!pw.currentPassword || !pw.newPassword}>Change password</Button>
          </div>
        </Section>
        <Section title="Two-factor authentication" description="Adds a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator…) to every sign-in.">
          {user?.twoFactorEnabled ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-emerald-700"><ShieldCheck className="h-4 w-4" /> Enabled</p>
              <TextInput label="Enter a current code to disable" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} />
              <Button variant="secondary" disabled={code.length !== 6} onClick={() => twoFactor('disable')}>Disable two-factor</Button>
            </div>
          ) : setup ? (
            <div className="space-y-3">
              <img src={setup.qrCode} alt="Scan with your authenticator app" className="h-44 w-44 rounded border border-slate-200" />
              <p className="text-xs text-slate-500">Or enter this key manually: <span className="font-mono">{setup.secret}</span></p>
              <TextInput label="6-digit code from the app" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} />
              <Button disabled={code.length !== 6} onClick={() => twoFactor('enable')}>Confirm & enable</Button>
            </div>
          ) : (
            <Button variant="secondary" icon={<ShieldCheck className="h-4 w-4" />} onClick={async () => setSetup(await api.post('/admin/auth/2fa/setup'))}>Set up two-factor</Button>
          )}
        </Section>
      </div>
    </>
  );
}
