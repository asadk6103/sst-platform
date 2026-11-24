import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TEMPLATE_MAP } from '@sst/shared';
import { api, getSite, type Site } from '@/lib/api';
import { stripHtml } from '@/lib/format';
import { PageFrame } from './shell';
import { ComposedBody, type Ctx } from './blocks/Blocks';
import { DynamicSection, SELF_TITLED, type SP } from './dynamic/Dynamic';
import { SubscribeForm } from './client';
import { Button, Icon, Img } from './ui';
import * as About from './templates/About';
import { Home } from './templates/Home';
import { AlbumDetail, ArticleDetail, FacultyProfile, PersonProfile, VacancyDetail } from './templates/Details';

const BESPOKE: Record<string, (p: About.TplProps) => React.ReactNode> = {
  'about-school': About.AboutSchool,
  history: About.History,
  'vision-mission': About.VisionMission,
  'leadership-overview': About.LeadershipOverview,
  'leadership-message': About.LeadershipMessage,
  'committee-directory': About.CommitteeDirectory,
  'executive-committee': About.ExecutiveCommittee,
  'school-administration': About.SchoolAdministration,
  'governance-framework': About.GovernanceFramework,
  'why-choose': About.WhyChoose,
  'our-impact': About.OurImpact,
  standard: About.Standard,
};

/** Resolves a URL to a page record or a detail route, and returns what to render. */
async function resolve(slug: string[]) {
  const s = slug.map(decodeURIComponent);
  const path = '/' + s.join('/');
  const [a, b, c, d] = s;
  if (a === 'about' && b === 'leadership-governance' && c && d && ['board-of-trustees', 'executive-committee', 'school-administration'].includes(c)) {
    const data = await api(`/committees/${c}/people/${d}`);
    return data && { kind: 'person' as const, path, data };
  }
  if (a === 'academics' && b === 'faculty' && c && c !== 'directory' && !d) {
    const data = await api(`/faculty/${c}`);
    return data && { kind: 'faculty' as const, path, data };
  }
  if (a === 'news-events' && c && !d && ['news', 'announcements', 'achievements'].includes(b ?? '')) {
    const data = await api(`/posts/${c}`);
    return data && { kind: 'post' as const, path, data, section: b as 'news' | 'announcements' | 'achievements' };
  }
  if (a === 'news-events' && b === 'events' && c && !d) {
    const data = await api(`/events/${c}`);
    return data && { kind: 'event' as const, path, data };
  }
  if (a === 'news-events' && b === 'gallery' && c && !d) {
    const data = await api(`/galleries/${c}`);
    return data && { kind: 'album' as const, path, data };
  }
  if (a === 'careers' && b && !c) {
    const data = await api(`/vacancies/${b}`);
    return data && { kind: 'vacancy' as const, path, data };
  }
  const data = await api(`/pages/${s.length ? s.join('/') : 'home'}`);
  return data && { kind: 'page' as const, path, data };
}

export async function pageMetadata(slug: string[]): Promise<Metadata> {
  const r = await resolve(slug).catch(() => null);
  if (!r) return { title: 'Page not found' };
  const media = r.data.media ?? {};
  const og = (id?: string | null) => (id && media[id] ? [media[id].url] : undefined);
  switch (r.kind) {
    case 'page': {
      const p = r.data.page;
      return { title: p.slug === 'home' ? undefined : p.seo?.title || p.title, description: p.seo?.description || p.subtitle || undefined, keywords: p.seo?.keywords, openGraph: { images: og(p.seo?.ogImageId ?? p.heroImageId) }, alternates: { canonical: r.path === '/home' ? '/' : r.path } };
    }
    case 'post': return { title: r.data.post.seo?.title || r.data.post.title, description: r.data.post.seo?.description || r.data.post.excerpt, openGraph: { type: 'article', images: og(r.data.post.featuredImageId) } };
    case 'event': return { title: r.data.event.title, description: r.data.event.excerpt, openGraph: { images: og(r.data.event.featuredImageId) } };
    case 'person': return { title: r.data.person.fullName, description: r.data.person.shortBio || stripHtml(r.data.person.biography).slice(0, 160) };
    case 'faculty': return { title: r.data.faculty.fullName, description: `${r.data.faculty.designation ?? ''} ${r.data.faculty.subject ?? ''}`.trim() };
    case 'album': return { title: r.data.gallery.title };
    case 'vacancy': return { title: r.data.vacancy.title, description: r.data.vacancy.summary };
  }
  return {};
}

function sidebarExtras(site: Site, template: string, content: any) {
  if (template === 'announcements-list') {
    const cats = site.categories.documents ?? [];
    return (
      <div className="rounded-xl border border-primary-100/70 bg-cream-50 p-5 shadow-card">
        <p className="mb-2 flex items-center gap-2 font-serif text-[21px] font-bold text-primary-800"><Icon name="Download" className="h-7 w-7 text-primary-800" />Quick Downloads</p>
        <ul>{cats.slice(0, 4).map((c) => <li key={c.slug}><Link href={`/downloads?category=${c.slug}`} className="flex items-center gap-3 py-2 font-serif text-[15px] font-bold text-primary-800 hover:text-primary-600"><Icon name={c.icon} className="h-5 w-5 text-primary-800" /><span className="flex-1">{c.name}</span>›</Link></li>)}</ul>
      </div>
    );
  }
  if (template === 'gallery-list')
    return (
      <div className="rounded-xl border border-primary-100/70 bg-cream-50 p-5 shadow-card">
        <p className="mb-2 flex items-center gap-2 font-serif text-[21px] font-bold text-primary-800"><Icon name="Download" className="h-7 w-7 text-primary-800" />Quick Access</p>
        <ul>{[['Image', 'Photo Gallery', '/news-events/gallery'], ['PlayCircle', 'Video Gallery', '/news-events/gallery#videos'], ['Layers', 'Event Albums', '/news-events/gallery?category=events'], ['LayoutGrid', 'Annual Highlights', `/news-events/gallery?year=${new Date().getFullYear()}`]].map(([ic, l, h]) => <li key={l}><Link href={h!} className="flex items-center gap-3 py-2 font-serif text-[15px] font-bold text-primary-800 hover:text-primary-600"><Icon name={ic} className="h-5 w-5 text-primary-800" />{l}</Link></li>)}</ul>
      </div>
    );
  return null;
}

function SidebarCardWithForm({ card, content, template }: { card: any; content: any; template: string }) {
  if (!card?.heading) return null;
  return (
    <div className="rounded-xl border border-primary-100/70 bg-cream-50 px-6 py-7 text-center shadow-card">
      <Icon name={card.icon} className="mx-auto mb-2 h-12 w-12 text-primary-800" strokeWidth={1.4} />
      <p className="font-serif text-[22px] font-bold leading-tight text-primary-800">{card.heading}</p>
      {card.text && <p className="mb-4 mt-2 text-[14.5px] text-primary-900">{card.text}</p>}
      {template === 'achievements-list' && content.journeyValue && (
        <p className="mt-3 font-serif text-primary-800"><span className="text-[40px] font-bold">{content.journeyValue}</span><span className="block text-[18px] font-bold">{content.journeyLabel}</span></p>
      )}
      {card.ctaHref === '#subscribe' ? <SubscribeForm source={template} /> : card.ctaLabel && card.ctaHref ? <Button href={card.ctaHref} className="w-full">{card.ctaLabel}</Button> : null}
    </div>
  );
}

export async function renderPage(slug: string[], sp: SP) {
  const [site, r] = await Promise.all([getSite(), resolve(slug)]);
  if (!r) notFound();
  const media = { ...site.media, ...(r.data.media ?? {}) };
  const documents = { ...site.documents, ...(r.data.documents ?? {}) };
  const ctx: Ctx = { media, documents };
  const NE = { eyebrow: 'NEWS & EVENTS', imageId: null };

  switch (r.kind) {
    case 'person': {
      const d = r.data;
      return (
        <PageFrame site={site} path={r.path} media={media} hero={{ eyebrow: 'LEADERSHIP & GOVERNANCE', title: d.committee.name, subtitle: d.committee.profileLabel }} sidebarCard={null} crumbExtra={[{ label: d.committee.name, href: `/about/leadership-governance/${d.committee.slug}` }, { label: d.committee.profileLabel, href: r.path }]}>
          <PersonProfile data={d} media={media} documents={documents} />
        </PageFrame>
      );
    }
    case 'faculty':
      return (
        <PageFrame site={site} path={r.path} media={media} sidebar={false} hero={{ eyebrow: 'ACADEMICS', title: 'Faculty Profile', subtitle: 'Meet our dedicated educators who inspire, guide and empower students to achieve their full potential.' }} banner={r.data.faculty.quote ? { quote: r.data.faculty.quote } : null} crumbExtra={[{ label: 'Faculty Profile', href: r.path }]}>
          <FacultyProfile f={r.data.faculty} media={media} />
        </PageFrame>
      );
    case 'post': {
      const labels: Record<string, string> = { news: 'Latest News', announcements: 'Announcements', achievements: 'Achievements' };
      const back = { href: r.section === 'news' ? '/news-events' : `/news-events/${r.section}`, label: `Back to ${labels[r.section]}` };
      return (
        <PageFrame site={site} path={r.path} media={media} hero={{ ...NE, title: labels[r.section], subtitle: r.data.post.title }} crumbExtra={[{ label: labels[r.section], href: back.href }, { label: r.data.post.title, href: r.path }]}>
          <ArticleDetail item={r.data.post} kind={r.section as any} media={media} documents={documents} related={r.data.related} back={back} />
        </PageFrame>
      );
    }
    case 'event':
      return (
        <PageFrame site={site} path={r.path} media={media} hero={{ ...NE, title: 'Events', subtitle: r.data.event.title }} crumbExtra={[{ label: 'Events', href: '/news-events/events' }, { label: r.data.event.title, href: r.path }]}>
          <ArticleDetail item={r.data.event} kind="events" media={media} documents={documents} related={r.data.related} back={{ href: '/news-events/events', label: 'Back to Events' }} />
        </PageFrame>
      );
    case 'album':
      return (
        <PageFrame site={site} path={r.path} media={media} hero={{ ...NE, title: 'Gallery', subtitle: r.data.gallery.title }} crumbExtra={[{ label: 'Gallery', href: '/news-events/gallery' }, { label: r.data.gallery.title, href: r.path }]}>
          <AlbumDetail gallery={r.data.gallery} media={media} />
        </PageFrame>
      );
    case 'vacancy':
      return (
        <PageFrame site={site} path={r.path} media={media} sidebar={false} hero={{ eyebrow: 'CAREERS', title: 'Careers at SST', subtitle: r.data.vacancy.title }} crumbExtra={[{ label: r.data.vacancy.title, href: r.path }]}>
          <VacancyDetail v={r.data.vacancy} />
        </PageFrame>
      );
  }

  const page = r.data.page;
  const extras = r.data.extras ?? {};
  const content = page.content ?? {};
  const tpl = TEMPLATE_MAP[page.template];
  if (page.template === 'home') return <Home site={site} page={page} extras={extras} media={media} documents={documents} path="/" />;

  const hero = { eyebrow: content.hero?.eyebrow, title: page.title, subtitle: page.subtitle, imageId: page.heroImageId };
  const layout = tpl?.layout;
  if (layout) {
    const dyn = layout.dynamic ? <DynamicSection kind={layout.dynamic} site={site} page={page} extras={extras} sp={sp} path={r.path} ctx={ctx} /> : null;
    const selfTitled = layout.dynamic && SELF_TITLED.has(layout.dynamic);
    return (
      <PageFrame
        site={site}
        path={r.path}
        media={media}
        hero={hero}
        sidebar={layout.sidebar}
        sidebarCard={null}
        sidebarExtra={
          <>
            {sidebarExtras(site, page.template, content)}
            <SidebarCardWithForm card={content.sidebarCard} content={content} template={page.template} />
          </>
        }
        banner={content.banner}
      >
        {selfTitled ? dyn : <ComposedBody layout={layout} content={content} ctx={ctx} dynamic={dyn} />}
      </PageFrame>
    );
  }
  const Tpl = BESPOKE[page.template] ?? About.Standard;
  const tour = content.sidebar?.showVirtualTour ? site.settings.website?.virtualTour : null;
  return (
    <PageFrame
      site={site}
      path={r.path}
      media={media}
      hero={hero}
      banner={content.banner}
      sidebarExtra={
        tour?.heading ? (
          <div className="overflow-hidden rounded-xl border border-primary-100/70 bg-cream-50 shadow-card">
            <Img id={tour.image} media={media} className="aspect-[2/1] w-full object-cover" />
            <div className="p-4">
              <p className="font-serif text-[18px] font-bold text-primary-800">{tour.heading}</p>
              <p className="mt-1 text-[13.5px] text-primary-900">{tour.text}</p>
              {tour.ctaLabel && <Button href={tour.videoUrl || '/news-events/gallery'} className="mt-3 px-4 py-2 text-[14px]">{tour.ctaLabel}</Button>}
            </div>
          </div>
        ) : null
      }
    >
      <Tpl site={site} page={page} extras={extras} media={media} documents={documents} path={r.path} />
    </PageFrame>
  );
}
