import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, FileText, FolderOpen, Images, Newspaper, PanelsTopLeft, Star, UserCircle, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, ErrorBox, fmtDate, Loading, PageHeader, Section, STATUS_LABEL } from '../components/ui';

/** Editor route for a workflow item (posts/stories editors work for every kind). */
const MODULE_ROUTE: Record<string, string> = { pages: '/pages', people: '/people', messages: '/messages', posts: '/posts/news', events: '/events', stories: '/stories/testimonials', faculty: '/faculty', results: '/results', vacancies: '/vacancies' };
export const itemLink = (module: string, id: string) => `${MODULE_ROUTE[module] ?? ''}/${id}`;

export function DashboardPage() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/admin/dashboard') });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  const cards = [
    { label: 'Pages', value: d.counts.pages, icon: PanelsTopLeft, to: '/pages' },
    { label: 'People', value: d.counts.people, icon: UserCircle, to: '/people' },
    { label: 'News & announcements', value: d.counts.posts, icon: Newspaper, to: '/posts/news' },
    { label: 'Events', value: d.counts.events, icon: CalendarDays, to: '/events' },
    { label: 'Stories & testimonials', value: d.counts.stories, icon: Star, to: '/stories/testimonials' },
    { label: 'Media files', value: d.counts.media, icon: Images, to: '/media' },
    { label: 'Documents', value: d.counts.documents, icon: FileText, to: '/documents' },
    { label: 'Galleries', value: d.counts.galleries, icon: FolderOpen, to: '/galleries' },
  ];
  return (
    <>
      <PageHeader title={`Welcome, ${user?.name.split(' ')[0]}`} description="Overview of website content, items awaiting review and recent activity." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Drafts', value: d.workflow.draft, tone: 'text-slate-700' },
          { label: 'Awaiting review', value: d.workflow.inReview, tone: 'text-amber-600' },
          { label: 'Approved / scheduled', value: d.workflow.approved, tone: 'text-blue-600' },
          { label: 'Rejected', value: d.workflow.rejected, tone: 'text-red-600' },
        ].map((s) => (
          <Link to="/workflow" key={s.label} className="card p-4 hover:border-brand-200">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-semibold ${s.tone}`}>{s.value}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Website statistics" description={`${d.editsLast7Days} content edits in the last 7 days · ${d.counts.users} active administrators`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {cards.map((c) => (
                <Link key={c.label} to={c.to} className="rounded-md border border-slate-100 bg-slate-50 p-3 hover:border-brand-200 hover:bg-white">
                  <c.icon className="h-5 w-5 text-gold-600" />
                  <p className="mt-2 text-2xl font-semibold text-slate-800">{c.value}</p>
                  <p className="text-xs text-slate-500">{c.label}</p>
                </Link>
              ))}
            </div>
          </Section>
          <Section title="Awaiting review" actions={<Link to="/workflow" className="text-sm text-brand-700 hover:underline">Approval queue →</Link>}>
            {!d.pending.length ? (
              <p className="text-sm text-slate-500">Nothing is waiting for review.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.pending.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link to={itemLink(p.module, p.id)} className="font-medium text-brand-800 hover:underline">{p.title}</Link>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <Badge>{p.entityType}</Badge> submitted {fmtDate(p.submittedAt ?? p.updatedAt, true)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <Section title="Recent updates">
          <ol className="space-y-3">
            {d.recentActivity.map((a: any) => (
              <li key={a.id} className="text-sm">
                <p className="text-slate-700">{a.summary ?? a.action}</p>
                <p className="text-xs text-slate-400">{a.user?.name ?? 'System'} · {fmtDate(a.createdAt, true)}</p>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </>
  );
}

export function WorkflowQueuePage() {
  const q = useQuery({ queryKey: ['queue'], queryFn: () => api.get('/admin/workflow/queue') });
  if (q.isLoading) return <Loading />;
  const Block = ({ title, items, empty }: { title: string; items: any[]; empty: string }) => (
    <Section title={`${title} (${items.length})`}>
      {!items.length ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span>
                <Link to={itemLink(p.module, p.id)} className="font-medium text-brand-800 hover:underline">{p.title}</Link>
                {p.reviewComment && <span className="block text-xs italic text-slate-500">“{p.reviewComment}”</span>}
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <Badge>{p.entityType}</Badge>
                <Badge tone={p.status === 'IN_REVIEW' ? 'amber' : p.status === 'REJECTED' ? 'red' : 'blue'}>{STATUS_LABEL[p.status]}</Badge>
                {p.scheduledPublishAt ? `goes live ${fmtDate(p.scheduledPublishAt, true)}` : `updated ${fmtDate(p.updatedAt, true)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
  return (
    <>
      <PageHeader title="Approval workflow" description="Draft → Submitted for review → Approved → Published. Open an item to review, approve, reject or publish it." />
      <div className="space-y-6">
        <Block title="Awaiting review" items={q.data.inReview} empty="Nothing is waiting for review." />
        <Block title="Approved & scheduled" items={q.data.approved} empty="No approved items waiting to be published." />
        <Block title="Rejected — needs changes" items={q.data.rejected} empty="No rejected items." />
      </div>
    </>
  );
}

export const UsersIcon = Users;
