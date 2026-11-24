import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CornerDownRight, ExternalLink, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { ICON_NAMES, SETTINGS_MAP } from '@sst/shared';
import { api, ApiError, qs, type Paged } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ICONS } from '../lib/icons';
import { Badge, Button, EmptyState, ErrorBox, Loading, Modal, PageHeader, Section, Tabs, useFeedback } from '../components/ui';
import { FieldList, FormRow, IconPicker, SelectInput, TextInput, Toggle } from '../components/fields';
import { useMediaItem, thumb } from '../components/media';

// ─────────────────────────── Committees (role assignments) ───────────────────────────
function Portrait({ id }: { id?: string | null }) {
  const m = useMediaItem(id);
  return <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100">{m.data && <img src={thumb(m.data, 160)} alt="" className="h-full w-full object-cover" />}</div>;
}

export function CommitteePage() {
  const { slug } = useParams();
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['committees'], queryFn: () => api.get<any[]>('/admin/committees') });
  const people = useQuery({ queryKey: ['people', 'all'], queryFn: () => api.get<Paged<any>>(`/admin/people${qs({ pageSize: 100, sort: 'fullName', order: 'asc' })}`) });
  const [edit, setEdit] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const committee = q.data?.find((c) => c.slug === slug);
  if (q.isLoading) return <Loading />;
  if (!committee) return <EmptyState title="Committee not found" />;
  const editable = can('people.edit');
  const refresh = () => qc.invalidateQueries({ queryKey: ['committees'] });

  const saveMember = async () => {
    try {
      const body = { roleTitle: edit.roleTitle, isHead: !!edit.isHead, isVisible: edit.isVisible !== false };
      if (edit.id) await api.put(`/admin/committees/${committee.id}/members/${edit.id}`, body);
      else await api.post(`/admin/committees/${committee.id}/members`, { ...body, personId: edit.personId });
      toast(edit.id ? 'Role updated' : 'Person assigned');
      setEdit(null);
      refresh();
      qc.invalidateQueries({ queryKey: ['people'] });
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const remove = async (m: any) => {
    if (!(await confirm({ title: `Remove ${m.person.fullName} from ${committee.name}?`, text: 'The person record and their other roles are kept.', confirmLabel: 'Remove', danger: true }))) return;
    await api.del(`/admin/committees/${committee.id}/members/${m.id}`);
    toast('Removed');
    refresh();
  };
  const moveMember = async (i: number, to: number) => {
    const ids = committee.members.map((m: any) => m.id);
    const [x] = ids.splice(i, 1);
    ids.splice(to, 0, x);
    await api.post(`/admin/committees/${committee.id}/reorder`, { memberIds: ids });
    refresh();
  };
  const assigned = new Set(committee.members.map((m: any) => m.person.id));

  return (
    <>
      <PageHeader
        title={committee.name}
        description="The website directory is generated from these role assignments. Profile details (photo, biography, education…) are edited on the person record and shared across all their roles."
        actions={
          editable && (
            <>
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setDetails({ name: committee.name, description: committee.description ?? '', profileLabel: committee.profileLabel })}>Committee details</Button>
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ personId: '', roleTitle: '', isHead: false, isVisible: true })}>Assign person</Button>
            </>
          )
        }
      />
      <div className="card divide-y divide-slate-100">
        {!committee.members.length && <EmptyState title="No members yet" text="Assign people from the central people records." />}
        {committee.members.map((m: any, i: number) => (
          <div key={m.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <Portrait id={m.person.photoId} />
            <div className="min-w-0 flex-1">
              <Link to={`/people/${m.person.id}`} className="font-medium text-brand-800 hover:underline">{m.person.fullName}</Link>
              <p className="text-sm text-slate-500">{m.roleTitle}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {m.isHead && <Badge tone="blue">Head</Badge>}
              {!m.isVisible && <Badge>Hidden</Badge>}
              {!m.person.isLive && <Badge tone="amber">Profile not published</Badge>}
            </div>
            {editable && (
              <div className="flex items-center">
                <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => moveMember(i, i - 1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === committee.members.length - 1} onClick={() => moveMember(i, i + 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                <Button size="sm" variant="ghost" onClick={() => setEdit({ ...m, personId: m.person.id })}>Edit role</Button>
                <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(m)} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Need a new person? <Link to="/people/new" className="text-brand-700 hover:underline">Create the person record</Link> first, then assign them here. People who are already on another committee can be assigned directly — no duplicate records.
      </p>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit role' : `Assign to ${committee.name}`}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit?.personId || !edit?.roleTitle?.trim()} onClick={saveMember}>Save</Button></>}
      >
        {edit && (
          <div className="space-y-4">
            {!edit.id && (
              <SelectInput
                label="Person"
                required
                value={edit.personId}
                onChange={(v) => setEdit({ ...edit, personId: v })}
                options={(people.data?.items ?? []).filter((p) => !assigned.has(p.id)).map((p) => ({ value: p.id, label: `${p.fullName}${p.memberships?.length ? ` (${p.memberships.map((x: any) => x.committee.name).join(', ')})` : ''}` }))}
              />
            )}
            <TextInput label="Role title" required value={edit.roleTitle} onChange={(v) => setEdit({ ...edit, roleTitle: v })} help='Shown under the name, e.g. "Trustee" or "Chairman, Board of Trustees"' />
            <Toggle label="Head of this committee" checked={!!edit.isHead} onChange={(v) => setEdit({ ...edit, isHead: v })} help="Highlighted first in the directory" />
            <Toggle label="Show on the website" checked={edit.isVisible !== false} onChange={(v) => setEdit({ ...edit, isVisible: v })} />
          </div>
        )}
      </Modal>
      <Modal
        open={!!details}
        onClose={() => setDetails(null)}
        title="Committee details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetails(null)}>Cancel</Button>
            <Button onClick={async () => { try { await api.put(`/admin/committees/${committee.id}`, details); toast('Saved'); setDetails(null); refresh(); } catch (e: any) { toast(e.message, 'error'); } }}>Save</Button>
          </>
        }
      >
        {details && (
          <div className="space-y-4">
            <TextInput label="Name" required value={details.name} onChange={(v) => setDetails({ ...details, name: v })} />
            <TextInput label="Profile page label" required value={details.profileLabel} onChange={(v) => setDetails({ ...details, profileLabel: v })} help='Hero subtitle on individual profiles, e.g. "Trustee Profile"' />
          </div>
        )}
      </Modal>
    </>
  );
}

// ─────────────────────────── Statistics ───────────────────────────
export function StatisticsPage() {
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['statistics'], queryFn: () => api.get<Paged<any>>(`/admin/statistics${qs({ pageSize: 100, sort: 'sortOrder', order: 'asc' })}`) });
  const [edit, setEdit] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const groups: Record<string, any[]> = {};
  for (const s of q.data?.items ?? []) (groups[s.group] ??= []).push(s);
  const save = async () => {
    setErrors({});
    try {
      const { id, createdAt, updatedAt, updatedById, ...body } = edit;
      if (id) await api.put(`/admin/statistics/${id}`, body);
      else await api.post('/admin/statistics', body);
      toast('Statistic saved — the website updates automatically');
      setEdit(null);
      qc.invalidateQueries({ queryKey: ['statistics'] });
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast((e as Error).message, 'error');
    }
  };
  return (
    <>
      <PageHeader
        title="Statistics"
        description='All figures displayed on the website. The "impact" group feeds the Our Impact page. Changes go live immediately.'
        actions={can('statistics.edit') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ key: '', group: 'impact', label: '', value: '', icon: null, sortOrder: 0, isPublished: true })}>New statistic</Button>}
      />
      {q.isLoading ? <Loading /> : (
        <div className="space-y-6">
          {Object.entries(groups).map(([g, items]) => (
            <Section key={g} title={<span className="capitalize">{g}</span>}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => {
                  const Icon = s.icon ? ICONS[s.icon] : null;
                  return (
                    <button key={s.id} disabled={!can('statistics.edit')} onClick={() => setEdit(s)} className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-left hover:border-brand-300 disabled:cursor-default">
                      {Icon && <Icon className="mt-1 h-5 w-5 text-gold-600" />}
                      <span className="min-w-0">
                        <span className="block text-xl font-semibold text-slate-800">{s.value}</span>
                        <span className="block text-sm text-slate-600">{s.label}</span>
                        <span className="block font-mono text-[11px] text-slate-400">{s.key}{!s.isPublished && ' · hidden'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>
          ))}
        </div>
      )}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit statistic' : 'New statistic'}
        footer={
          <>
            {edit?.id && <Button variant="ghost" className="mr-auto text-red-600" onClick={async () => { if (await confirm({ title: 'Delete this statistic?', danger: true, confirmLabel: 'Delete' })) { await api.del(`/admin/statistics/${edit.id}`); setEdit(null); qc.invalidateQueries({ queryKey: ['statistics'] }); } }}>Delete</Button>}
            <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Value" required value={edit.value} onChange={(v) => setEdit({ ...edit, value: v })} error={errors.value} help='As displayed, e.g. "3,500+"' />
            <TextInput label="Label" required value={edit.label} onChange={(v) => setEdit({ ...edit, label: v })} error={errors.label} />
            <TextInput label="Key" required value={edit.key} onChange={(v) => setEdit({ ...edit, key: v })} error={errors.key} help="Unique identifier (lowercase, underscores)" />
            <TextInput label="Group" required value={edit.group} onChange={(v) => setEdit({ ...edit, group: v })} error={errors.group} />
            <FormRow label="Icon"><IconPicker value={edit.icon} onChange={(v) => setEdit({ ...edit, icon: v })} /></FormRow>
            <TextInput label="Display order" type="number" value={edit.sortOrder} onChange={(v) => setEdit({ ...edit, sortOrder: Number(v) })} />
            <div className="sm:col-span-2"><Toggle label="Show on the website" checked={edit.isPublished} onChange={(v) => setEdit({ ...edit, isPublished: v })} /></div>
          </div>
        )}
      </Modal>
    </>
  );
}

// ─────────────────────────── Navigation ───────────────────────────
const MENUS = [
  { value: 'MAIN', label: 'Main menu' },
  { value: 'UTILITY', label: 'Top utility bar' },
  { value: 'FOOTER_QUICK', label: 'Footer — Quick Links' },
  { value: 'FOOTER_USEFUL', label: 'Footer — Useful Links' },
  { value: 'FOOTER_LEGAL', label: 'Footer — legal links' },
];

export function NavigationPage() {
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const [menu, setMenu] = useState('MAIN');
  const [edit, setEdit] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const q = useQuery({ queryKey: ['navigation', menu], queryFn: () => api.get<Paged<any>>(`/admin/navigation${qs({ menu, pageSize: 100, sort: 'sortOrder', order: 'asc' })}`) });
  const items = q.data?.items ?? [];
  const roots = items.filter((i) => !i.parentId);
  const childrenOf = (id: string) => items.filter((i) => i.parentId === id);
  const editable = can('navigation.edit');
  const refresh = () => qc.invalidateQueries({ queryKey: ['navigation'] });
  const reorder = async (list: any[], i: number, to: number) => {
    const ids = list.map((x) => x.id);
    const [x] = ids.splice(i, 1);
    ids.splice(to, 0, x);
    await api.post('/admin/navigation/reorder', { ids });
    refresh();
  };
  const save = async () => {
    setErrors({});
    try {
      const { id, createdAt, updatedAt, updatedById, ...body } = edit;
      if (id) await api.put(`/admin/navigation/${id}`, body);
      else await api.post('/admin/navigation', { ...body, sortOrder: 999 });
      toast('Navigation saved');
      setEdit(null);
      refresh();
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast((e as Error).message, 'error');
    }
  };
  const Row = ({ item, list, i, depth }: { item: any; list: any[]; i: number; depth: number }) => (
    <div className="flex items-center gap-3 px-4 py-2.5" style={{ paddingLeft: 16 + depth * 28 }}>
      {depth > 0 && <CornerDownRight className="h-4 w-4 text-slate-300" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{item.label}</p>
        <p className="truncate font-mono text-xs text-slate-400">{item.href}</p>
      </div>
      {!item.isVisible && <Badge>Hidden</Badge>}
      {item.isComingSoon && <Badge tone="amber">Coming soon</Badge>}
      {editable && (
        <div className="flex items-center">
          <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => reorder(list, i, i - 1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
          <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === list.length - 1} onClick={() => reorder(list, i, i + 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
          <Button size="sm" variant="ghost" onClick={() => setEdit(item)}>Edit</Button>
          <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete" onClick={async () => { if (await confirm({ title: `Delete "${item.label}"?`, text: depth === 0 ? 'Sub-items are deleted too.' : undefined, danger: true, confirmLabel: 'Delete' })) { await api.del(`/admin/navigation/${item.id}`); refresh(); } }}><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
  return (
    <>
      <PageHeader
        title="Navigation"
        description="Menus shown on the website. The main menu supports three levels: each section's sub-items also form that section's sidebar. Give a section an icon to show its name as the sidebar heading."
        actions={editable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ menu, label: '', href: '/', parentId: null, isVisible: true, isComingSoon: false, openInNewTab: false, icon: null })}>Add link</Button>}
      />
      <Tabs tabs={MENUS} value={menu} onChange={setMenu} />
      {q.isLoading ? <Loading /> : (
        <div className="card divide-y divide-slate-100">
          {!roots.length && <EmptyState title="This menu is empty" />}
          {roots.map((r, i) => (
            <div key={r.id}>
              <Row item={r} list={roots} i={i} depth={0} />
              {childrenOf(r.id).map((c, j, arr) => (
                <div key={c.id}>
                  <Row item={c} list={arr} i={j} depth={1} />
                  {childrenOf(c.id).map((g, k, arr2) => <Row key={g.id} item={g} list={arr2} i={k} depth={2} />)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit link' : 'Add link'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Label" required value={edit.label} onChange={(v) => setEdit({ ...edit, label: v })} error={errors.label} />
            <TextInput label="Link" required value={edit.href} onChange={(v) => setEdit({ ...edit, href: v })} error={errors.href} help="/path or https://…" />
            <SelectInput label="Parent" value={edit.parentId} onChange={(v) => setEdit({ ...edit, parentId: v })} placeholder="— Top level —" options={roots.filter((r) => r.id !== edit.id).flatMap((r) => [{ value: r.id, label: r.label }, ...childrenOf(r.id).filter((c) => c.id !== edit.id).map((c) => ({ value: c.id, label: `${r.label} › ${c.label}` }))])} />
            <FormRow label="Icon (sidebar)"><IconPicker value={edit.icon} onChange={(v) => setEdit({ ...edit, icon: v })} /></FormRow>
            <div className="space-y-3 sm:col-span-2">
              <Toggle label="Visible" checked={edit.isVisible} onChange={(v) => setEdit({ ...edit, isVisible: v })} />
              <Toggle label='Show as "coming soon"' checked={edit.isComingSoon} onChange={(v) => setEdit({ ...edit, isComingSoon: v })} help="The link opens a coming-soon notice instead of a page" />
              <Toggle label="Open in a new tab" checked={edit.openInNewTab} onChange={(v) => setEdit({ ...edit, openInNewTab: v })} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// ─────────────────────────── Settings ───────────────────────────
export function SettingsPage() {
  const { group = 'identity' } = useParams();
  const { can } = useAuth();
  const { toast } = useFeedback();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api.get<any[]>('/admin/settings') });
  const keys = group === 'identity' ? ['identity', 'theme'] : [group];
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) setValues(Object.fromEntries(q.data.map((g) => [g.key, structuredClone(g.value)])));
  }, [q.data]);
  if (q.isLoading || !q.data) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const save = async (key: string) => {
    setSaving(key);
    setErrors({ ...errors, [key]: {} });
    try {
      await api.put(`/admin/settings/${key}`, values[key]);
      toast(`${SETTINGS_MAP[key]!.name} saved — the website updates automatically`);
      qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (e) {
      if (e instanceof ApiError) setErrors({ ...errors, [key]: Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [`s.${k}`, v])) });
      toast((e as Error).message, 'error');
    } finally {
      setSaving(null);
    }
  };
  return (
    <>
      <PageHeader title={keys.map((k) => SETTINGS_MAP[k]?.name).join(' & ')} actions={<a href="/" target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-brand-700"><ExternalLink className="h-4 w-4" /> View website</a>} />
      <div className="space-y-6">
        {keys.map((key) => {
          const def = SETTINGS_MAP[key];
          if (!def) return <EmptyState key={key} title="Unknown settings group" />;
          return (
            <Section
              key={key}
              title={def.name}
              description={def.description}
              actions={can('settings.edit') && <Button size="sm" icon={<Save className="h-3.5 w-3.5" />} loading={saving === key} onClick={() => save(key)}>Save</Button>}
            >
              <fieldset disabled={!can('settings.edit')}>
                <FieldList fields={def.fields} value={values[key] ?? {}} onChange={(v) => setValues({ ...values, [key]: v })} path="s" errors={errors[key] ?? {}} />
              </fieldset>
              {key === 'theme' && (
                <div className="mt-4 flex gap-3">
                  {[{ k: 'navy', c: '#14254f' }, { k: 'purple', c: '#4a1d5f' }].map((t) => (
                    <div key={t.k} className="flex items-center gap-2 text-xs text-slate-500"><span className="h-5 w-5 rounded" style={{ background: t.c }} />{t.k}</div>
                  ))}
                </div>
              )}
            </Section>
          );
        })}
      </div>
    </>
  );
}

export const ICON_LIST = ICON_NAMES;
