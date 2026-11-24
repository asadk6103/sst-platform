import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileDown, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, getToken, qs, type Paged } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ICONS } from '../lib/icons';
import { Badge, Button, EmptyState, fmtDate, Loading, Modal, PageHeader, Pagination, SearchInput, Tabs, useFeedback } from '../components/ui';
import { FormRow, IconPicker, SelectInput, TextArea, TextInput, Toggle } from '../components/fields';

// ─────────────────────────── Categories ───────────────────────────
export const SCOPES = [
  { value: 'news', label: 'News' },
  { value: 'events', label: 'Events' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'achievements', label: 'Achievements' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'documents', label: 'Downloads' },
  { value: 'faq', label: 'FAQs' },
  { value: 'departments', label: 'Job departments' },
  { value: 'job-types', label: 'Job types' },
];

export function CategoriesPage() {
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const [scope, setScope] = useState('news');
  const [edit, setEdit] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const q = useQuery({ queryKey: ['categories', scope], queryFn: () => api.get<Paged<any>>(`/admin/categories${qs({ scope, pageSize: 100, sort: 'sortOrder', order: 'asc' })}`) });
  const editable = can('categories.edit');
  const save = async () => {
    setErrors({});
    try {
      const body = { scope: edit.scope, name: edit.name, slug: edit.slug || undefined, icon: edit.icon || null, sortOrder: Number(edit.sortOrder) || 0 };
      if (edit.id) await api.put(`/admin/categories/${edit.id}`, body);
      else await api.post('/admin/categories', body);
      toast('Category saved');
      setEdit(null);
      qc.invalidateQueries({ queryKey: ['categories'] });
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast((e as Error).message, 'error');
    }
  };
  return (
    <>
      <PageHeader
        title="Categories"
        description="Category lists used by each section (filters, tabs and counts on the website). Renaming a category does not rename it on existing items."
        actions={editable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ scope, name: '', slug: '', icon: null, sortOrder: (q.data?.items.length ?? 0) + 1 })}>New category</Button>}
      />
      <Tabs tabs={SCOPES} value={scope} onChange={setScope} />
      {q.isLoading ? <Loading /> : !q.data?.items.length ? <EmptyState title="No categories yet" /> : (
        <div className="card divide-y divide-slate-100">
          {q.data.items.map((c) => {
            const I = c.icon ? ICONS[c.icon] : null;
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100">{I && <I className="h-4 w-4 text-brand-700" />}</span>
                <span className="flex-1"><span className="font-medium text-slate-800">{c.name}</span><span className="ml-2 font-mono text-xs text-slate-400">{c.slug}</span></span>
                {editable && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEdit(c)}>Edit</Button>
                    <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${c.name}`} onClick={async () => { if (await confirm({ title: `Delete "${c.name}"?`, text: 'Items using it keep their value but it will no longer appear in filters.', danger: true, confirmLabel: 'Delete' })) { await api.del(`/admin/categories/${c.id}`); qc.invalidateQueries({ queryKey: ['categories'] }); } }}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit category' : 'New category'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Name" required value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} error={errors.name} />
            <TextInput label="Slug" value={edit.slug} onChange={(v) => setEdit({ ...edit, slug: v })} error={errors.slug} help="Used in website links; leave empty to generate" />
            <FormRow label="Icon"><IconPicker value={edit.icon} onChange={(v) => setEdit({ ...edit, icon: v })} /></FormRow>
            <TextInput label="Display order" type="number" value={edit.sortOrder} onChange={(v) => setEdit({ ...edit, sortOrder: v })} />
          </div>
        )}
      </Modal>
    </>
  );
}

/** Category dropdown by slug (documents, gallery, FAQs store the slug). */
export function CategorySlugSelect({ scope, value, onChange, label = 'Category', error }: { scope: string; value: any; onChange: (v: any) => void; label?: string; error?: string }) {
  const q = useQuery({ queryKey: ['categories', scope], queryFn: () => api.get<Paged<any>>(`/admin/categories${qs({ scope, pageSize: 100, sort: 'sortOrder', order: 'asc' })}`) });
  return <SelectInput label={label} required error={error} value={value} onChange={onChange} options={(q.data?.items ?? []).map((c) => ({ value: c.slug, label: c.name }))} help="Manage the list under Website Content → Categories" />;
}

// ─────────────────────────── FAQs ───────────────────────────
export function FaqsPage() {
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cats = useQuery({ queryKey: ['categories', 'faq'], queryFn: () => api.get<Paged<any>>(`/admin/categories${qs({ scope: 'faq', pageSize: 100, sort: 'sortOrder', order: 'asc' })}`) });
  const q = useQuery({ queryKey: ['faqs', category, search], queryFn: () => api.get<Paged<any>>(`/admin/faqs${qs({ category, search, pageSize: 100, sort: 'sortOrder', order: 'asc' })}`) });
  const name = (slug: string) => cats.data?.items.find((c) => c.slug === slug)?.name ?? slug;
  const save = async () => {
    setErrors({});
    try {
      const body = { category: edit.category, question: edit.question, answer: edit.answer, sortOrder: Number(edit.sortOrder) || 0, isPublished: !!edit.isPublished };
      if (edit.id) await api.put(`/admin/faqs/${edit.id}`, body);
      else await api.post('/admin/faqs', body);
      toast('FAQ saved — the website updates automatically');
      setEdit(null);
      qc.invalidateQueries({ queryKey: ['faqs'] });
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast((e as Error).message, 'error');
    }
  };
  return (
    <>
      <PageHeader title="Admissions FAQs" description="Questions and answers on the Admissions FAQs page, grouped by category." actions={can('faqs.edit') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ category: category || cats.data?.items[0]?.slug, question: '', answer: '', sortOrder: (q.data?.items.length ?? 0) + 1, isPublished: true })}>New question</Button>} />
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search questions…" />
          <select className="input w-56" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {cats.data?.items.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <EmptyState title="No questions" /> : (
          <ul className="divide-y divide-slate-100">
            {q.data.items.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{f.question}</p>
                  <p className="line-clamp-2 text-sm text-slate-500">{f.answer}</p>
                </div>
                <Badge tone="blue">{name(f.category)}</Badge>
                {!f.isPublished && <Badge>Hidden</Badge>}
                {can('faqs.edit') && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEdit(f)}>Edit</Button>
                    <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete" onClick={async () => { if (await confirm({ title: 'Delete this question?', danger: true, confirmLabel: 'Delete' })) { await api.del(`/admin/faqs/${f.id}`); qc.invalidateQueries({ queryKey: ['faqs'] }); } }}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit question' : 'New question'} wide footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <CategorySlugSelect scope="faq" value={edit.category} onChange={(v) => setEdit({ ...edit, category: v })} error={errors.category} />
              <TextInput label="Display order" type="number" value={edit.sortOrder} onChange={(v) => setEdit({ ...edit, sortOrder: v })} />
            </div>
            <TextInput label="Question" required value={edit.question} onChange={(v) => setEdit({ ...edit, question: v })} error={errors.question} />
            <TextArea label="Answer" required rows={5} value={edit.answer} onChange={(v) => setEdit({ ...edit, answer: v })} error={errors.answer} />
            <Toggle label="Published on the website" checked={!!edit.isPublished} onChange={(v) => setEdit({ ...edit, isPublished: v })} />
          </div>
        )}
      </Modal>
    </>
  );
}

// ─────────────────────────── Submissions inbox ───────────────────────────
const TYPES = [
  { value: 'CONTACT', label: 'Contact messages' },
  { value: 'CAREER', label: 'Job applications' },
  { value: 'NOMINATION', label: 'Achievement nominations' },
  { value: 'ALUMNI', label: 'Alumni registrations' },
  { value: 'SUBSCRIBE', label: 'Subscribers' },
];

export function SubmissionsPage() {
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const [type, setType] = useState('CONTACT');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<any>(null);
  const q = useQuery({ queryKey: ['submissions', type, status, search, page], queryFn: () => api.get<Paged<any> & { unread: Record<string, number> }>(`/admin/submissions${qs({ type, status, search, page, pageSize: 25 })}`) });
  const setState = async (s: any, st: string) => {
    await api.put(`/admin/submissions/${s.id}`, { status: st });
    qc.invalidateQueries({ queryKey: ['submissions'] });
  };
  const open = async (s: any) => {
    setView(s);
    if (s.status === 'NEW' && can('submissions.manage')) await setState(s, 'READ');
  };
  const exportCsv = async () => {
    try {
      // Authenticated download via fetch → blob (the token is not in the URL).
      const res = await fetch(`/api/admin/submissions/export?type=${type}`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` }, credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: `sst-${type.toLowerCase()}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const downloadCv = async (s: any) => {
    const res = await fetch(`/api/admin/submissions/${s.id}/file`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` }, credentials: 'include' });
    if (!res.ok) return toast('Could not download the file', 'error');
    const url = URL.createObjectURL(await res.blob());
    Object.assign(document.createElement('a'), { href: url, download: s.fileName ?? 'cv' }).click();
    URL.revokeObjectURL(url);
  };
  const unread = q.data?.unread ?? {};
  return (
    <>
      <PageHeader
        title="Submissions"
        description="Messages and applications sent from website forms. Personal data — handle according to the school's privacy policy."
        actions={can('submissions.manage') && <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} onClick={exportCsv}>Export CSV</Button>}
      />
      <Tabs tabs={TYPES.map((t) => ({ value: t.value, label: <>{t.label}{unread[t.value] ? <span className="ml-1.5 rounded-full bg-gold-500 px-1.5 text-[11px] text-white">{unread[t.value]}</span> : null}</> }))} value={type} onChange={(v) => (setType(v), setPage(1))} />
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Search name, email, message…" />
          <select className="input w-44" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} aria-label="Status">
            <option value="">New & read</option>
            <option value="NEW">New</option>
            <option value="READ">Read</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <EmptyState title="Nothing here yet" /> : (
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50"><tr><th className="th">From</th><th className="th hidden md:table-cell">Subject</th><th className="th">Received</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.items.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => open(s)}>
                  <td className="td"><span className={s.status === 'NEW' ? 'font-semibold text-slate-900' : 'text-slate-700'}>{s.name ?? s.email}</span><span className="block text-xs text-slate-500">{s.email}</span></td>
                  <td className="td hidden text-sm text-slate-600 md:table-cell">{s.subject ?? s.data?.inquiryType ?? s.data?.source ?? '—'}</td>
                  <td className="td text-xs text-slate-500">{fmtDate(s.createdAt, true)}</td>
                  <td className="td text-right">{s.status === 'NEW' ? <Badge tone="amber">New</Badge> : s.status === 'ARCHIVED' ? <Badge>Archived</Badge> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pagination {...q.data.pagination} onPage={setPage} />}
      </div>
      <Modal
        open={!!view}
        onClose={() => setView(null)}
        wide
        title={view?.subject ?? view?.name ?? 'Submission'}
        footer={
          view && can('submissions.manage') && (
            <>
              <Button variant="ghost" className="mr-auto text-red-600" icon={<Trash2 className="h-4 w-4" />} onClick={async () => { if (await confirm({ title: 'Delete permanently?', text: 'This cannot be undone.', danger: true, confirmLabel: 'Delete' })) { await api.del(`/admin/submissions/${view.id}`); setView(null); qc.invalidateQueries({ queryKey: ['submissions'] }); } }}>Delete</Button>
              {view.status !== 'ARCHIVED' ? <Button variant="secondary" onClick={async () => { await setState(view, 'ARCHIVED'); setView(null); }}>Archive</Button> : <Button variant="secondary" onClick={async () => { await setState(view, 'READ'); setView(null); }}>Restore</Button>}
              {view.email && <a href={`mailto:${view.email}?subject=${encodeURIComponent('Re: ' + (view.subject ?? 'Your message to SST'))}`}><Button>Reply by email</Button></a>}
            </>
          )
        }
      >
        {view && (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[160px_1fr]">
            {[['Name', view.name], ['Email', view.email], ['Phone', view.phone], ['Subject', view.subject], ...Object.entries(view.data ?? {}).filter(([, v]) => v).map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), String(v)]), ['Received', fmtDate(view.createdAt, true)]]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k as string} className="contents"><dt className="font-medium text-slate-500">{k}</dt><dd className="text-slate-800">{v}</dd></div>
              ))}
            {view.message && <div className="contents"><dt className="font-medium text-slate-500">Message</dt><dd className="whitespace-pre-wrap text-slate-800">{view.message}</dd></div>}
            {view.fileKey && <div className="contents"><dt className="font-medium text-slate-500">Attachment</dt><dd><Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCv(view)}>{view.fileName ?? 'Download'}</Button></dd></div>}
          </dl>
        )}
      </Modal>
    </>
  );
}
