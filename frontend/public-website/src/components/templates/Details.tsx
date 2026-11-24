import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowLeft, Briefcase, CalendarDays, Clock, Download, Mail, MapPin, Printer, UserRound, UsersRound } from 'lucide-react';
import type { DocMap, MediaMap } from '@/lib/api';
import { fmtDate, fmtRange } from '@/lib/format';
import { Button, Card, CheckList, Heading, Icon, Img, RichHtml, TickList } from '../ui';
import { Field, PrintButton, PrintButtonLabel, SiteForm, TabSet, ViewCounter } from '../client';

/** Shared layout for articles, events, announcements, achievements (SST-designed). */
export function ArticleDetail({ item, kind, media, documents, related, back }: { item: any; kind: 'news' | 'announcements' | 'achievements' | 'events'; media: MediaMap; documents: DocMap; related: any[]; back: { href: string; label: string } }) {
  const date = kind === 'events' ? fmtRange(item.startDate, item.endDate) : fmtDate(item.publicationDate);
  const doc = item.documentId ? documents[item.documentId] : null;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      {kind !== 'events' && <ViewCounter slug={item.slug} />}
      <article className="min-w-0">
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 font-serif text-[14px] font-bold text-primary-700 hover:underline"><ArrowLeft className="h-4 w-4" />{back.label}</Link>
        <h2 className="font-serif text-[32px] font-bold leading-tight text-primary-800">{item.title}</h2>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-primary-900">
          <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden />{date}</span>
          {item.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{item.location}</span>}
          {item.category && <span className="rounded bg-primary-50 px-2 py-0.5 font-serif text-[12.5px] font-bold text-primary-800">{item.category}</span>}
          {item.author && <span className="flex items-center gap-1.5"><UserRound className="h-4 w-4" aria-hidden />{item.author}</span>}
          {item.badge && <span className="rounded-full border-2 border-gold-400 px-2 font-serif font-bold text-gold-600">🏆 {item.badge}</span>}
        </div>
        {item.featuredImageId && <Img id={item.featuredImageId} media={media} className="mt-4 max-h-[460px] w-full rounded-xl object-cover shadow-card" sizes="(max-width:1280px) 100vw, 900px" priority />}
        {item.excerpt && <p className="mt-4 font-serif text-[17px] leading-relaxed text-primary-800">{item.excerpt}</p>}
        <RichHtml html={item.body} className="mt-3 text-[15.5px] leading-relaxed text-primary-900" />
        {doc && (
          <a href={doc.url ?? '#'} target="_blank" rel="noopener" className="mt-5 inline-flex items-center gap-2 rounded-lg border-2 border-primary-200 bg-white px-4 py-2 font-serif text-[14px] font-bold text-primary-800 hover:border-primary-500"><Download className="h-4 w-4" />Download: {doc.title}</a>
        )}
      </article>
      <aside className="space-y-5">
        {related.length > 0 && (
          <Card className="p-5">
            <Heading icon="Newspaper">{kind === 'events' ? 'More Upcoming Events' : 'Related'}</Heading>
            <ul className="space-y-3">
              {related.map((r) => (
                <li key={r.id}>
                  <Link href={`/news-events/${kind === 'news' ? 'news' : kind}/${r.slug}`} className="flex gap-3">
                    <Img id={r.featuredImageId} media={media} className="h-16 w-20 shrink-0 rounded-md object-cover" sizes="80px" />
                    <span><span className="block font-serif text-[13.5px] font-bold leading-tight text-primary-800">{r.title}</span><span className="text-[12px] text-primary-900">{fmtDate(r.publicationDate ?? r.startDate)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </aside>
    </div>
  );
}

export function AlbumDetail({ gallery, media }: { gallery: any; media: MediaMap }) {
  return (
    <div>
      <Link href="/news-events/gallery" className="mb-3 inline-flex items-center gap-1 font-serif text-[14px] font-bold text-primary-700 hover:underline"><ArrowLeft className="h-4 w-4" />Back to Gallery</Link>
      <h2 className="font-serif text-[32px] font-bold text-primary-800">{gallery.title}</h2>
      <p className="mb-4 flex gap-4 text-[13.5px] text-primary-900"><span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{fmtDate(gallery.eventDate)}</span><span>{gallery.images.length} photos</span></p>
      {gallery.description && <p className="mb-4 text-[15px] text-primary-900">{gallery.description}</p>}
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
        {gallery.images.map((im: any) => (
          <figure key={im.id} className="mb-3 break-inside-avoid overflow-hidden rounded-xl shadow-card">
            <a href={media[im.mediaId]?.url} target="_blank" rel="noopener"><Img id={im.mediaId} media={media} className="w-full" sizes="(max-width:768px) 100vw, 33vw" /></a>
            {im.caption && <figcaption className="bg-white px-3 py-2 text-[13px] text-primary-900">{im.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
}

export function VacancyDetail({ v }: { v: any }) {
  const open = !v.closingDate || new Date(v.closingDate) >= new Date(new Date().toDateString());
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <article>
        <Link href="/careers#vacancies" className="mb-3 inline-flex items-center gap-1 font-serif text-[14px] font-bold text-primary-700 hover:underline"><ArrowLeft className="h-4 w-4" />All vacancies</Link>
        <h2 className="font-serif text-[32px] font-bold text-primary-800">{v.title}</h2>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-primary-900">
          {v.department && <span className="flex items-center gap-1"><Icon name="Building2" className="h-4 w-4 text-primary-800" />{v.department}</span>}
          {v.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{v.location}</span>}
          {v.jobType && <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" />{v.jobType}</span>}
          {v.closingDate && <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />Apply by: {fmtDate(v.closingDate)}</span>}
        </div>
        {v.summary && <p className="mt-4 font-serif text-[17px] text-primary-800">{v.summary}</p>}
        <RichHtml html={v.body} className="mt-3 text-[15px] leading-relaxed text-primary-900" />
      </article>
      <Card id="apply" className="h-fit p-5">
        <Heading icon="Send">Apply for this position</Heading>
        {open ? (
          <SiteForm endpoint="career" multipart submitLabel="Submit Application" className="space-y-3">
            <input type="hidden" name="vacancy" value={v.title} />
            <Field name="name" label="Full name" required />
            <Field name="email" label="Email" type="email" required />
            <Field name="phone" label="Phone" required />
            <Field name="cv" label="CV (PDF or Word, max 5 MB)" type="file" accept=".pdf,.docx" required />
            <Field name="message" label="Cover note (optional)" textarea maxLength={2000} />
          </SiteForm>
        ) : (
          <p className="text-[14px] text-primary-900">Applications for this position have closed.</p>
        )}
        <p className="mt-3 text-[12px] text-primary-900/70">Your application is sent securely to the SST HR team and is only accessible to authorised staff.</p>
      </Card>
    </div>
  );
}

export function FacultyProfile({ f, media }: { f: any; media: MediaMap }) {
  const facts = [
    ['GraduationCap', f.qualification],
    ['Briefcase', f.experience && `${f.experience} Experience`],
    ['UsersRound', f.department && `${f.department} Department`],
    ['Layers', f.programmes],
    ['CalendarDays', f.joinedDate && `Joined SST ${fmtDate(f.joinedDate, { month: 'short', year: 'numeric' })}`],
  ].filter(([, v]) => v) as [string, string][];
  const info = [
    ['UserRound', 'Designation', f.designation],
    ['Building2', 'Department', f.department],
    ['Layers', 'Programmes', f.programmes],
    ['CalendarDays', 'Experience', f.experience],
    ['CalendarDays', 'At SST Since', f.joinedDate && fmtDate(f.joinedDate, { month: 'long', year: 'numeric' })],
  ].filter(([, , v]) => v) as [string, string, string][];
  const chips = (list: string[]) => <div className="flex flex-wrap gap-2">{list.map((t) => <span key={t} className="rounded-full border border-primary-100 bg-cream-100 px-4 py-1.5 text-[13.5px] font-semibold text-primary-900">{t}</span>)}</div>;
  return (
    <div className="grid gap-6 lg:grid-cols-[310px_1fr] xl:grid-cols-[310px_1fr_420px]">
      <aside className="space-y-3">
        <Card className="overflow-hidden">
          <Img id={f.photoId} media={media} className="aspect-[306/312] w-full object-cover" sizes="310px" alt={`Portrait of ${f.fullName}`} priority />
          <div className="bg-gradient-to-r from-primary-800 to-primary-900 px-3 py-3 text-center text-white">
            <p className="font-serif text-[22px] font-bold">{f.fullName}</p>
            <p className="text-[14.5px]">{[f.designation, f.subject].filter(Boolean).join(' – ')}</p>
          </div>
        </Card>
        <Link href="/academics/faculty" className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-gold-300 to-gold-400 py-2.5 font-serif font-bold text-primary-900">‹ Back to Faculty</Link>
        {f.email && <a href={`mailto:${f.email}`} className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-primary-700 to-primary-900 py-2.5 font-serif font-bold text-white"><Mail className="h-4 w-4" />Email Faculty</a>}
        <Link href="/academics/faculty/directory" className="flex items-center justify-center gap-2 rounded-lg border-2 border-primary-800 bg-white py-2.5 font-serif font-bold text-primary-800"><UsersRound className="h-4 w-4" />View Faculty Directory</Link>
      </aside>
      <div className="min-w-0 space-y-5">
        <div className="border-l-4 border-gold-400 pl-4">
          <h2 className="font-serif text-[36px] font-bold leading-tight text-primary-800">{f.fullName}</h2>
          <p className="text-[17px] text-primary-900">{[f.designation, f.subject].filter(Boolean).join(' – ')}</p>
        </div>
        {facts.length > 0 && (
          <Card className="grid grid-cols-2 gap-y-3 px-2 py-4 sm:grid-cols-5">
            {facts.map(([ic, t], i) => <div key={i} className={clsx('flex flex-col items-center px-2 text-center', i > 0 && 'sm:border-l sm:border-primary-100')}><Icon name={ic} className="h-9 w-9 text-gold-500" strokeWidth={1.4} /><span className="mt-1 font-serif text-[14px] font-bold leading-tight text-primary-800">{t}</span></div>)}
          </Card>
        )}
        {f.about && <section><Heading icon="UserRound">About</Heading><p className="text-[15px] leading-relaxed text-primary-900">{f.about}</p></section>}
        {f.qualifications?.length > 0 && <section><Heading icon="GraduationCap">Academic Qualifications</Heading><Card className="p-4"><CheckList items={f.qualifications} /></Card></section>}
        {f.teachingAreas?.length > 0 && <section><Heading icon="BookOpen">Teaching Areas</Heading>{chips(f.teachingAreas)}</section>}
        {f.interests?.length > 0 && <section><Heading icon="Target">Areas of Interest</Heading>{chips(f.interests)}</section>}
      </div>
      <div className="space-y-5 lg:col-span-2 xl:col-span-1">
        {info.length > 0 && (
          <Card className="p-5">
            <Heading icon="Info">Key Information</Heading>
            <dl className="divide-y divide-primary-100">{info.map(([ic, l, v]) => <div key={l} className="flex items-center gap-3 py-2"><Icon name={ic} className="h-5 w-5 text-primary-800" /><dt className="flex-1 font-serif text-[14.5px] font-bold text-primary-800">{l}</dt><dd className="text-[14.5px] text-primary-900">{v}</dd></div>)}</dl>
          </Card>
        )}
        {f.development?.length > 0 && <Card className="p-5"><Heading icon="ChartColumn">Professional Development</Heading><TickList items={f.development} /></Card>}
        {f.achievements?.length > 0 && <Card className="p-5"><Heading icon="Trophy">Achievements & Contributions</Heading><TickList items={f.achievements} /></Card>}
      </div>
    </div>
  );
}

/** Trustee / committee member / administration profile (shared design). */
export function PersonProfile({ data, media }: { data: any; media: MediaMap; documents: DocMap }) {
  const p = data.person;
  const L = data.labels ?? {};
  const tabs = L.tabs ?? {};
  const info = [
    ['UsersRound', 'Designation', data.roleTitle],
    ['CalendarDays', 'Tenure', p.tenure],
    ['Briefcase', 'Profession', p.profession],
    ['GraduationCap', 'Education', p.education],
  ].filter(([, , v]) => v) as [string, string, string][];
  const about = (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
      <section>
        <Heading icon="UserRound">{L.aboutHeading ?? 'About'}</Heading>
        <RichHtml html={p.biography} className="text-[14.5px] leading-relaxed text-primary-900" />
        {!p.biography && p.shortBio && <p className="text-[14.5px] text-primary-900">{p.shortBio}</p>}
      </section>
      {info.length > 0 && (
        <Card className="h-fit p-5">
          <Heading>{L.keyInfoHeading ?? 'Key Information'}</Heading>
          <dl className="divide-y divide-primary-100">
            {info.map(([ic, l, v]) => (
              <div key={l} className="grid grid-cols-[24px_100px_1fr] items-center gap-2 py-2">
                <Icon name={ic} className="h-5 w-5 text-gold-500" />
                <dt className="font-serif text-[14px] font-bold text-primary-800">{l}</dt>
                <dd className="text-[13.5px] text-primary-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
      {p.focusAreas?.length > 0 && (
        <section className="xl:col-span-2">
          <Heading>{L.focusHeading ?? 'Focus Areas'}</Heading>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {p.focusAreas.map((f: any, i: number) => (
              <Card key={i} className="flex flex-col items-center px-2 py-4 text-center">
                <Icon name={f.icon} className="h-9 w-9 text-gold-500" strokeWidth={1.4} />
                <span className="mt-1 font-serif text-[14.5px] font-bold leading-tight text-primary-800">{f.label}</span>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
  const empty = <p className="text-[14px] text-primary-900/70">Information will be published soon.</p>;
  const tabList = [
    { id: 'profile', label: tabs.profile ?? 'Profile', icon: <UserRound className="h-4 w-4" aria-hidden />, content: about },
    {
      id: 'responsibilities',
      label: tabs.responsibilities ?? 'Role & Responsibilities',
      icon: <Icon name="Layers" className="h-4 w-4 text-current" />,
      content: (
        <div className="space-y-4">
          {data.roles.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {data.roles.map((r: any) => (
                <li key={r.committeeSlug}>
                  <Link href={r.href} className="rounded-full border border-primary-200 bg-white px-3 py-1 text-[13px] text-primary-800 hover:border-primary-500">{r.committee}: {r.roleTitle}</Link>
                </li>
              ))}
            </ul>
          )}
          {p.responsibilities?.length ? <CheckList items={p.responsibilities} /> : !data.roles.length && empty}
          {p.experience && <p className="text-[14.5px] text-primary-900">{p.experience}</p>}
        </div>
      ),
    },
    {
      id: 'affiliations',
      label: tabs.affiliations ?? 'Affiliations',
      icon: <Icon name="Link" className="h-4 w-4 text-current" />,
      content: p.affiliations?.length ? <TickList items={p.affiliations.map((a: any) => [a.name, a.role].filter(Boolean).join(' — '))} /> : empty,
    },
    {
      id: 'messages',
      label: tabs.messages ?? 'Messages',
      icon: <Icon name="MessageSquare" className="h-4 w-4 text-current" />,
      content: data.messages?.length ? (
        <div className="space-y-3">
          {data.messages.map((m: any) => (
            <Link key={m.key} href={m.href} className="block rounded-lg border border-primary-100 bg-cream-50 p-4 hover:shadow-card">
              <span className="font-serif font-bold text-primary-800">{m.heading}</span>
              <span className="block text-[14px] italic text-primary-900">{m.excerpt ?? m.quote}</span>
            </Link>
          ))}
        </div>
      ) : (
        empty
      ),
    },
  ];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/about/leadership-governance/${data.committee.slug}`} className="inline-flex items-center gap-2 font-serif text-[15px] font-bold text-primary-800 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          {L.backPrefix ?? 'Back to'} {data.committee.name}
        </Link>
        <div className="flex gap-2 print:hidden">
          <PrintButtonLabel label={L.downloadLabel ?? 'Download Profile (PDF)'} variant="gold" icon="Download" />
          <PrintButtonLabel label={L.printLabel ?? 'Print'} icon="Printer" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-[230px_1fr]">
        <Card className="h-fit overflow-hidden">
          <Img id={p.photoId} media={media} className="aspect-[160/207] w-full object-cover object-top" sizes="230px" alt={`Portrait of ${p.fullName}`} priority />
          <div className="bg-gradient-to-r from-primary-800 to-primary-900 px-3 py-3 text-center text-white">
            <p className="font-serif text-[20px] font-bold leading-tight">{p.fullName}</p>
            <p className="mt-1 flex items-center justify-center gap-2 text-[12.5px]">
              <span className="h-px w-4 bg-gold-400" />
              {data.roleTitle}
              <span className="h-px w-4 bg-gold-400" />
            </p>
          </div>
        </Card>
        <div className="min-w-0">
          <TabSet tabs={tabList} />
        </div>
      </div>
    </div>
  );
}

export { Clock, Printer, Button };
