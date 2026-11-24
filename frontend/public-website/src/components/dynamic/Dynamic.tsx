import Link from 'next/link';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { ArrowRight, BookOpen, Briefcase, CalendarDays, Clock, Download, Filter, Image as ImageIcon, LayoutGrid, List, MapPin, Search, Star, UserRound } from 'lucide-react';
import { api, qs, type MediaMap, type Site } from '@/lib/api';
import { fmtDate, fmtRange, fmtSize } from '@/lib/format';
import { Button, Card, CheckList, DocList, Empty, Heading, Icon, Img, Pager, SmartLink } from '../ui';
import { Field, FaqBrowser, SiteForm } from '../client';
import type { Ctx } from '../blocks/Blocks';

export type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const num = (v: string | string[] | undefined, d = 1) => Math.max(1, Number(one(v)) || d);

export interface DynProps {
  site: Site;
  page: any;
  extras: any;
  sp: SP;
  path: string;
  ctx: Ctx;
}

const link = (path: string, sp: SP, patch: Record<string, string | number | undefined>) => {
  const merged: Record<string, unknown> = { ...Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, one(v)])), ...patch };
  return path + qs(merged);
};

/** Search + dropdown filter bar (plain GET form — works without JavaScript). */
function FilterBar({ path, sp, placeholder, selects, button = 'Filter' }: { path: string; sp: SP; placeholder: string; selects?: { name: string; label: string; options: { value: string; label: string }[] }[]; button?: string }) {
  return (
    <form action={path} className="flex flex-wrap items-center gap-2" role="search">
      <label className="relative flex-1 sm:min-w-[220px]">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-primary-800" aria-hidden />
        <input name="search" defaultValue={one(sp.search)} placeholder={placeholder} className="w-full rounded-lg border border-primary-200 bg-white py-2 pl-9 pr-3 text-[13.5px] outline-none focus:border-primary-500" />
      </label>
      {selects?.map((s) => (
        <label key={s.name}>
          <span className="sr-only">{s.label}</span>
          <select name={s.name} defaultValue={one(sp[s.name])} className="rounded-lg border border-primary-200 bg-white px-3 py-2 font-serif text-[13.5px] font-bold text-primary-800 outline-none">
            <option value="">{s.label}</option>
            {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      ))}
      <button className="flex items-center gap-1.5 rounded-lg border-2 border-primary-200 bg-white px-4 py-2 font-serif text-[13.5px] font-bold text-primary-800 hover:border-primary-500">
        <Filter className="h-4 w-4" aria-hidden /> {button}
      </button>
    </form>
  );
}

function TitleBar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <h2 className="whitespace-nowrap font-serif text-[34px] font-bold leading-tight text-primary-800">{title}</h2>
        <span className="block h-[3px] w-24 rounded bg-gold-400" aria-hidden />
      </div>
      {children}
    </div>
  );
}

function CategoryTabs({ path, sp, categories, allLabel, param = 'category' }: { path: string; sp: SP; categories: { name: string; slug: string; icon: string | null }[]; allLabel: string; param?: string }) {
  const cur = one(sp[param]);
  return (
    <nav aria-label="Categories" className="mb-4 flex flex-wrap gap-2">
      {[{ name: allLabel, slug: '', icon: 'LayoutGrid' }, ...categories].map((c) => (
        <Link key={c.slug} href={link(path, sp, { [param]: c.slug || undefined, page: undefined })} aria-current={cur === c.slug ? 'page' : undefined} className={clsx('flex items-center gap-2 rounded-lg border px-3.5 py-2 font-serif text-[13.5px] font-bold', cur === c.slug ? 'border-primary-800 bg-gradient-to-b from-primary-700 to-primary-900 text-white' : 'border-primary-100 bg-cream-50 text-primary-800 hover:border-primary-300')}>
          <Icon name={c.icon} className={clsx('h-4 w-4', cur === c.slug ? 'text-white' : 'text-primary-800')} /> {c.name}
        </Link>
      ))}
    </nav>
  );
}

function NewsCard({ item, media, base, showCategory }: { item: any; media: MediaMap; base: string; showCategory?: boolean }) {
  return (
    <Link href={`${base}/${item.slug}`} className="group flex flex-col overflow-hidden rounded-xl border border-primary-100/70 bg-cream-50 shadow-card hover:shadow-lift">
      <div className="aspect-[16/8] overflow-hidden bg-primary-50">
        <Img id={item.featuredImageId} media={media} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 25vw" />
      </div>
      <div className="flex flex-1 items-end gap-2 p-3">
        <div className="flex-1">
          <p className="flex items-center gap-1.5 text-[12px] text-primary-900"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{fmtDate(item.publicationDate ?? item.startDate)}</p>
          <p className="mt-0.5 font-serif text-[15.5px] font-bold leading-tight text-primary-800">{item.title}</p>
          {showCategory && item.category && <span className="mt-1.5 inline-block rounded bg-primary-50 px-2 py-0.5 font-serif text-[11.5px] font-bold text-primary-800">{item.category}</span>}
          {item.location && <p className="mt-1 flex items-center gap-1 text-[12px] text-primary-900"><MapPin className="h-3.5 w-3.5" aria-hidden />{item.location}</p>}
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white"><ArrowRight className="h-4 w-4" aria-hidden /></span>
      </div>
    </Link>
  );
}

function Featured({ item, media, href, label, dateText, badge }: { item: any; media: MediaMap; href: string; label: string; dateText: string; badge?: string | null }) {
  return (
    <Card className="mb-4 grid gap-4 overflow-hidden p-2 md:grid-cols-[1.25fr_1fr]">
      <div className="relative overflow-hidden rounded-lg">
        <Img id={item.featuredImageId ?? item.coverImageId} media={media} className="aspect-[16/8.5] h-full w-full object-cover" priority />
        <span className="absolute left-3 top-3 rounded bg-primary-800 px-2.5 py-1 font-serif text-[12.5px] font-bold text-white">{label}</span>
      </div>
      <div className="flex flex-col justify-center px-2 pb-3 md:pr-6">
        <p className="flex items-center gap-1.5 text-[13px] text-primary-900"><CalendarDays className="h-4 w-4" aria-hidden />{dateText}</p>
        <h3 className="mt-1 font-serif text-[25px] font-bold leading-tight text-primary-800">{item.title}</h3>
        {badge && <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border-2 border-gold-400 px-3 py-0.5 font-serif text-sm font-bold text-gold-600">🏆 {badge}</span>}
        {(item.excerpt || item.description) && <p className="mt-2 text-[14px] leading-snug text-primary-900">{item.excerpt ?? item.description}</p>}
        <Button href={href} className="mt-4 w-fit px-5 py-2 text-[14px]">Read More</Button>
      </div>
    </Card>
  );
}

function RightCard({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <Heading icon={icon}>{title}</Heading>
      {children}
    </Card>
  );
}

function CategoryList({ path, categories, param = 'category' }: { path: string; categories: { name: string; slug: string; icon: string | null; count: number }[]; param?: string }) {
  return (
    <ul className="divide-y divide-primary-100">
      {categories.map((c) => (
        <li key={c.slug}>
          <Link href={`${path}?${param}=${c.slug}`} className="flex items-center gap-3 py-2 text-[14px] text-primary-900 hover:text-primary-600">
            <Icon name={c.icon} className="h-4 w-4 text-primary-800" />
            <span className="flex-1">{c.name}</span>
            <span>({c.count})</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────── News ─────────────────────────
async function NewsList({ path, sp, title }: DynProps & { title: string }) {
  const page = num(sp.page);
  const d = await api(`/posts${qs({ kind: 'news', page, pageSize: 6, category: one(sp.category), search: one(sp.search), year: one(sp.year) })}`);
  if (!d) return null;
  return (
    <div className="grid gap-5 2xl:grid-cols-[1fr_290px]">
      <div className="min-w-0">
        <TitleBar title={title}>
          <FilterBar path={path} sp={sp} placeholder="Search news by keyword…" selects={[{ name: 'category', label: 'All categories', options: d.categories.map((c: any) => ({ value: c.slug, label: c.name })) }]} />
        </TitleBar>
        {d.featured && <Featured item={d.featured} media={d.media} href={`/news-events/news/${d.featured.slug}`} label="Featured" dateText={fmtDate(d.featured.publicationDate)} />}
        {!d.items.length && !d.featured ? <Empty>No news matches your search.</Empty> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{d.items.map((n: any) => <NewsCard key={n.id} item={n} media={d.media} base="/news-events/news" />)}</div>
        )}
        <Pager page={page} totalPages={d.pagination.totalPages} href={(p) => link(path, sp, { page: p })} />
      </div>
      <aside className="space-y-5">
        <RightCard icon="FolderOpen" title="News Categories"><CategoryList path={path} categories={d.categories} /></RightCard>
        {d.popular.length > 0 && (
          <RightCard icon="ChartColumn" title="Popular News">
            <ul className="space-y-3">
              {d.popular.map((n: any) => (
                <li key={n.id}>
                  <Link href={`/news-events/news/${n.slug}`} className="flex gap-3">
                    <Img id={n.featuredImageId} media={d.media} className="h-16 w-20 shrink-0 rounded-md object-cover" sizes="80px" />
                    <span>
                      <span className="block font-serif text-[13.5px] font-bold leading-tight text-primary-800">{n.title}</span>
                      <span className="mt-1 flex items-center gap-1 text-[12px] text-primary-900"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{fmtDate(n.publicationDate)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </RightCard>
        )}
      </aside>
    </div>
  );
}

// ───────────────────────── Events ─────────────────────────
async function EventsList({ path, sp, title }: DynProps & { title: string }) {
  const tab = one(sp.tab) || 'all';
  const page = num(sp.page);
  const month = one(sp.month);
  const d = await api(`/events${qs({ when: tab === 'upcoming' || tab === 'past' ? tab : 'all', page, pageSize: tab === 'all' || tab === 'calendar' ? 4 : 8, category: one(sp.category), search: one(sp.search), year: one(sp.year), month })}`);
  if (!d) return null;
  const tabs = [['all', 'All Events', 'CalendarDays'], ['upcoming', 'Upcoming Events', 'Clock'], ['past', 'Past Events', 'CalendarCheck'], ['calendar', 'Events Calendar', 'CalendarDays']];
  const { year: y, month: m, events: monthEvents } = d.month;
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const today = new Date();
  const hasEvent = (day: number) => monthEvents.filter((e: any) => {
    const s = new Date(e.startDate), en = new Date(e.endDate ?? e.startDate);
    const t = Date.UTC(y, m - 1, day);
    return t >= Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) && t <= Date.UTC(en.getUTCFullYear(), en.getUTCMonth(), en.getUTCDate());
  });
  const mParam = (o: number) => { const dt = new Date(Date.UTC(y, m - 1 + o, 1)); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`; };
  const calendar = (
    <RightCard icon="CalendarDays" title="Events Calendar">
      <div className="mb-2 flex items-center justify-between">
        <Link href={link(path, sp, { month: mParam(-1) })} aria-label="Previous month" className="flex h-7 w-7 items-center justify-center rounded-full border border-primary-200 text-primary-800">‹</Link>
        <p className="font-serif text-[15px] font-bold text-primary-800">{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
        <Link href={link(path, sp, { month: mParam(1) })} aria-label="Next month" className="flex h-7 w-7 items-center justify-center rounded-full border border-primary-200 text-primary-800">›</Link>
      </div>
      <table className="w-full text-center text-[13px]">
        <thead className="bg-primary-800 text-white"><tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <th key={d} className="py-1.5 font-semibold">{d}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: Math.ceil((lead + days) / 7) }, (_, w) => (
            <tr key={w}>
              {Array.from({ length: 7 }, (_, i) => {
                const day = w * 7 + i - lead + 1;
                if (day < 1 || day > days) return <td key={i} />;
                const evs = hasEvent(day);
                const isToday = today.getFullYear() === y && today.getMonth() + 1 === m && today.getDate() === day;
                return (
                  <td key={i} className="py-0.5">
                    {evs.length ? (
                      <Link href={`/news-events/events/${evs[0].slug}`} title={evs.map((e: any) => e.title).join(', ')} className={clsx('relative mx-auto flex h-8 w-8 items-center justify-center rounded font-bold', isToday ? 'bg-primary-800 text-white' : 'bg-gold-100 text-primary-900')}>
                        {day}<span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary-800" aria-hidden />
                      </Link>
                    ) : (
                      <span className={clsx('mx-auto flex h-8 w-8 items-center justify-center rounded', isToday ? 'bg-primary-800 font-bold text-white' : 'text-primary-900')}>{day}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </RightCard>
  );
  const grid = (list: any[]) => <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{list.map((e) => <NewsCard key={e.id} item={{ ...e, publicationDate: e.startDate }} media={d.media} base="/news-events/events" />)}</div>;
  return (
    <div className="grid gap-5 2xl:grid-cols-[1fr_330px]">
      <div className="min-w-0">
        <TitleBar title={title}>
          <FilterBar path={path} sp={sp} placeholder="Search events…" selects={[{ name: 'category', label: 'All Categories', options: d.categories.map((c: any) => ({ value: c.slug, label: c.name })) }, { name: 'year', label: 'All years', options: d.years.map((y: number) => ({ value: String(y), label: String(y) })) }]} />
        </TitleBar>
        <nav aria-label="Event views" className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {tabs.map(([k, l, ic]) => (
            <Link key={k} href={link(path, sp, { tab: k === 'all' ? undefined : k, page: undefined })} aria-current={tab === k ? 'page' : undefined} className={clsx('flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 font-serif text-[14px] font-bold', tab === k ? 'border-primary-800 bg-gradient-to-b from-primary-700 to-primary-900 text-white' : 'border-primary-100 bg-cream-50 text-primary-800')}>
              <Icon name={ic} className={clsx('h-5 w-5', tab === k ? 'text-white' : 'text-primary-800')} /> {l}
            </Link>
          ))}
        </nav>
        {tab === 'calendar' ? <div className="max-w-xl">{calendar}</div> : (
          <div className="space-y-6">
            {tab === 'all' && d.featured && <Featured item={d.featured} media={d.media} href={`/news-events/events/${d.featured.slug}`} label="Featured Event" dateText={fmtRange(d.featured.startDate, d.featured.endDate)} />}
            {tab !== 'past' && (
              <section>
                <Heading icon="Clock" action={tab === 'all' ? <Link href={link(path, sp, { tab: 'upcoming' })} className="font-serif text-[13.5px] font-bold text-primary-800">View All Upcoming →</Link> : undefined}>Upcoming Events</Heading>
                {d.upcoming.length ? grid(d.upcoming) : <Empty>No upcoming events at the moment.</Empty>}
                {tab === 'upcoming' && <Pager page={page} totalPages={d.pagination.upcoming.totalPages} href={(p) => link(path, sp, { page: p })} />}
              </section>
            )}
            {tab !== 'upcoming' && (
              <section>
                <Heading icon="Clock" action={tab === 'all' ? <Link href={link(path, sp, { tab: 'past' })} className="font-serif text-[13.5px] font-bold text-primary-800">View All Past Events →</Link> : undefined}>Past Events</Heading>
                {d.past.length ? grid(d.past) : <Empty>No past events.</Empty>}
                {tab === 'past' && <Pager page={page} totalPages={d.pagination.past.totalPages} href={(p) => link(path, sp, { page: p })} />}
              </section>
            )}
          </div>
        )}
      </div>
      <aside className="space-y-5">
        {tab !== 'calendar' && calendar}
        <RightCard icon="Layers" title="Event Categories">
          <div className="flex flex-wrap gap-2">
            {d.categories.map((c: any) => (
              <Link key={c.slug} href={link(path, sp, { category: c.slug })} className="flex items-center gap-1.5 rounded-full border border-primary-100 bg-white px-3 py-1.5 font-serif text-[12.5px] font-bold text-primary-800 hover:border-primary-400">
                <Icon name={c.icon} className="h-4 w-4 text-primary-800" /> {c.name}
              </Link>
            ))}
          </div>
        </RightCard>
        {d.highlights.length > 0 && (
          <RightCard icon="Star" title="Upcoming Highlights">
            <ul className="divide-y divide-primary-100">
              {d.highlights.map((e: any) => (
                <li key={e.id}>
                  <Link href={`/news-events/events/${e.slug}`} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-primary-100 bg-cream-100 font-serif font-bold leading-none text-primary-800">
                      <span className="text-[22px]">{fmtDate(e.startDate, { day: '2-digit' })}</span>
                      <span className="text-[13px]">{fmtDate(e.startDate, { month: 'short' })}</span>
                    </span>
                    <span className="flex-1">
                      <span className="block font-serif text-[14px] font-bold text-primary-800">{e.title}</span>
                      {e.location && <span className="flex items-center gap-1 text-[12.5px] text-primary-900"><MapPin className="h-3.5 w-3.5" aria-hidden />{e.location}</span>}
                    </span>
                    <ArrowRight className="h-4 w-4 text-primary-800" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </RightCard>
        )}
      </aside>
    </div>
  );
}

// ───────────────────────── Announcements ─────────────────────────
async function Announcements({ path, sp, title }: DynProps & { title: string }) {
  const page = num(sp.page);
  const d = await api(`/posts${qs({ kind: 'announcements', page, pageSize: 5, category: one(sp.category), search: one(sp.search), year: one(sp.year) })}`);
  if (!d) return null;
  const list = [...(d.featured ? [d.featured] : []), ...d.items];
  const iconFor = (cat: string) => d.categories.find((c: any) => c.name.toLowerCase() === (cat ?? '').toLowerCase())?.icon ?? 'Megaphone';
  return (
    <div className="grid gap-5 2xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <TitleBar title={title}><FilterBar path={path} sp={sp} placeholder="Search announcements…" /></TitleBar>
        <CategoryTabs path={path} sp={sp} categories={d.categories} allLabel="All Announcements" />
        {!list.length ? <Empty>No announcements found.</Empty> : (
          <ul className="space-y-2.5">
            {list.map((a: any) => (
              <li key={a.id}>
                <Link href={`/news-events/announcements/${a.slug}`} className={clsx('flex items-center gap-4 rounded-xl border bg-white p-3 shadow-card hover:shadow-lift', a.isFeatured && d.featured?.id === a.id ? 'border-l-4 border-gold-400' : 'border-primary-100')}>
                  <span className="hidden h-16 w-20 shrink-0 items-center justify-center rounded-lg bg-primary-50 sm:flex"><Icon name={a.id === d.featured?.id ? 'Megaphone' : iconFor(a.category)} className="h-9 w-9 text-primary-800" strokeWidth={1.4} /></span>
                  <span className="flex-1">
                    {a.id === d.featured?.id && <span className="mb-0.5 inline-block rounded bg-gold-300 px-2 py-0.5 text-[11px] font-bold text-primary-900">Featured</span>}
                    <span className="block font-serif text-[17px] font-bold text-primary-800">{a.title}</span>
                    {a.excerpt && <span className="block text-[13.5px] leading-snug text-primary-900">{a.excerpt}</span>}
                  </span>
                  <span className="hidden shrink-0 flex-col items-center gap-1.5 text-[13px] text-primary-900 md:flex">
                    <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden />{fmtDate(a.publicationDate)}</span>
                    {a.category && <span className="rounded bg-primary-100 px-3 py-1 font-serif text-[12px] font-bold text-primary-800">{a.category}</span>}
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-primary-800" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} totalPages={d.pagination.totalPages} href={(p) => link(path, sp, { page: p })} />
      </div>
      <aside className="space-y-5">
        {d.recent.length > 0 && (
          <RightCard icon="Bell" title="Important Notices">
            <ul className="space-y-2">
              {d.recent.map((a: any) => (
                <li key={a.id}><Link href={`/news-events/announcements/${a.slug}`} className="flex items-center gap-2 text-[13.5px] text-primary-900 hover:text-primary-600"><span className="rounded bg-gold-300 px-1.5 py-0.5 text-[11px] font-bold">New</span><span className="flex-1">{a.title}</span>›</Link></li>
              ))}
            </ul>
          </RightCard>
        )}
        <RightCard icon="FolderOpen" title="Announcement Archive">
          <form action={path} className="space-y-2.5">
            <select name="year" defaultValue={one(sp.year)} aria-label="Select year" className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-[14px]"><option value="">Select Year</option>{d.years.map((y: number) => <option key={y}>{y}</option>)}</select>
            <select name="category" defaultValue={one(sp.category)} aria-label="Select category" className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-[14px]"><option value="">Select Category</option>{d.categories.map((c: any) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
            <button className="w-full rounded-lg bg-gradient-to-b from-primary-700 to-primary-900 py-2.5 font-serif text-[14px] font-bold text-white">View Archive →</button>
          </form>
        </RightCard>
      </aside>
    </div>
  );
}

// ───────────────────────── Achievements ─────────────────────────
function AchievementCard({ a, media }: { a: any; media: MediaMap }) {
  return (
    <Link href={`/news-events/achievements/${a.slug}`} className="group flex flex-col overflow-hidden rounded-xl border border-primary-100/70 bg-cream-50 shadow-card hover:shadow-lift">
      <Img id={a.featuredImageId} media={media} className="aspect-[16/8] w-full object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
      <div className="flex flex-1 flex-col p-3">
        <p className="flex items-center gap-1.5 text-[12px] text-primary-900"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{fmtDate(a.publicationDate)}</p>
        <p className="flex-1 font-serif text-[14.5px] font-bold leading-tight text-primary-800">{a.title}</p>
        <div className="mt-2 flex items-center justify-between">
          {a.category && <span className="rounded bg-primary-50 px-2 py-0.5 font-serif text-[11.5px] font-bold text-primary-800">{a.category}</span>}
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-800 text-white"><ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
        </div>
      </div>
    </Link>
  );
}

async function Achievements({ path, sp, title, site }: DynProps & { title: string }) {
  const page = num(sp.page);
  const d = await api(`/posts${qs({ kind: 'achievements', page, pageSize: 8, category: one(sp.category), search: one(sp.search) })}`);
  const stats = await api(`/statistics?group=achievements`);
  if (!d) return null;
  return (
    <div className="grid gap-5 2xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <TitleBar title={title}><FilterBar path={path} sp={sp} placeholder="Search achievements…" /></TitleBar>
        <CategoryTabs path={path} sp={sp} categories={d.categories} allLabel="All Achievements" />
        {d.featured && <Featured item={d.featured} media={d.media} href={`/news-events/achievements/${d.featured.slug}`} label="Featured Achievement" dateText={fmtDate(d.featured.publicationDate)} badge={d.featured.badge} />}
        <Heading icon="Medal">Latest Achievements</Heading>
        {!d.items.length ? <Empty>No achievements found.</Empty> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{d.items.map((a: any) => <AchievementCard key={a.id} a={a} media={d.media} />)}</div>}
        <Pager page={page} totalPages={d.pagination.totalPages} href={(p) => link(path, sp, { page: p })} />
      </div>
      <aside className="space-y-5">
        <RightCard icon="ChartColumn" title="Achievements at a Glance">
          <div className="grid grid-cols-2 gap-3">
            {(stats?.items.length ? stats.items : d.categories.slice(0, 4).map((c: any) => ({ label: c.name, value: c.count, icon: c.icon }))).map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2"><Icon name={s.icon} className="h-8 w-8 text-gold-500" /><span><span className="block font-serif text-[22px] font-bold leading-none text-primary-800">{s.value}</span><span className="text-[12.5px] text-primary-900">{s.label}</span></span></div>
            ))}
          </div>
        </RightCard>
        <RightCard icon="Award" title="Recent Honors">
          <ul className="space-y-2">{[...new Map([...d.popular, ...d.items].map((x: any) => [x.id, x])).values()].slice(0, 5).map((a: any) => <li key={a.id} className="flex gap-2 text-[13.5px] text-primary-900"><Icon name="Trophy" className="h-4 w-4 text-gold-500" />{a.title}</li>)}</ul>
        </RightCard>
        <Card className="p-5 text-center">
          <Heading icon="Star">Nominate an Achievement</Heading>
          <p className="mb-3 text-[14px] text-primary-900">Share a student or team achievement to be featured on our website.</p>
          <SiteForm endpoint="nomination" submitLabel="Submit Achievement" className="space-y-3 text-left">
            <Field name="name" label="Your name" required />
            <Field name="email" label="Email" type="email" required />
            <Field name="studentName" label="Student / team" required />
            <Field name="title" label="Achievement" required />
            <Field name="message" label="Details" textarea maxLength={1000} required />
          </SiteForm>
        </Card>
      </aside>
    </div>
  );
}

// ───────────────────────── Gallery ─────────────────────────
async function GalleryList({ path, sp, title }: DynProps & { title: string }) {
  const page = num(sp.page);
  const d = await api(`/galleries${qs({ page, pageSize: 8, category: one(sp.category), search: one(sp.search), year: one(sp.year) })}`);
  if (!d) return null;
  const f = d.featured;
  return (
    <div className="grid gap-5 2xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <TitleBar title={title}>
          <FilterBar path={path} sp={sp} placeholder="Search photos or albums…" selects={[{ name: 'year', label: 'All Years', options: d.years.map((y: number) => ({ value: String(y), label: String(y) })) }]} />
        </TitleBar>
        <CategoryTabs path={path} sp={sp} categories={d.categories} allLabel="All Media" />
        {f && !one(sp.category) && page === 1 && (
          <Card className="mb-5 grid gap-4 overflow-hidden p-2 md:grid-cols-[1.4fr_1fr]">
            <div className="relative overflow-hidden rounded-lg">
              <Img id={f.coverImageId} media={d.media} className="aspect-[16/7] h-full w-full object-cover" priority />
              <span className="absolute left-3 top-3 rounded bg-primary-800 px-2.5 py-1 font-serif text-[12.5px] font-bold text-white">Featured Album</span>
            </div>
            <div className="flex flex-col justify-center px-2 pb-3">
              <h3 className="flex items-center gap-2 font-serif text-[24px] font-bold text-primary-800"><ImageIcon className="h-7 w-7" aria-hidden />{f.title}</h3>
              <p className="mt-1 flex gap-5 text-[13px] text-primary-900"><span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden />{fmtDate(f.eventDate)}</span><span>{f.imageCount} Photos</span></p>
              {f.description && <p className="mt-2 text-[14px] text-primary-900">{f.description}</p>}
              <Button href={`/news-events/gallery/${f.slug}`} className="mt-4 w-fit px-5 py-2 text-[14px]">View Album</Button>
            </div>
          </Card>
        )}
        <Heading icon="Image">Photo Albums</Heading>
        {!d.items.length ? <Empty>No albums found.</Empty> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {d.items.map((g: any) => (
              <Link key={g.id} href={`/news-events/gallery/${g.slug}`} className="group overflow-hidden rounded-xl border border-primary-100/70 bg-cream-50 shadow-card hover:shadow-lift">
                <div className="relative">
                  <Img id={g.coverImageId} media={d.media} className="aspect-[16/8.5] w-full object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                  <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-primary-900/85 px-1.5 py-0.5 text-[11.5px] font-bold text-white"><ImageIcon className="h-3.5 w-3.5" aria-hidden />{g.imageCount}</span>
                </div>
                <div className="p-3">
                  <p className="font-serif text-[14.5px] font-bold leading-tight text-primary-800">{g.title}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-[12px] text-primary-900"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{fmtDate(g.eventDate)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
        <Pager page={page} totalPages={d.pagination.totalPages} href={(p) => link(path, sp, { page: p })} />
      </div>
      <aside className="space-y-5">
        <RightCard icon="ChartColumn" title="Gallery Highlights">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Image', d.stats.albums, 'Albums'], ['Images', d.stats.photos, 'Photos'], ['PlayCircle', d.stats.videos, 'Videos']].map(([ic, v, l]) => (
              <div key={l as string} className="rounded-lg border border-primary-100 bg-white py-3"><Icon name={ic as string} className="mx-auto h-7 w-7 text-primary-800" /><p className="font-serif text-[22px] font-bold text-primary-800">{v as number}</p><p className="text-[12.5px] text-primary-900">{l as string}</p></div>
            ))}
          </div>
        </RightCard>
        {d.videos.length > 0 && (
          <RightCard icon="PlayCircle" title="Featured Videos">
            {d.videos.slice(0, 1).map((vd: any, i: number) => (
              <SmartLink key={i} href={vd.url || undefined} className="block">
                <span className="relative block overflow-hidden rounded-lg">
                  <Img id={vd.thumbnailId} media={d.media} className="aspect-video w-full object-cover" />
                  {vd.duration && <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 text-[12px] text-white">{vd.duration}</span>}
                </span>
                <span className="mt-2 block font-serif text-[14.5px] font-bold text-primary-800">{vd.title}</span>
                {!vd.url && <span className="text-[12px] text-primary-900/70">Video coming soon</span>}
              </SmartLink>
            ))}
          </RightCard>
        )}
        <RightCard icon="CalendarDays" title="Annual Gallery">
          <form action={path} className="space-y-2.5">
            <select name="year" defaultValue={one(sp.year)} aria-label="Select year" className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-[14px]"><option value="">Select Year</option>{d.years.map((y: number) => <option key={y}>{y}</option>)}</select>
            <button className="w-full rounded-lg bg-gradient-to-b from-primary-700 to-primary-900 py-2.5 font-serif text-[14px] font-bold text-white">View Gallery →</button>
          </form>
        </RightCard>
      </aside>
    </div>
  );
}

// ───────────────────────── Downloads ─────────────────────────
async function Downloads({ path, sp, title, site }: DynProps & { title: string }) {
  const page = num(sp.page);
  const d = await api(`/documents${qs({ page, category: one(sp.category), search: one(sp.search), year: one(sp.year) })}`);
  if (!d) return null;
  const catName = (slug: string) => d.categories.find((c: any) => c.slug === slug)?.name ?? slug;
  const sidebar = (
    <aside className="space-y-5">
      <Card className="p-2">
        <p className="flex items-center gap-3 px-3 pb-2 pt-3 font-serif text-[21px] font-bold text-primary-800"><Icon name="FolderOpen" className="h-8 w-8 text-primary-800" /> Categories</p>
        <ul>
          {[{ name: 'All Downloads', slug: '', icon: 'Layers' }, ...d.categories].map((c: any) => {
            const on = one(sp.category) === c.slug;
            return (
              <li key={c.slug}>
                <Link href={link(path, {}, { category: c.slug || undefined })} aria-current={on ? 'page' : undefined} className={clsx('flex items-center gap-3 rounded-lg px-3 py-2.5 font-serif text-[15px] font-bold', on ? 'bg-gradient-to-r from-primary-900 to-primary-700 text-white' : 'text-primary-800 hover:bg-primary-50')}>
                  <Icon name={c.icon} className={clsx('h-6 w-6', on ? 'text-gold-300' : 'text-primary-800')} /><span className="flex-1">{c.name}</span>›
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </aside>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
      <div className="order-2 space-y-5 lg:order-1">{sidebar}{(page === 1) && null}</div>
      <div className="order-1 min-w-0 lg:order-2">
        <TitleBar title={title}>
          <FilterBar path={path} sp={sp} placeholder="Search downloads…" button="Search" selects={[{ name: 'category', label: 'All Categories', options: d.categories.map((c: any) => ({ value: c.slug, label: c.name })) }, { name: 'year', label: 'All Years', options: d.years.map((y: number) => ({ value: String(y), label: String(y) })) }]} />
        </TitleBar>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {d.categories.slice(0, 5).map((c: any) => (
            <Link key={c.slug} href={link(path, {}, { category: c.slug })} className="flex flex-col items-center rounded-xl border border-primary-100/70 bg-cream-50 px-3 py-5 text-center shadow-card hover:shadow-lift">
              <Icon name={c.icon} className="h-11 w-11 text-primary-800" strokeWidth={1.4} />
              <span className="mt-2 font-serif text-[16px] font-bold leading-tight text-primary-800">{c.name}</span>
            </Link>
          ))}
        </div>
        <Heading icon="BookMarked">{one(sp.category) ? catName(one(sp.category)) : 'Latest Downloads'}</Heading>
        {!d.items.length ? <Empty>No documents found.</Empty> : (
          <div className="overflow-x-auto rounded-xl border border-primary-100 bg-white shadow-card">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead className="bg-primary-50 text-left font-serif text-primary-800"><tr><th className="px-4 py-2.5">Title</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5">File Type</th><th className="px-4 py-2.5">Size</th><th className="px-4 py-2.5">Updated On</th><th className="px-4 py-2.5">Download</th></tr></thead>
              <tbody className="divide-y divide-primary-100">
                {d.items.map((doc: any) => (
                  <tr key={doc.id}>
                    <td className="px-4 py-2.5"><span className="flex items-center gap-3"><span className={clsx('rounded px-1 py-0.5 text-[9px] font-bold text-white', doc.fileType === 'XLSX' ? 'bg-emerald-600' : 'bg-red-600')}>{doc.fileType}</span><span className="text-primary-900">{doc.title}</span></span></td>
                    <td className="px-4 py-2.5"><span className="rounded bg-primary-50 px-2 py-1 font-serif text-[12px] font-bold text-primary-800">{catName(doc.category)}</span></td>
                    <td className="px-4 py-2.5 text-primary-900">{doc.fileType}</td>
                    <td className="px-4 py-2.5 text-primary-900">{fmtSize(doc.size)}</td>
                    <td className="px-4 py-2.5 text-primary-900">{fmtDate(doc.updatedAt)}</td>
                    <td className="px-4 py-2.5"><a href={doc.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border-2 border-primary-200 px-3 py-1 font-serif text-[13px] font-bold text-primary-800 hover:border-primary-500"><Download className="h-4 w-4" aria-hidden />Download<span className="sr-only"> {doc.title}</span></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} totalPages={d.pagination.totalPages} href={(p) => link(path, sp, { page: p })} />
      </div>
    </div>
  );
}

// ───────────────────────── Faculty ─────────────────────────
function FacultyCard({ f, media, compact }: { f: any; media: MediaMap; compact?: boolean }) {
  return (
    <div className="flex flex-col items-center overflow-hidden rounded-xl border border-primary-100/70 bg-cream-50 pb-3 text-center shadow-card">
      <div className="h-[110px] w-full bg-gradient-to-b from-primary-50 to-white"><Img id={f.photoId} media={media} className="mx-auto h-full w-auto object-contain" sizes="200px" alt={`Portrait of ${f.fullName}`} /></div>
      <p className="mt-2 px-2 font-serif text-[15px] font-bold leading-tight text-primary-800">{f.fullName}</p>
      <p className="text-[12.5px] text-primary-900/80">{f.designation}</p>
      {f.subject && <p className="mt-1.5 flex items-center gap-1 text-[12.5px] text-primary-900"><BookOpen className="h-3.5 w-3.5" aria-hidden />{f.subject}</p>}
      {!compact && f.experience && <p className="flex items-center gap-1 text-[12.5px] text-primary-900"><UserRound className="h-3.5 w-3.5" aria-hidden />{f.experience}</p>}
      <Button href={`/academics/faculty/${f.slug}`} className="mt-2 px-3 py-1 text-[12.5px]">View Profile</Button>
    </div>
  );
}

function FacultyFeatured({ extras, ctx }: DynProps) {
  const list = extras?.faculty ?? [];
  const f = extras?.filters ?? { departments: [], programmes: [] };
  return (
    <section>
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center">
        <Heading icon="UsersRound" className="mb-0 shrink-0">Meet Our Faculty</Heading>
        <form action="/academics/faculty/directory" className="flex flex-1 flex-wrap gap-2" role="search">
          <input name="search" placeholder="Search by name, subject or keyword…" aria-label="Search faculty" className="min-w-[180px] flex-1 rounded-full border border-primary-200 bg-white px-4 py-1.5 text-[13px]" />
          <select name="department" aria-label="Department" className="rounded-full border border-primary-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-primary-800"><option value="">All Departments</option>{f.departments.map((d: string) => <option key={d}>{d}</option>)}</select>
          <select name="programme" aria-label="Programme" className="rounded-full border border-primary-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-primary-800"><option value="">All Programmes</option>{f.programmes.map((d: string) => <option key={d}>{d}</option>)}</select>
          <button className="flex items-center gap-1 rounded-full bg-primary-800 px-5 py-1.5 font-serif text-[13px] font-bold text-white"><Search className="h-4 w-4" aria-hidden />Search</button>
        </form>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(5,1fr)_minmax(0,1.2fr)]">
        {list.map((x: any) => <FacultyCard key={x.id} f={x} media={ctx.media} compact />)}
        <Link href="/academics/faculty/directory" className="col-span-2 flex items-center gap-3 self-center rounded-xl border-2 border-primary-200 bg-white p-4 shadow-card sm:col-span-1 hover:border-primary-500">
          <Icon name="UsersRound" className="h-10 w-10 text-primary-800" />
          <span className="flex-1"><span className="block font-serif text-[17px] font-bold text-primary-800">View Faculty Directory</span><span className="text-[12.5px] text-primary-900">Browse all faculty members by department and programme.</span></span>
          <ArrowRight className="h-5 w-5 text-primary-800" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

async function FacultyDirectory({ path, sp }: DynProps) {
  const page = num(sp.page);
  const view = one(sp.view) === 'list' ? 'list' : 'grid';
  const d = await api(`/faculty${qs({ page, search: one(sp.search), department: one(sp.department), programme: one(sp.programme), designation: one(sp.designation), sort: one(sp.sort) || undefined })}`);
  if (!d) return null;
  const { pagination: p, filters: f } = d;
  return (
    <section>
      <form action={path} className="mb-3 flex flex-wrap gap-2" role="search">
        <input name="search" defaultValue={one(sp.search)} placeholder="Search by name, subject or keyword…" aria-label="Search faculty" className="min-w-[220px] flex-1 rounded-full border border-primary-200 bg-white px-4 py-2 text-[14px]" />
        {([['department', 'All Departments', f.departments], ['programme', 'All Programmes', f.programmes], ['designation', 'All Designations', f.designations]] as const).map(([n, l, opts]) => (
          <select key={n} name={n} defaultValue={one(sp[n])} aria-label={l} className="rounded-full border border-primary-200 bg-white px-3 py-2 font-serif text-[13.5px] font-bold text-primary-800"><option value="">{l}</option>{opts.map((o: string) => <option key={o}>{o}</option>)}</select>
        ))}
        <button className="flex items-center gap-1.5 rounded-full bg-primary-800 px-6 py-2 font-serif text-[14px] font-bold text-white"><Search className="h-4 w-4" aria-hidden />Search</button>
      </form>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-t border-primary-100 pt-3 text-[13.5px] text-primary-900">
        <p>Showing {p.total ? (p.page - 1) * p.pageSize + 1 : 0} – {Math.min(p.total, p.page * p.pageSize)} of {p.total} faculty members</p>
        <div className="flex items-center gap-2">
          <span>Sort by:</span>
          {[['name', 'Name (A – Z)'], ['name-desc', 'Name (Z – A)']].map(([k, l]) => <Link key={k} href={link(path, sp, { sort: k })} className={clsx('rounded-full border px-3 py-1', (one(sp.sort) || 'name') === k ? 'border-primary-800 font-bold text-primary-800' : 'border-primary-100')}>{l}</Link>)}
          <Link aria-label="Grid view" href={link(path, sp, { view: undefined })} className={clsx('rounded p-1.5', view === 'grid' ? 'bg-primary-800 text-white' : 'border border-primary-100 text-primary-800')}><LayoutGrid className="h-4 w-4" /></Link>
          <Link aria-label="List view" href={link(path, sp, { view: 'list' })} className={clsx('rounded p-1.5', view === 'list' ? 'bg-primary-800 text-white' : 'border border-primary-100 text-primary-800')}><List className="h-4 w-4" /></Link>
        </div>
      </div>
      {!d.items.length ? <Empty>No faculty members match your search.</Empty> : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{d.items.map((x: any) => <FacultyCard key={x.id} f={x} media={d.media} />)}</div>
      ) : (
        <ul className="divide-y divide-primary-100 rounded-xl border border-primary-100 bg-white">
          {d.items.map((x: any) => (
            <li key={x.id} className="flex items-center gap-4 p-3">
              <Img id={x.photoId} media={d.media} className="h-14 w-14 rounded-full object-cover" sizes="56px" alt="" />
              <span className="flex-1"><span className="block font-serif font-bold text-primary-800">{x.fullName}</span><span className="text-[13px] text-primary-900">{[x.designation, x.subject, x.experience].filter(Boolean).join(' · ')}</span></span>
              <Button href={`/academics/faculty/${x.slug}`} className="px-3 py-1 text-[13px]">View Profile</Button>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} totalPages={p.totalPages} href={(n) => link(path, sp, { page: n })} />
    </section>
  );
}

// ───────────────────────── Results ─────────────────────────
function ResultBadge({ r }: { r: any }) {
  return (
    <div className="flex items-center justify-center bg-gradient-to-br from-primary-800 to-primary-950 px-5 py-4 text-center font-serif text-gold-400">
      <span className="text-3xl" aria-hidden>❦</span>
      <span className="mx-1"><span className="block text-[15px] font-bold leading-tight">{r.examination}</span><span className="block text-[13px]">Board Results</span><span className="block text-[26px] font-bold leading-none">{r.year}</span></span>
      <span className="-scale-x-100 text-3xl" aria-hidden>❦</span>
    </div>
  );
}

function ResultsSummary({ extras, ctx }: DynProps) {
  const r = extras?.result;
  if (!r) return null;
  const s = r.summary ?? {};
  const AA = '/academics/academic-achievements';
  return (
    <section className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Achievements">
        {[['Trophy', 'Board Examination Results', `${AA}/board-results`], ['Award', 'National Achievements', `${AA}/national-achievements`], ['Globe', 'International Achievements', `${AA}/international-achievements`], ['BookOpen', 'Subject Excellence', `${AA}/subject-excellence`], ['ChartColumn', 'Year-wise Highlights', `${AA}/year-wise-highlights`]].map(([ic, l, h], i) => (
          <Link key={h} href={h!} className={clsx('flex items-center gap-2 rounded-full border px-4 py-2 font-serif text-[13.5px] font-bold', i === 0 ? 'border-primary-800 bg-primary-800 text-white' : 'border-primary-100 bg-white text-primary-800')}><Icon name={ic} className={clsx('h-4 w-4', i === 0 ? 'text-gold-300' : 'text-primary-800')} />{l}</Link>
        ))}
      </nav>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="flex overflow-hidden rounded-xl border border-primary-100 bg-cream-50 shadow-card">
          <ResultBadge r={r} />
          <div className="grid flex-1 grid-cols-3 divide-x divide-primary-100 py-3 text-center">
            {[[s.aRate, 'A & A+ Grades'], [s.distinctions, 'Subject Distinctions'], [s.position, 'District Position']].map(([v, l]) => <div key={l} className="px-2"><p className="font-serif text-[26px] font-bold text-primary-800">{v}</p><p className="text-[13px] font-semibold text-primary-900">{l}</p></div>)}
          </div>
        </div>
        <Link href={`${AA}/detailed-results`} className="flex items-center justify-center gap-2 self-center rounded-full border-2 border-primary-300 bg-white px-4 py-3 font-serif text-[14px] font-bold text-primary-800 hover:border-primary-600"><Icon name="FileText" className="h-5 w-5 text-primary-800" />View Detailed Results →</Link>
      </div>
      <Heading icon="Award" action={<Link href={`${AA}/high-achievers`} className="font-serif text-[13px] font-bold text-primary-800">View All Achievers →</Link>}>Our High Achievers</Heading>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(r.achievers ?? []).slice(0, 4).map((a: any, i: number) => (
          <Card key={i} className="flex items-center gap-3 overflow-hidden pr-3">
            <Img id={a.photoId} media={ctx.media} className="h-20 w-20 object-cover" sizes="80px" alt={`Photo of ${a.name}`} />
            <span className="flex-1 text-center"><span className="block font-serif text-[16px] font-bold text-primary-800">{a.name}</span><span className="block text-[12.5px] text-primary-900">{r.examination} ({r.year})</span><span className="mt-1 inline-block rounded bg-gold-300 px-2 text-[12px] font-bold text-primary-900">{a.percentage}</span></span>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ExamSelector({ path, options, r }: { path: string; options: any; r: any }) {
  return (
    <form action={path} className="flex gap-3">
      <label className="text-[13.5px] font-semibold text-primary-900">Select Examination
        <select name="exam" defaultValue={r.examination} className="mt-1 block w-48 rounded-full border border-primary-200 bg-white px-4 py-2 font-semibold text-primary-800">{options.examinations.map((e: string) => <option key={e}>{e}</option>)}</select>
      </label>
      <label className="text-[13.5px] font-semibold text-primary-900">Year
        <select name="year" defaultValue={r.year} className="mt-1 block w-28 rounded-full border border-primary-200 bg-white px-4 py-2 font-semibold text-primary-800">{options.years.map((y: number) => <option key={y}>{y}</option>)}</select>
      </label>
      <button className="self-end rounded-full bg-primary-800 px-4 py-2 text-[13px] font-bold text-white">Go</button>
    </form>
  );
}

async function ResultsDetailed({ path, sp, page }: DynProps) {
  const d = await api(`/results${qs({ exam: one(sp.exam), year: one(sp.year) })}`);
  const r = d?.result;
  if (!r) return <Empty>Examination results will be published soon.</Empty>;
  const s = r.summary ?? {};
  const total = (r.grades ?? []).reduce((n: number, g: any) => n + (g.count ?? 0), 0) || Number(s.totalStudents) || 1;
  const colors = ['#5b2b82', '#9b6bc6', '#cfb3e6', '#e3dceb'];
  let acc = 0;
  const donut = (r.grades ?? []).map((g: any, i: number) => { const from = acc; acc += ((g.count ?? 0) / total) * 100; return `${colors[i % 4]} ${from}% ${acc}%`; }).join(', ');
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="font-serif text-[34px] font-bold text-primary-800">{page.title}</h2>
          <p className="text-[14.5px] text-primary-700">{page.content?.intro?.text}</p>
        </div>
        <ExamSelector path={path} options={d.options} r={r} />
      </div>
      <div className="flex flex-col overflow-hidden rounded-xl border border-primary-100 bg-cream-50 shadow-card md:flex-row">
        <ResultBadge r={r} />
        <div className="grid flex-1 grid-cols-2 gap-y-3 py-3 text-center sm:grid-cols-5 sm:divide-x sm:divide-primary-100">
          {[['GraduationCap', s.aRate, 'A & A+ Grades'], ['UsersRound', s.totalStudents, 'Total Students'], ['Award', s.distinctions, 'Subject Distinctions'], ['Trophy', s.position, 'District Position'], ['ChartColumn', s.passRate, 'Pass Rate']].map(([ic, v, l]) => (
            <div key={l} className="px-2"><Icon name={ic} className="mx-auto h-7 w-7 text-gold-500" /><p className="font-serif text-[26px] font-bold leading-tight text-primary-800">{v}</p><p className="text-[12.5px] font-semibold text-primary-900">{l}</p></div>
          ))}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <Heading icon="ChartColumn">Grade Distribution</Heading>
          <Card className="flex flex-col items-center gap-6 p-5 sm:flex-row">
            <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: `conic-gradient(${donut})` }} role="img" aria-label="Grade distribution chart">
              <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white"><span className="font-serif text-[24px] font-bold text-primary-800">{s.totalStudents}</span><span className="text-[12px] text-primary-900">Students</span></div>
            </div>
            <table className="flex-1 text-[13.5px]"><tbody>{(r.grades ?? []).map((g: any, i: number) => <tr key={i} className="border-b border-primary-100"><td className="py-1.5"><span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: colors[i % 4] }} />{g.label} ({g.range})</td><td className="text-right">{g.count}</td><td className="text-right">{g.percent}</td></tr>)}</tbody></table>
          </Card>
        </section>
        <section>
          <Heading icon="BookOpen">Subject-wise Results (A & A+ Rate)</Heading>
          <Card className="flex h-[212px] items-end gap-3 px-5 pb-8 pt-6">
            {(r.subjects ?? []).map((sub: any, i: number) => (
              <div key={i} className="relative flex h-full flex-1 flex-col justify-end text-center">
                <span className="mb-1 text-[12px] font-bold text-primary-800">{sub.rate}%</span>
                <span className="w-full rounded-t bg-gradient-to-b from-primary-600 to-primary-800" style={{ height: `${Math.max(4, Number(sub.rate ?? 0) * 0.8)}%` }} aria-label={`${sub.name}: ${sub.rate}%`} />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11.5px] text-primary-900">{sub.name}</span>
              </div>
            ))}
          </Card>
        </section>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ResultTable heading={`Top Achievers – ${r.examination} ${r.year}`} icon="UsersRound" cols={['Position', 'Student Name', `Marks / ${r.achievers?.[0]?.total ?? ''}`, 'Percentage', 'Grade']} rows={(r.achievers ?? []).slice(0, 5).map((a: any, i: number) => [String(i + 1), a.name, a.marks, a.percentage, a.grade])} />
        <ResultTable heading="Class-wise Results" icon="Layers" cols={['Class / Section', 'Total Students', 'A & A+', 'B', 'Below B', 'Pass Rate']} rows={(r.classes ?? []).map((c: any) => [c.name, c.total, c.aPlus, c.b, c.belowB, c.passRate])} />
      </div>
      {(r.documents ?? []).length > 0 && (
        <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <Heading icon="Download" className="mb-0 shrink-0">Download Results</Heading>
          <div className="flex flex-1 flex-wrap gap-2">{r.documents.map((id: string) => d.documents[id] && <a key={id} href={d.documents[id].url} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-full border-2 border-primary-100 bg-white px-4 py-2 font-serif text-[13px] font-bold text-primary-800 hover:border-primary-400"><Icon name="FileText" className="h-4 w-4 text-primary-800" />{d.documents[id].title.replace(`${r.examination} ${r.year} – `, '')}</a>)}</div>
        </Card>
      )}
    </div>
  );
}

function ResultTable({ heading, icon, cols, rows }: { heading: string; icon: string; cols: string[]; rows: any[][] }) {
  return (
    <section>
      <Heading icon={icon}>{heading}</Heading>
      <div className="overflow-x-auto rounded-xl border border-primary-100 bg-white shadow-card">
        <table className="w-full text-[13.5px]">
          <thead className="bg-primary-800 text-white"><tr>{cols.map((c) => <th key={c} className="px-3 py-2 text-left font-serif">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-primary-100">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 text-primary-900">{j === r.length - 1 && /^A/.test(String(c)) ? <span className="rounded bg-gold-300 px-2 font-bold">{c}</span> : c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

async function ResultsAchievers({ path, sp, page }: DynProps) {
  const d = await api(`/results${qs({ exam: one(sp.exam), year: one(sp.year) })}`);
  const r = d?.result;
  if (!r) return <Empty>Results will be published soon.</Empty>;
  const s = r.summary ?? {};
  const top = (r.achievers ?? []).slice(0, 5);
  const medal = ['#e7b53c', '#b9bec7', '#cd7f32'];
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div><h2 className="font-serif text-[34px] font-bold text-primary-800">{page.title}</h2><p className="text-[14.5px] text-primary-700">{page.content?.intro?.text}</p></div>
        <ExamSelector path={path} options={d.options} r={r} />
      </div>
      <div className="flex flex-col overflow-hidden rounded-xl border border-primary-100 bg-cream-50 shadow-card md:flex-row">
        <ResultBadge r={r} />
        <div className="grid flex-1 grid-cols-2 gap-y-3 py-3 text-center sm:grid-cols-4 sm:divide-x sm:divide-primary-100">
          {[['GraduationCap', s.topHolders ?? top.length, 'Top Position Holders'], ['UsersRound', s.totalStudents, 'A & A+ Grade Students'], ['Award', s.distinctions, 'Subject Distinctions'], ['ChartColumn', s.aRate, 'Overall A & A+ Rate']].map(([ic, v, l]) => <div key={l} className="px-2"><Icon name={ic} className="mx-auto h-7 w-7 text-gold-500" /><p className="font-serif text-[28px] font-bold leading-tight text-primary-800">{v}</p><p className="text-[13px] font-semibold text-primary-900">{l}</p></div>)}
        </div>
      </div>
      <Heading icon="Trophy">Our Top Achievers</Heading>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {top.map((a: any, i: number) => (
          <Card key={i} className="relative flex flex-col items-center px-3 pb-4 pt-3 text-center">
            <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full font-serif text-[18px] font-bold text-white shadow" style={{ background: medal[i] ?? 'rgb(var(--p-800))' }}>{i + 1}</span>
            <Img id={a.photoId} media={d.media} className="h-28 w-28 rounded-full object-cover" sizes="112px" alt={`Photo of ${a.name}`} />
            <p className="-mt-2 rounded-md bg-primary-800 px-4 py-1 font-serif text-[16px] font-bold text-white">{a.name}</p>
            <p className="mt-1 text-[13px] text-primary-900">{r.examination} {r.year}</p>
            <p className="mt-1 rounded bg-gold-300/80 px-3 font-semibold text-primary-900">{a.marks} / {a.total}</p>
            <p className="mt-1 font-serif text-[20px] font-bold text-primary-800">{a.percentage} <span className="rounded bg-gold-400 px-1.5 text-[13px] text-primary-900">{a.grade}</span></p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <ResultTable heading="More High Achievers (A & A+ Grade)" icon="ChartColumn" cols={['Sr. No.', 'Student Name', `Marks / ${top[0]?.total ?? ''}`, 'Percentage', 'Grade']} rows={(r.achievers ?? []).slice(5).map((a: any, i: number) => [String(i + 6), a.name, a.marks, a.percentage, a.grade])} />
        <section>
          <Heading icon="Award">Subject Distinctions</Heading>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {(r.subjects ?? []).filter((x: any) => x.distinctions).map((x: any) => <Card key={x.name} className="p-3 text-center"><Icon name={x.icon || 'BookOpen'} className="mx-auto h-8 w-8 text-primary-800" /><p className="font-serif text-[15px] font-bold text-primary-800">{x.name}</p><p className="text-[12.5px] text-primary-900">{x.distinctions} Distinctions</p></Card>)}
          </div>
        </section>
      </div>
    </div>
  );
}

function ResultsList({ extras, ctx }: DynProps) {
  const list = extras?.results ?? [];
  if (!list.length) return <Empty>Board results will be published soon.</Empty>;
  return (
    <div className="space-y-3">
      {list.map((r: any) => (
        <Link key={r.id} href={`/academics/academic-achievements/detailed-results?exam=${encodeURIComponent(r.examination)}&year=${r.year}`} className="flex flex-col overflow-hidden rounded-xl border border-primary-100 bg-cream-50 shadow-card hover:shadow-lift md:flex-row">
          <ResultBadge r={r} />
          <div className="grid flex-1 grid-cols-2 gap-y-2 py-3 text-center sm:grid-cols-4 sm:divide-x sm:divide-primary-100">
            {[[r.summary?.aRate, 'A & A+ Grades'], [r.summary?.totalStudents, 'Students'], [r.summary?.distinctions, 'Distinctions'], [r.summary?.passRate, 'Pass Rate']].map(([v, l]) => <div key={l}><p className="font-serif text-[24px] font-bold text-primary-800">{v}</p><p className="text-[13px] text-primary-900">{l}</p></div>)}
          </div>
          <span className="flex items-center justify-center px-5 py-3 font-serif text-[14px] font-bold text-primary-800">Details →</span>
        </Link>
      ))}
    </div>
  );
}

function AchievementList({ extras, ctx }: DynProps) {
  const list = extras?.posts ?? [];
  if (!list.length) return <Empty>Achievements in this category will be published soon.</Empty>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{list.map((a: any) => <AchievementCard key={a.id} a={a} media={ctx.media} />)}</div>;
}

// ───────────────────────── FAQs ─────────────────────────
function Faqs({ extras, page, site }: DynProps) {
  const c = page.content ?? {};
  const contact = site.settings.contact ?? {};
  return (
    <div className="grid gap-5 2xl:grid-cols-[1fr_310px]">
      <div className="min-w-0"><FaqBrowser faqs={extras?.faqs ?? []} categories={extras?.categories ?? []} /></div>
      <aside className="space-y-5">
        <RightCard icon="Filter" title="Browse by Category">
          <ul className="divide-y divide-primary-100">
            {(extras?.categories ?? []).map((cat: any) => (
              <li key={cat.slug}><a href={`#category=${cat.slug}`} className="flex items-center gap-3 py-2 text-[13.5px] text-primary-900 hover:text-primary-600"><Icon name={cat.icon} className="h-5 w-5 text-primary-800" /><span className="flex-1">{cat.name}</span><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-800 text-[11px] font-bold text-white">{cat.count}</span>›</a></li>
            ))}
          </ul>
        </RightCard>
        <Card className="p-5 text-center">
          <Heading icon="MessageSquare" className="justify-center">{c.contactHeading}</Heading>
          {c.contactText && <p className="mb-3 text-[14px] text-primary-900">{c.contactText}</p>}
          <div className="space-y-2 text-left">
            {contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-3 rounded-full border border-primary-200 bg-white px-4 py-2 font-serif text-[14px] font-bold text-primary-800"><Icon name="Mail" className="h-5 w-5 text-primary-800" />{contact.email}</a>}
            {contact.phone && <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-3 rounded-full border border-primary-200 bg-white px-4 py-2 font-serif text-[14px] font-bold text-primary-800"><Icon name="Phone" className="h-5 w-5 text-primary-800" />{contact.phone}</a>}
            {c.visitHref && <SmartLink href={c.visitHref} className="flex items-center gap-3 rounded-full border border-primary-200 bg-white px-4 py-2 font-serif text-[14px] font-bold text-primary-800"><Icon name="CalendarDays" className="h-5 w-5 text-primary-800" />Schedule a Call / Visit</SmartLink>}
          </div>
          <Button href="/contact" className="mt-4 w-full">Contact Admissions</Button>
        </Card>
      </aside>
    </div>
  );
}

// ───────────────────────── Map ─────────────────────────
export function MapEmbed({ site, className }: { site: Site; className?: string }) {
  const c = site.settings.contact ?? {};
  // A Google/OSM link with coordinates can be set in Contact Information → Map link.
  const m = String(c.mapUrl ?? '').match(/(-?\d+\.\d+)[, ]+(-?\d+\.\d+)/);
  const [lat, lon] = m ? [Number(m[1]), Number(m[2])] : [25.462, 68.72];
  const bbox = `${lon - 0.03},${lat - 0.02},${lon + 0.03},${lat + 0.02}`;
  return (
    <div className={clsx('overflow-hidden rounded-xl border border-primary-100 shadow-card', className)}>
      <iframe title="Map showing the SST Rashidabad campus" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`} className="h-full min-h-[220px] w-full" loading="lazy" />
      {c.mapUrl && <a href={c.mapUrl} target="_blank" rel="noopener noreferrer" className="block bg-white px-3 py-1.5 text-right text-[12.5px] font-semibold text-primary-800">Open larger map ↗</a>}
    </div>
  );
}

// ───────────────────────── Careers ─────────────────────────
function Vacancies({ extras, sp }: DynProps) {
  const list = (extras?.vacancies ?? []).filter((v: any) => (!one(sp.search) || v.title.toLowerCase().includes(one(sp.search).toLowerCase())) && (!one(sp.department) || v.department === one(sp.department)) && (!one(sp.type) || v.jobType === one(sp.type)));
  const depts = [...new Set((extras?.vacancies ?? []).map((v: any) => v.department).filter(Boolean))] as string[];
  const types = [...new Set((extras?.vacancies ?? []).map((v: any) => v.jobType).filter(Boolean))] as string[];
  return (
    <section id="vacancies" className="scroll-mt-24">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="font-serif text-[28px] font-bold text-primary-800">Current Vacancies<span className="block h-[3px] w-20 rounded bg-gold-400" aria-hidden /></h2>
        <form action="/careers#vacancies" className="flex flex-wrap gap-2">
          <input name="search" defaultValue={one(sp.search)} aria-label="Search vacancies" placeholder="Search job title or keyword…" className="rounded-lg border border-primary-200 bg-white px-3 py-2 text-[13.5px]" />
          <select name="department" defaultValue={one(sp.department)} aria-label="Department" className="rounded-lg border border-primary-200 bg-white px-3 py-2 font-serif text-[13.5px] font-bold text-primary-800"><option value="">All Departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>
          <select name="type" defaultValue={one(sp.type)} aria-label="Job type" className="rounded-lg border border-primary-200 bg-white px-3 py-2 font-serif text-[13.5px] font-bold text-primary-800"><option value="">All Job Types</option>{types.map((d) => <option key={d}>{d}</option>)}</select>
          <button className="rounded-lg bg-primary-800 px-4 py-2 text-[13.5px] font-bold text-white">Search</button>
        </form>
      </div>
      {!list.length ? <Empty>There are no open vacancies at the moment. Please check back soon.</Empty> : (
        <ul className="divide-y divide-primary-100 rounded-xl border border-primary-100 bg-cream-50 shadow-card">
          {list.map((v: any) => (
            <li key={v.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-50"><Briefcase className="h-7 w-7 text-primary-800" aria-hidden /></span>
              <span className="flex-1"><span className="block font-serif text-[18px] font-bold text-primary-800">{v.title}</span><span className="flex items-center gap-1 text-[13.5px] text-primary-900"><Icon name="Building2" className="h-4 w-4 text-primary-800" />{v.department}</span></span>
              <span className="flex flex-wrap gap-x-6 gap-y-1 text-[13.5px] text-primary-900">
                {v.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden />{v.location}</span>}
                {v.jobType && <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" aria-hidden />{v.jobType}</span>}
                {v.closingDate && <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden />Apply by: {fmtDate(v.closingDate)}</span>}
              </span>
              <Button href={`/careers/${v.slug}`} variant="outline" className="px-4 py-1.5 text-[14px]">View Details</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ───────────────────────── Alumni ─────────────────────────
function Alumni({ extras, ctx }: DynProps) {
  const stories = extras?.stories ?? [];
  return (
    <div className="space-y-5">
      {stories.length > 0 && (
        <section>
          <Heading icon="Star">Alumni Stories</Heading>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stories.map((s: any) => (
              <Card key={s.id} className="flex gap-4 p-4">
                <Img id={s.photoId} media={ctx.media} className="h-24 w-24 shrink-0 rounded-lg object-cover" sizes="96px" alt={`Photo of ${s.name}`} />
                <div><p className="text-[14px] italic text-primary-900">“{s.quote}”</p><p className="mt-2 font-serif font-bold text-primary-800">{s.name}</p><p className="text-[12.5px] text-primary-900">{[s.subtitle, s.detail].filter(Boolean).join(' · ')}</p></div>
              </Card>
            ))}
          </div>
        </section>
      )}
      <Card id="register" className="scroll-mt-24 p-5">
        <Heading icon="UserPlus">Join the Alumni Network</Heading>
        <SiteForm endpoint="alumni" submitLabel="Register" className="grid gap-3 md:grid-cols-2">
          <Field name="name" label="Full name" required />
          <Field name="email" label="Email" type="email" required />
          <Field name="phone" label="Phone" />
          <Field name="graduationYear" label="Year of graduation" />
          <Field name="profession" label="Profession / organisation" />
          <Field name="city" label="City / country" />
          <Field name="message" label="Message (optional)" textarea maxLength={1000} className="md:col-span-2" />
          <span className="md:col-span-2" />
        </SiteForm>
      </Card>
    </div>
  );
}

// ───────────────────────── Contact ─────────────────────────
function Contact({ site, page }: DynProps) {
  const c = site.settings.contact ?? {};
  const content = page.content ?? {};
  const intro = content.intro ?? {};
  const info = [
    ['MapPin', 'Address', c.address],
    ['Phone', 'Phone', c.phone],
    ['Mail', 'Email', c.email],
    ['Clock', 'Office Hours', c.officeHours],
  ].filter(([, , v]) => v);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_1.35fr_1fr]">
        <div>
          <h2 className="font-serif text-[34px] font-bold text-primary-800">{intro.heading}<span className="block h-[3px] w-24 rounded bg-gold-400" aria-hidden /></h2>
          {intro.text && <p className="my-4 text-[15.5px] text-primary-900">{intro.text}</p>}
          <ul className="space-y-3">
            {info.map(([ic, label, v]) => (
              <li key={label as string}><Card className="flex gap-4 px-5 py-4"><Icon name={ic as string} className="h-9 w-9 text-gold-500" /><span><span className="block font-serif text-[18px] font-bold text-primary-800">{label}</span><span className="whitespace-pre-line text-[15px] text-primary-900">{label === 'Email' ? <a href={`mailto:${v}`}>{v}</a> : label === 'Phone' ? <a href={`tel:${String(v).replace(/[^\d+]/g, '')}`}>{v}</a> : v}</span></span></Card></li>
            ))}
          </ul>
        </div>
        <Card id="message" className="scroll-mt-24 p-6">
          <Heading icon="Mail">Send Us a Message</Heading>
          <SiteForm endpoint="contact" submitLabel="Send Message" className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label="Your Name" required placeholder="Enter your name" />
            <Field name="email" label="Email Address" type="email" required placeholder="Enter your email" />
            <Field name="phone" label="Phone Number" placeholder="Enter your phone number" />
            <Field name="inquiryType" label="Inquiry Type" required options={content.inquiryTypes ?? ['General']} />
            <Field name="subject" label="Subject" required placeholder="Enter subject" className="sm:col-span-2" />
            <Field name="message" label="Message" required textarea maxLength={500} placeholder="Write your message here…" className="sm:col-span-2" />
            <span className="sm:col-span-2" />
          </SiteForm>
        </Card>
        <div className="space-y-5">
          <MapEmbed site={site} className="h-[230px]" />
          {(content.quickLinks ?? []).length > 0 && (
            <Card className="p-5">
              <h3 className="mb-2 font-serif text-[22px] font-bold text-primary-800">Quick Links</h3>
              <ul className="divide-y divide-primary-100">{content.quickLinks.map((q: any, i: number) => <li key={i}><SmartLink href={q.href} className="flex items-center gap-3 py-2.5 text-[15px] text-primary-900 hover:text-primary-600"><Icon name={q.icon} className="h-5 w-5 text-primary-800" /><span className="flex-1">{q.label}</span>›</SmartLink></li>)}</ul>
            </Card>
          )}
        </div>
      </div>
      {(content.enquiries ?? []).length > 0 && (
        <Card className="grid gap-4 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
          {content.enquiries.map((e: any, i: number) => (
            <div key={i} className={clsx('flex gap-4', i > 0 && 'xl:border-l xl:border-primary-100 xl:pl-6')}><Icon name={e.icon} className="h-11 w-11 text-primary-800" strokeWidth={1.4} /><span><span className="block font-serif text-[17px] font-bold text-primary-800">{e.title}</span><span className="text-[13.5px] text-primary-900">{e.text}</span></span></div>
          ))}
        </Card>
      )}
    </div>
  );
}

/** Data-driven section for a composed template (see PageLayout.dynamic). */
export async function DynamicSection(props: DynProps & { kind: string }) {
  const title = props.page.content?.intro?.heading || props.page.title;
  switch (props.kind) {
    case 'news': return <NewsList {...props} title={title} />;
    case 'events': return <EventsList {...props} title={title} />;
    case 'announcements': return <Announcements {...props} title={title} />;
    case 'achievements': return <Achievements {...props} title={title} />;
    case 'gallery': return <GalleryList {...props} title={title} />;
    case 'downloads': return <Downloads {...props} title={title} />;
    case 'faculty-featured': return <FacultyFeatured {...props} />;
    case 'faculty-directory': return <FacultyDirectory {...props} />;
    case 'results-summary': return <ResultsSummary {...props} />;
    case 'results-detailed': return <ResultsDetailed {...props} />;
    case 'results-achievers': return <ResultsAchievers {...props} />;
    case 'results-list': return <ResultsList {...props} />;
    case 'achievement-list': return <AchievementList {...props} />;
    case 'faqs': return <Faqs {...props} />;
    case 'map': return <section><Heading icon="MapPin">Find Us</Heading><MapEmbed site={props.site} className="h-[320px]" /></section>;
    case 'vacancies': return <Vacancies {...props} />;
    case 'alumni': return <Alumni {...props} />;
    case 'contact': return <Contact {...props} />;
    default: return null;
  }
}

/** Dynamic templates that render their own heading (the generic intro is skipped). */
export const SELF_TITLED = new Set(['news', 'events', 'announcements', 'achievements', 'gallery', 'downloads', 'results-detailed', 'results-achievers', 'contact']);

export { CheckList, Star, Clock };
