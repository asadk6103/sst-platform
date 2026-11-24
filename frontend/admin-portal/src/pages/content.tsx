import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { ICON_NAMES, type Field } from '@sst/shared';
import { api, ApiError, qs, type Paged } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, EmptyState, ErrorBox, fmtDate, Loading, PageHeader, Pagination, SearchInput, Section, StatusBadge, useFeedback } from '../components/ui';
import { FieldControl, FormRow, SelectInput } from '../components/fields';
import { MediaField, useMediaItem, thumb } from '../components/media';
import { WorkflowPanel } from '../components/workflow';
import { useUnsavedWarning } from './pages';

/** Admin-only field types layered on top of the shared field definitions. */
type AdminField = CategoryField | Field | { type: 'date' | 'datetime'; name: string; label: string; required?: boolean; help?: string } | { type: 'person'; name: string; label: string; help?: string };
type CategoryField = { type: 'category'; name: string; label: string; scope: string; help?: string; required?: boolean };

interface ModuleDef {
  module: 'posts' | 'events' | 'stories' | 'people' | 'messages' | 'faculty' | 'results' | 'vacancies';
  title: string;
  singular: string;
  description: string;
  filter?: Record<string, string>;
  defaults?: Record<string, unknown>;
  canCreate?: boolean;
  columns: { label: string; render: (row: any) => ReactNode; className?: string }[];
  fields: AdminField[];
  sidebar?: (item: any) => ReactNode;
}

const opt = (values: string[], labels?: Record<string, string>) => values.map((v) => ({ value: v, label: labels?.[v] ?? v.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) }));
const STORY_KINDS: Record<string, string> = {
  STUDENT_TESTIMONIAL: 'Student testimonial',
  PARENT_TESTIMONIAL: 'Parent testimonial',
  ALUMNI_STORY: 'Alumni story',
  STUDENT_SUCCESS: 'Student success story',
  SCHOLARSHIP_SUCCESS: 'Scholarship success story',
  ACADEMIC_ACHIEVEMENT: 'Academic achievement',
};

function Thumb({ id }: { id?: string | null }) {
  const m = useMediaItem(id);
  return <div className="h-10 w-14 overflow-hidden rounded bg-slate-100">{m.data && <img src={thumb(m.data, 160)} alt="" className="h-full w-full object-cover" />}</div>;
}

const postFields = (kind: string): AdminField[] => [
  { type: 'text', name: 'title', label: 'Title', required: true },
  { type: 'text', name: 'slug', label: 'URL slug', help: 'Leave empty to generate from the title' },
  { type: 'category', name: 'category', label: 'Category', scope: kind === 'NEWS' ? 'news' : kind === 'ANNOUNCEMENT' ? 'announcements' : 'achievements' },
  { type: 'datetime', name: 'publicationDate', label: 'Publication date', required: true },
  { type: 'text', name: 'author', label: 'Author' },
  { type: 'select', name: 'kind', label: 'Type', required: true, options: opt(['NEWS', 'ANNOUNCEMENT', 'ACHIEVEMENT']) },
  { type: 'boolean', name: 'isFeatured', label: kind === 'NEWS' ? 'Featured on the homepage' : 'Featured' },
  ...(kind === 'ACHIEVEMENT' ? [{ type: 'text', name: 'badge', label: 'Badge', help: 'e.g. 1st Position' } as AdminField] : []),
  { type: 'document', name: 'documentId', label: 'Attached document', help: 'Optional circular / notice to download' },
  { type: 'image', name: 'featuredImageId', label: 'Featured image' },
  { type: 'textarea', name: 'excerpt', label: 'Short description', rows: 3 },
  { type: 'richtext', name: 'body', label: 'Article content' },
  { type: 'text', name: 'seoTitle', label: 'SEO title' },
  { type: 'textarea', name: 'seoDescription', label: 'SEO description', rows: 2 },
];

const postModule = (kind: 'NEWS' | 'ANNOUNCEMENT' | 'ACHIEVEMENT', title: string, singular: string): ModuleDef => ({
  module: 'posts',
  title,
  singular,
  description: `Create and manage ${title.toLowerCase()}. Items appear on the website once published.`,
  filter: { kind },
  defaults: { kind, publicationDate: new Date().toISOString(), isFeatured: false, body: '' },
  canCreate: true,
  columns: [
    { label: '', render: (r) => <Thumb id={r.featuredImageId} />, className: 'w-16' },
    { label: 'Title', render: (r) => <span className="font-medium text-brand-800">{r.title}</span> },
    { label: 'Category', render: (r) => r.category ?? '—', className: 'hidden md:table-cell' },
    { label: 'Date', render: (r) => fmtDate(r.publicationDate), className: 'hidden md:table-cell' },
  ],
  fields: postFields(kind),
});

const storyModule = (kinds: string[], title: string, singular: string): ModuleDef => ({
  module: 'stories',
  title,
  singular,
  description: `Manage ${title.toLowerCase()} shown on the website.`,
  filter: { kind: kinds.join(',') },
  defaults: { kind: kinds[0], isFeatured: false, sortOrder: 0 },
  canCreate: true,
  columns: [
    { label: '', render: (r) => <Thumb id={r.photoId} />, className: 'w-16' },
    { label: 'Name', render: (r) => <span className="font-medium text-brand-800">{r.name}</span> },
    { label: 'Type', render: (r) => STORY_KINDS[r.kind], className: 'hidden md:table-cell' },
    { label: 'Featured', render: (r) => (r.isFeatured ? 'Yes' : '—'), className: 'hidden md:table-cell' },
  ],
  fields: [
    { type: 'select', name: 'kind', label: 'Type', required: true, options: kinds.map((k) => ({ value: k, label: STORY_KINDS[k]! })) },
    { type: 'text', name: 'name', label: 'Name', required: true },
    { type: 'text', name: 'subtitle', label: 'Subtitle', help: 'e.g. SST Alumnus (Class of 2018)' },
    { type: 'text', name: 'detail', label: 'Detail line', help: 'e.g. Now: Civil Servant (PCS)' },
    { type: 'number', name: 'sortOrder', label: 'Display order' },
    { type: 'boolean', name: 'isFeatured', label: 'Featured' },
    { type: 'image', name: 'photoId', label: 'Photo' },
    { type: 'textarea', name: 'quote', label: 'Quotation', required: true, rows: 3 },
    { type: 'richtext', name: 'body', label: 'Full story (optional)' },
  ],
});

export const MODULES: Record<string, ModuleDef> = {
  news: postModule('NEWS', 'News', 'news article'),
  announcements: postModule('ANNOUNCEMENT', 'Announcements', 'announcement'),
  achievements: postModule('ACHIEVEMENT', 'Achievements', 'achievement'),
  testimonials: storyModule(['STUDENT_TESTIMONIAL', 'PARENT_TESTIMONIAL'], 'Testimonials', 'testimonial'),
  success: storyModule(['STUDENT_SUCCESS', 'SCHOLARSHIP_SUCCESS', 'ACADEMIC_ACHIEVEMENT'], 'Student Success Stories', 'success story'),
  alumni: storyModule(['ALUMNI_STORY'], 'Alumni Stories', 'alumni story'),
  events: {
    module: 'events',
    title: 'Events',
    singular: 'event',
    description: 'Upcoming and past school events.',
    defaults: { startDate: new Date().toISOString(), isFeatured: false, body: '' },
    canCreate: true,
    columns: [
      { label: 'Title', render: (r) => <span className="font-medium text-brand-800">{r.title}</span> },
      { label: 'Date', render: (r) => fmtDate(r.startDate, true) },
      { label: 'Location', render: (r) => r.location ?? '—', className: 'hidden md:table-cell' },
    ],
    fields: [
      { type: 'text', name: 'title', label: 'Title', required: true },
      { type: 'text', name: 'slug', label: 'URL slug', help: 'Leave empty to generate from the title' },
      { type: 'datetime', name: 'startDate', label: 'Starts', required: true },
      { type: 'datetime', name: 'endDate', label: 'Ends' },
      { type: 'text', name: 'location', label: 'Location' },
      { type: 'category', name: 'category', label: 'Category', scope: 'events' },
      { type: 'text', name: 'author', label: 'Author' },
      { type: 'boolean', name: 'isFeatured', label: 'Featured' },
      { type: 'image', name: 'featuredImageId', label: 'Featured image' },
      { type: 'textarea', name: 'excerpt', label: 'Short description', rows: 3 },
      { type: 'richtext', name: 'body', label: 'Event details' },
      { type: 'text', name: 'seoTitle', label: 'SEO title' },
      { type: 'textarea', name: 'seoDescription', label: 'SEO description', rows: 2 },
    ],
  },
  faculty: {
    module: 'faculty',
    title: 'Faculty',
    singular: 'faculty member',
    description: 'Teachers shown in the Faculty pages and directory. Featured members appear on the Faculty overview.',
    defaults: { qualifications: [], teachingAreas: [], interests: [], development: [], achievements: [], isFeatured: false, sortOrder: 0 },
    canCreate: true,
    columns: [
      { label: '', render: (r) => <Thumb id={r.photoId} />, className: 'w-16' },
      { label: 'Name', render: (r) => <span className="font-medium text-brand-800">{r.fullName}</span> },
      { label: 'Subject', render: (r) => [r.designation, r.subject].filter(Boolean).join(' – ') || '—', className: 'hidden md:table-cell text-sm text-slate-500' },
    ],
    fields: [
      { type: 'text', name: 'fullName', label: 'Full name (with title)', required: true },
      { type: 'text', name: 'slug', label: 'URL slug', help: 'Leave empty to generate from the name' },
      { type: 'text', name: 'designation', label: 'Designation', help: 'e.g. Senior Teacher' },
      { type: 'text', name: 'subject', label: 'Subject' },
      { type: 'text', name: 'department', label: 'Department', help: 'Used by the directory filter' },
      { type: 'text', name: 'programmes', label: 'Programmes', help: 'e.g. Secondary (IX–X)' },
      { type: 'text', name: 'qualification', label: 'Headline qualification' },
      { type: 'text', name: 'experience', label: 'Experience', help: 'e.g. 10+ Years' },
      { type: 'date', name: 'joinedDate', label: 'Joined SST' },
      { type: 'text', name: 'email', label: 'Email (shown on profile)' },
      { type: 'number', name: 'sortOrder', label: 'Display order' },
      { type: 'boolean', name: 'isFeatured', label: 'Featured on the Faculty page' },
      { type: 'image', name: 'photoId', label: 'Photograph' },
      { type: 'textarea', name: 'about', label: 'About', rows: 4 },
      { type: 'stringList', name: 'qualifications', label: 'Academic qualifications', itemLabel: 'Qualification' },
      { type: 'stringList', name: 'teachingAreas', label: 'Teaching areas', itemLabel: 'Area' },
      { type: 'stringList', name: 'interests', label: 'Areas of interest', itemLabel: 'Interest' },
      { type: 'stringList', name: 'development', label: 'Professional development', itemLabel: 'Item' },
      { type: 'stringList', name: 'achievements', label: 'Achievements & contributions', itemLabel: 'Achievement' },
      { type: 'text', name: 'quote', label: 'Banner quotation on profile' },
    ],
  },
  results: {
    module: 'results',
    title: 'Examination Results',
    singular: 'result',
    description: 'Board examination results by examination and year. They feed Academic Achievements, Board Results, Detailed Results and High Achievers.',
    defaults: { summary: {}, grades: [], subjects: [], classes: [], achievers: [], documents: [], isFeatured: false, year: new Date().getFullYear() },
    canCreate: true,
    columns: [
      { label: 'Examination', render: (r) => <span className="font-medium text-brand-800">{r.examination} {r.year}</span> },
      { label: 'Featured', render: (r) => (r.isFeatured ? 'Yes' : '—'), className: 'hidden md:table-cell' },
    ],
    fields: [
      { type: 'text', name: 'examination', label: 'Examination', required: true, help: 'e.g. Matric (SSC)' },
      { type: 'number', name: 'year', label: 'Year', required: true },
      { type: 'boolean', name: 'isFeatured', label: 'Show on Academic Achievements overview' },
      { type: 'group', name: 'summary', label: 'Summary figures', fields: [{ type: 'text', name: 'aRate', label: 'A & A+ rate' }, { type: 'text', name: 'totalStudents', label: 'Total students' }, { type: 'text', name: 'distinctions', label: 'Subject distinctions' }, { type: 'text', name: 'position', label: 'District position' }, { type: 'text', name: 'passRate', label: 'Pass rate' }, { type: 'text', name: 'topHolders', label: 'Top position holders' }] },
      { type: 'list', name: 'grades', label: 'Grade distribution', itemLabel: 'Grade', max: 10, fields: [{ type: 'text', name: 'label', label: 'Grade', required: true }, { type: 'text', name: 'range', label: 'Range' }, { type: 'number', name: 'count', label: 'Students' }, { type: 'text', name: 'percent', label: 'Percent' }] },
      { type: 'list', name: 'subjects', label: 'Subject-wise results', itemLabel: 'Subject', max: 20, fields: [{ type: 'text', name: 'name', label: 'Subject', required: true }, { type: 'number', name: 'rate', label: 'A & A+ rate (%)' }, { type: 'number', name: 'distinctions', label: 'Distinctions' }, { type: 'icon', name: 'icon', label: 'Icon' }] },
      { type: 'list', name: 'classes', label: 'Class-wise results', itemLabel: 'Class', max: 20, fields: [{ type: 'text', name: 'name', label: 'Class / section', required: true }, { type: 'number', name: 'total', label: 'Total students' }, { type: 'text', name: 'aPlus', label: 'A & A+' }, { type: 'text', name: 'b', label: 'B' }, { type: 'text', name: 'belowB', label: 'Below B' }, { type: 'text', name: 'passRate', label: 'Pass rate' }] },
      { type: 'list', name: 'achievers', label: 'High achievers (in rank order)', itemLabel: 'Student', max: 50, fields: [{ type: 'text', name: 'name', label: 'Student name', required: true }, { type: 'image', name: 'photoId', label: 'Photo' }, { type: 'number', name: 'marks', label: 'Marks' }, { type: 'number', name: 'total', label: 'Total marks' }, { type: 'text', name: 'percentage', label: 'Percentage' }, { type: 'text', name: 'grade', label: 'Grade' }] },
      { type: 'documents', name: 'documents', label: 'Downloadable result files' },
    ],
  },
  vacancies: {
    module: 'vacancies',
    title: 'Vacancies',
    singular: 'vacancy',
    description: 'Open positions on the Careers page. Vacancies disappear from the website automatically after the closing date. Applications arrive in Submissions.',
    defaults: { isFeatured: false, body: '' },
    canCreate: true,
    columns: [
      { label: 'Title', render: (r) => <span className="font-medium text-brand-800">{r.title}</span> },
      { label: 'Department', render: (r) => r.department ?? '—', className: 'hidden md:table-cell' },
      { label: 'Closes', render: (r) => fmtDate(r.closingDate), className: 'hidden md:table-cell' },
    ],
    fields: [
      { type: 'text', name: 'title', label: 'Job title', required: true },
      { type: 'text', name: 'slug', label: 'URL slug', help: 'Leave empty to generate from the title' },
      { type: 'category', name: 'department', label: 'Department', scope: 'departments' },
      { type: 'category', name: 'jobType', label: 'Job type', scope: 'job-types' },
      { type: 'text', name: 'location', label: 'Location' },
      { type: 'date', name: 'closingDate', label: 'Apply by' },
      { type: 'boolean', name: 'isFeatured', label: 'Featured' },
      { type: 'textarea', name: 'summary', label: 'Summary', rows: 2 },
      { type: 'richtext', name: 'body', label: 'Job description, responsibilities and requirements' },
    ],
  },
  people: {
    module: 'people',
    title: 'All people',
    singular: 'person',
    description: 'Centralised leadership records. One person can hold several roles — assign them to committees from the Board of Trustees, Executive Committee and School Administration screens.',
    defaults: { responsibilities: [], focusAreas: [], affiliations: [], socialLinks: [], isActive: true },
    canCreate: true,
    columns: [
      { label: '', render: (r) => <Thumb id={r.photoId} />, className: 'w-16' },
      { label: 'Name', render: (r) => <span className="font-medium text-brand-800">{r.fullName}</span> },
      { label: 'Roles', render: (r) => r.memberships?.map((m: any) => `${m.committee.name}: ${m.roleTitle}`).join(' · ') || '—', className: 'hidden text-xs text-slate-500 md:table-cell' },
    ],
    fields: [
      { type: 'text', name: 'fullName', label: 'Full name (with title)', required: true, help: 'e.g. Mr. Ahmed Raza' },
      { type: 'text', name: 'slug', label: 'URL slug', help: 'Leave empty to generate from the name' },
      { type: 'text', name: 'designation', label: 'Primary designation' },
      { type: 'text', name: 'tenure', label: 'Tenure', help: 'e.g. 2024 – 2027' },
      { type: 'text', name: 'profession', label: 'Profession' },
      { type: 'text', name: 'education', label: 'Education' },
      { type: 'date', name: 'appointmentDate', label: 'Appointment date' },
      { type: 'text', name: 'email', label: 'Email (not shown publicly)' },
      { type: 'image', name: 'photoId', label: 'Photograph' },
      { type: 'textarea', name: 'shortBio', label: 'Short biography', rows: 2 },
      { type: 'richtext', name: 'biography', label: 'Detailed biography' },
      { type: 'textarea', name: 'experience', label: 'Professional experience', rows: 3 },
      { type: 'stringList', name: 'responsibilities', label: 'Responsibilities', itemLabel: 'Responsibility' },
      { type: 'list', name: 'focusAreas', label: 'Focus areas', itemLabel: 'Focus area', max: 12, fields: [{ type: 'icon', name: 'icon', label: 'Icon' }, { type: 'text', name: 'label', label: 'Label', required: true }] },
      { type: 'list', name: 'affiliations', label: 'Affiliations', itemLabel: 'Affiliation', max: 20, fields: [{ type: 'text', name: 'name', label: 'Organisation', required: true }, { type: 'text', name: 'role', label: 'Role' }] },
      {
        type: 'list',
        name: 'socialLinks',
        label: 'Social profiles',
        itemLabel: 'Profile',
        max: 6,
        fields: [{ type: 'select', name: 'platform', label: 'Platform', required: true, options: opt(['linkedin', 'facebook', 'x', 'instagram', 'website'], { linkedin: 'LinkedIn', x: 'X (Twitter)' }) }, { type: 'link', name: 'url', label: 'URL', required: true }],
      },
      { type: 'boolean', name: 'isActive', label: 'Active' },
    ],
    sidebar: (item) => (
      <div className="card p-4 text-sm">
        <h3 className="mb-2 font-semibold text-slate-800">Roles on the website</h3>
        {!item.memberships?.length ? (
          <p className="text-slate-500">Not assigned to any committee yet — this person will not appear in any directory.</p>
        ) : (
          <ul className="space-y-1.5">
            {item.memberships.map((m: any) => (
              <li key={m.id}>
                <Link to={`/committees/${m.committee.slug}`} className="font-medium text-brand-800 hover:underline">{m.committee.name}</Link>
                <span className="block text-xs text-slate-500">{m.roleTitle}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    ),
  },
  messages: {
    module: 'messages',
    title: 'Leadership messages',
    singular: 'message',
    description: "Chairman's and Principal's messages. All messages use the same approved page design.",
    columns: [
      { label: 'Message', render: (r) => <span className="font-medium text-brand-800">{r.heading}</span> },
      { label: 'Key', render: (r) => r.key, className: 'hidden md:table-cell text-xs text-slate-500' },
    ],
    fields: [
      { type: 'person', name: 'personId', label: 'Message from', help: 'Portrait, name and role are taken from the person record' },
      { type: 'text', name: 'signatoryTitle', label: 'Signatory title', help: 'Shown under the signature' },
      { type: 'text', name: 'eyebrow', label: 'Eyebrow label', help: 'e.g. MESSAGE FROM THE CHAIRMAN' },
      { type: 'text', name: 'heading', label: 'Message heading', required: true },
      { type: 'text', name: 'salutation', label: 'Salutation', help: 'e.g. Dear Students, Parents and Well-wishers,' },
      { type: 'date', name: 'publicationDate', label: 'Publication date' },
      { type: 'textarea', name: 'excerpt', label: 'Teaser (overview pages)', rows: 2 },
      { type: 'textarea', name: 'quote', label: 'Highlighted quotation', rows: 3 },
      { type: 'richtext', name: 'body', label: 'Message', required: true },
      { type: 'image', name: 'signatureImageId', label: 'Signature image' },
      { type: 'document', name: 'pdfDocumentId', label: 'Downloadable PDF', help: 'Upload the PDF in Documents & Downloads first' },
    ],
  },
};

// ───────── List ─────────
export function ContentListPage({ def }: { def: ModuleDef }) {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: [def.module, 'list', def.filter, search, status, page],
    queryFn: () => api.get<Paged<any>>(`/admin/${def.module}${qs({ ...def.filter, search, status, page, pageSize: 20 })}`),
  });
  const nav = useNavigate();
  const base = useLocation().pathname.replace(/\/$/, '');
  return (
    <>
      <PageHeader
        title={def.title}
        description={def.description}
        actions={def.canCreate && can(`${def.module}.create`) && <Link to={`${base}/new`}><Button icon={<Plus className="h-4 w-4" />}>New {def.singular}</Button></Link>}
      />
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} />
          <select className="input w-48" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="LIVE">Live on website</option>
            <option value="DRAFT">Draft</option>
            <option value="IN_REVIEW">In review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <div className="p-4"><ErrorBox error={q.error} /></div>
        ) : !q.data?.items.length ? (
          <EmptyState title={`No ${def.title.toLowerCase()} found`} text={search || status ? 'Try a different search or filter.' : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {def.columns.map((c, i) => <th key={i} className={`th ${c.className ?? ''}`}>{c.label}</th>)}
                  <th className="th">Status</th>
                  <th className="th hidden lg:table-cell">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {q.data.items.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`${base}/${r.id}`)}>
                    {def.columns.map((c, i) => <td key={i} className={`td ${c.className ?? ''}`}>{c.render(r)}</td>)}
                    <td className="td"><StatusBadge status={r.status} isLive={r.isLive} hasPendingChanges={r.hasPendingChanges} scheduledPublishAt={r.scheduledPublishAt} /></td>
                    <td className="td hidden text-xs text-slate-500 lg:table-cell">{fmtDate(r.updatedAt, true)}{r.updatedByName ? ` · ${r.updatedByName}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.data && <Pagination {...q.data.pagination} onPage={setPage} />}
      </div>
    </>
  );
}

// ───────── Editor ─────────
const toLocalInput = (v?: string | null, withTime = true) => {
  if (!v) return '';
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
};

function PersonSelect({ value, onChange }: { value?: string | null; onChange: (v: string | null) => void }) {
  const q = useQuery({ queryKey: ['people', 'all'], queryFn: () => api.get<Paged<any>>(`/admin/people${qs({ pageSize: 100, sort: 'fullName', order: 'asc' })}`) });
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— Select a person —</option>
      {q.data?.items.map((p) => <option key={p.id} value={p.id}>{p.fullName}{p.designation ? ` — ${p.designation}` : ''}</option>)}
    </select>
  );
}

function AdminFieldControl({ field, value, onChange, errors }: { field: AdminField; value: any; onChange: (v: any) => void; errors: Record<string, string> }) {
  if (field.type === 'date' || field.type === 'datetime')
    return (
      <FormRow label={field.label} required={field.required} error={errors[field.name]} help={field.help}>
        <input
          type={field.type === 'date' ? 'date' : 'datetime-local'}
          className="input"
          value={toLocalInput(value, field.type === 'datetime')}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      </FormRow>
    );
  if (field.type === 'person')
    return (
      <FormRow label={field.label} error={errors[field.name]} help={field.help}>
        <PersonSelect value={value} onChange={onChange} />
      </FormRow>
    );
  if (field.type === 'document') return <DocumentSelect field={field} value={value} onChange={onChange} error={errors[field.name]} />;
  if (field.type === 'category') return <CategorySelect field={field} value={value} onChange={onChange} error={errors[field.name]} />;
  return <FieldControl field={field as Field} value={value} onChange={onChange} path={field.name} errors={errors} />;
}

export function CategorySelect({ field, value, onChange, error, byName = true }: { field: { label: string; scope: string; help?: string; required?: boolean }; value: any; onChange: (v: any) => void; error?: string; byName?: boolean }) {
  const q = useQuery({ queryKey: ['categories', field.scope], queryFn: () => api.get<Paged<any>>(`/admin/categories${qs({ scope: field.scope, pageSize: 100, sort: 'sortOrder', order: 'asc' })}`) });
  const opts = (q.data?.items ?? []).map((c) => ({ value: byName ? c.name : c.slug, label: c.name }));
  if (value && !opts.some((o) => o.value === value)) opts.push({ value, label: `${value} (not in list)` });
  return <SelectInput label={field.label} help={field.help ?? 'Manage the list under Website Content → Categories'} error={error} required={field.required} value={value} onChange={onChange} options={opts} />;
}

function DocumentSelect({ field, value, onChange, error }: { field: Field; value: any; onChange: (v: any) => void; error?: string }) {
  const q = useQuery({ queryKey: ['documents-all'], queryFn: () => api.get<Paged<any>>(`/admin/documents${qs({ pageSize: 100, sort: 'title', order: 'asc' })}`) });
  return (
    <SelectInput label={field.label} help={field.help} error={error} value={value} onChange={onChange} placeholder="— None —" options={(q.data?.items ?? []).map((d) => ({ value: d.id, label: d.title }))} />
  );
}

export function ContentEditorPage({ def }: { def: ModuleDef }) {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const base = useLocation().pathname.replace(/\/[^/]+$/, '');
  const q = useQuery({ queryKey: [def.module, id], queryFn: () => api.get(`/admin/${def.module}/${id}`), enabled: !isNew });
  const [form, setForm] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const names = def.fields.map((f) => f.name);
  const pick = (o: any) => Object.fromEntries(names.map((n) => [n, o?.[n] ?? null]));
  useEffect(() => {
    if (isNew) setForm({ ...pick({}), ...def.defaults });
    else if (q.data) setForm(pick(q.data));
  }, [q.data, isNew]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!form && (isNew || JSON.stringify(form) !== JSON.stringify(pick(q.data)));
  useUnsavedWarning(dirty && !saving);

  if (!form || (!isNew && q.isLoading)) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const item = q.data;
  const editable = isNew ? can(`${def.module}.create`) : item.canEdit;
  const titleOf = (o: any) => o.title ?? o.fullName ?? o.name ?? o.heading ?? '';

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]));
      for (const k of ['slug']) if (!body[k]) delete body[k];
      if (isNew) {
        const created = await api.post(`/admin/${def.module}`, body);
        toast(`${def.singular[0]!.toUpperCase()}${def.singular.slice(1)} created as a draft`);
        qc.invalidateQueries({ queryKey: [def.module] });
        nav(`${base}/${created.id}`, { replace: true });
      } else {
        await api.put(`/admin/${def.module}/${id}`, { ...body, expectedUpdatedAt: item.updatedAt });
        toast('Saved as draft. Submit it for review to publish.');
        await qc.invalidateQueries({ queryKey: [def.module] });
      }
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast(e instanceof ApiError && e.code === 'VALIDATION_ERROR' ? 'Please correct the highlighted fields' : (e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const archive = async () => {
    if (!(await confirm({ title: `Archive this ${def.singular}?`, text: 'It will be removed from the website and from lists. This is recorded in the audit log.', confirmLabel: 'Archive', danger: true }))) return;
    try {
      await api.del(`/admin/${def.module}/${id}`);
      toast('Archived');
      qc.invalidateQueries({ queryKey: [def.module] });
      nav(base);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const short = (f: AdminField) => ['text', 'link', 'icon', 'number', 'select', 'date', 'datetime', 'person', 'boolean'].includes(f.type);

  return (
    <>
      <PageHeader
        back={<Link to={base} className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> {def.title}</Link>}
        title={isNew ? `New ${def.singular}` : titleOf(item) || `Untitled ${def.singular}`}
        actions={
          <>
            {!isNew && can(`${def.module}.delete`) && def.module !== 'messages' && <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={archive}>Archive</Button>}
            {editable && <Button icon={<Save className="h-4 w-4" />} loading={saving} disabled={!dirty} onClick={save}>{isNew ? 'Create draft' : 'Save draft'}</Button>}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <fieldset disabled={!editable} className="min-w-0">
          <Section title="Details">
            <div className="grid gap-4 md:grid-cols-2">
              {def.fields.map((f) => (
                <div key={f.name} className={short(f) ? '' : 'md:col-span-2'}>
                  <AdminFieldControl field={f} value={form[f.name]} onChange={(v) => setForm({ ...form, [f.name]: v })} errors={errors} />
                </div>
              ))}
            </div>
          </Section>
        </fieldset>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {!editable && <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">You have read-only access to this item.</p>}
          {isNew ? (
            <p className="card p-4 text-sm text-slate-500">Create the draft first. You can then submit it for review and publish it.</p>
          ) : (
            <>
              <WorkflowPanel module={def.module} id={item.id} workflow={item.workflow} publicPath={item.publicPath} dirty={dirty} onChanged={() => qc.invalidateQueries({ queryKey: [def.module] })} />
              {def.sidebar?.(item)}
              <p className="px-1 text-xs text-slate-400">Created {fmtDate(item.createdAt, true)}{item.createdByName ? ` by ${item.createdByName}` : ''}<br />Last saved {fmtDate(item.updatedAt, true)}{item.updatedByName ? ` by ${item.updatedByName}` : ''}</p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

export const ICON_COUNT = ICON_NAMES.length;
export { MediaField };
