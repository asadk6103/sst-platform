import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Info, Save } from 'lucide-react';
import { TEMPLATE_MAP, type Field } from '@sst/shared';
import { api, ApiError, qs, type Paged } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, EmptyState, ErrorBox, fmtDate, Loading, PageHeader, SearchInput, Section, StatusBadge, useFeedback } from '../components/ui';
import { FieldControl, FieldList, TextArea, TextInput } from '../components/fields';
import { MediaField } from '../components/media';
import { WorkflowPanel } from '../components/workflow';

const SECTION_LABEL: Record<string, string> = {
  home: 'Homepage',
  about: 'About SST',
  academics: 'Academics',
  admissions: 'Admissions',
  'campus-life': 'Campus Life',
  facilities: 'Facilities',
  'news-events': 'News & Events',
  contact: 'Contact',
  alumni: 'Alumni',
  careers: 'Careers',
  downloads: 'Downloads',
  legal: 'Legal',
};

export function PagesListPage() {
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['pages', 'list', search], queryFn: () => api.get<Paged<any>>(`/admin/pages${qs({ search, pageSize: 100, sort: 'sortOrder', order: 'asc' })}`) });
  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const p of q.data?.items ?? []) (g[p.section] ??= []).push(p);
    return g;
  }, [q.data]);
  return (
    <>
      <PageHeader
        title="Page content"
        description="Every page on the website uses a fixed, approved design. Edit the text, images and documents shown in each predefined section — layouts cannot be changed here."
        actions={<SearchInput value={search} onChange={setSearch} placeholder="Search pages…" />}
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : !q.data?.items.length ? (
        <EmptyState title="No pages match your search" />
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([section, pages]) => (
            <div key={section} className="card overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{SECTION_LABEL[section] ?? section}</div>
              <table className="w-full">
                <tbody className="divide-y divide-slate-100">
                  {pages.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="td">
                        <Link to={`/pages/${p.id}`} className="font-medium text-brand-800 hover:underline">{p.title}</Link>
                        <p className="text-xs text-slate-400">/{p.slug === 'home' ? '' : p.slug}</p>
                      </td>
                      <td className="td hidden text-xs text-slate-500 md:table-cell">{TEMPLATE_MAP[p.template]?.name ?? p.template}</td>
                      <td className="td"><StatusBadge status={p.status} isLive={p.isLive} hasPendingChanges={p.hasPendingChanges} scheduledPublishAt={p.scheduledPublishAt} /></td>
                      <td className="td hidden text-right text-xs text-slate-500 lg:table-cell">{fmtDate(p.updatedAt, true)}{p.updatedByName ? ` · ${p.updatedByName}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const isUuid = (s?: string) => !!s && /^[0-9a-f-]{36}$/i.test(s);

/** Leaves the page only after confirming when there are unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
}

export function PageEditorPage() {
  const { id: param } = useParams();
  const { can } = useAuth();
  const { toast } = useFeedback();
  const qc = useQueryClient();
  // "/pages/home" resolves the homepage by slug.
  const lookup = useQuery({
    queryKey: ['pages', 'slug', param],
    queryFn: async () => (await api.get<Paged<any>>(`/admin/pages${qs({ search: param, pageSize: 100 })}`)).items.find((p) => p.slug === param)?.id ?? null,
    enabled: !isUuid(param),
  });
  const id = isUuid(param) ? param : lookup.data;
  const q = useQuery({ queryKey: ['pages', id], queryFn: () => api.get(`/admin/pages/${id}`), enabled: !!id });
  const [form, setForm] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = !!form && !!q.data && JSON.stringify(pick(form)) !== JSON.stringify(pick(q.data));
  useUnsavedWarning(dirty);
  useEffect(() => {
    if (q.data) setForm(structuredClone(q.data));
  }, [q.data]);

  if (lookup.isLoading || q.isLoading || !form) return lookup.data === null ? <EmptyState title="Page not found" /> : <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const page = q.data;
  const template = TEMPLATE_MAP[page.template];
  const editable = page.canEdit && can('pages.edit');

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      await api.put(`/admin/pages/${page.id}`, { ...pick(form), expectedUpdatedAt: page.updatedAt });
      toast('Saved as draft. Submit it for review to publish.');
      await qc.invalidateQueries({ queryKey: ['pages'] });
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast(e instanceof ApiError && e.code === 'VALIDATION_ERROR' ? 'Please correct the highlighted fields' : (e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const setContent = (name: string, v: any) => setForm({ ...form, content: { ...form.content, [name]: v } });

  return (
    <>
      <PageHeader
        back={<Link to="/pages" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> All pages</Link>}
        title={page.title}
        description={<>Template: <strong>{template?.name}</strong> · <span className="font-mono">/{page.slug === 'home' ? '' : page.slug}</span></>}
        actions={
          <>
            {page.workflow.isLive && page.publicPath && page.template !== 'person-profile' && (
              <a href={page.publicPath} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                <ExternalLink className="h-4 w-4" /> View live
              </a>
            )}
            {editable && <Button icon={<Save className="h-4 w-4" />} loading={saving} disabled={!dirty} onClick={save}>Save draft</Button>}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <fieldset disabled={!editable} className="min-w-0 space-y-6">
          {template?.notes && (
            <div className="flex gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" /> {template.notes}
            </div>
          )}
          {page.template !== 'home' && page.template !== 'person-profile' && (
            <Section title="Page details" description="Hero banner title, subtitle and background image.">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Page title" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} error={errors.title} />
                <div className="md:col-span-2"><TextArea label="Subtitle" rows={2} value={form.subtitle} onChange={(v) => setForm({ ...form, subtitle: v })} error={errors.subtitle} /></div>
                <div className="md:col-span-2">
                  <label className="label">Hero image</label>
                  <MediaField value={form.heroImageId} onChange={(v) => setForm({ ...form, heroImageId: v })} aspect="aspect-[3/1]" />
                  <p className="mt-1 text-xs text-slate-500">Leave empty to use the default hero image from Website Settings.</p>
                </div>
              </div>
            </Section>
          )}
          {template?.fields.map((f: Field) =>
            f.type === 'group' ? (
              <Section key={f.name} title={f.label} description={f.help}>
                <FieldList fields={f.fields} value={form.content?.[f.name] ?? {}} onChange={(v) => setContent(f.name, v)} path={`content.${f.name}`} errors={errors} />
              </Section>
            ) : (
              <Section key={f.name} title={f.label} description={f.help}>
                <FieldControl field={{ ...f, label: f.type === 'list' ? '' : f.label } as Field} value={form.content?.[f.name]} onChange={(v) => setContent(f.name, v)} path={`content.${f.name}`} errors={errors} />
              </Section>
            ),
          )}
          {page.template !== 'person-profile' && (
            <Section title="SEO" description="Search engine and social sharing metadata. Defaults from SEO Settings are used when empty.">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="SEO title" value={form.seoTitle} onChange={(v) => setForm({ ...form, seoTitle: v })} error={errors.seoTitle} help={`${(form.seoTitle ?? '').length}/60 recommended`} />
                <TextInput label="Keywords" value={form.seoKeywords} onChange={(v) => setForm({ ...form, seoKeywords: v })} />
                <div className="md:col-span-2"><TextArea label="Meta description" rows={2} value={form.seoDescription} onChange={(v) => setForm({ ...form, seoDescription: v })} error={errors.seoDescription} help={`${(form.seoDescription ?? '').length}/160 recommended`} /></div>
                <div className="md:col-span-2"><label className="label">Social sharing image</label><MediaField value={form.ogImageId} onChange={(v) => setForm({ ...form, ogImageId: v })} /></div>
              </div>
            </Section>
          )}
        </fieldset>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {dirty && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">You have unsaved changes.</p>}
          {!editable && <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">You have read-only access to this page.</p>}
          <WorkflowPanel module="pages" id={page.id} workflow={page.workflow} publicPath={page.publicPath} dirty={dirty} onChanged={() => qc.invalidateQueries({ queryKey: ['pages'] })} />
          <p className="px-1 text-xs text-slate-400">Last saved {fmtDate(page.updatedAt, true)}{page.updatedByName ? ` by ${page.updatedByName}` : ''}</p>
        </aside>
      </div>
    </>
  );
}

const pick = (p: any) => ({
  title: p.title,
  subtitle: p.subtitle ?? null,
  heroImageId: p.heroImageId ?? null,
  content: p.content,
  seoTitle: p.seoTitle ?? null,
  seoDescription: p.seoDescription ?? null,
  seoKeywords: p.seoKeywords ?? null,
  ogImageId: p.ogImageId ?? null,
});
