import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowRight, ChevronRight, Download, Quote } from 'lucide-react';
import type { DocMap, MediaMap, Site } from '@/lib/api';
import { Button, Card, CheckList, DocList, Heading, Icon, Img, RichHtml, SmartLink } from '../ui';
import { Intro } from '../blocks/Blocks';

export interface TplProps {
  site: Site;
  page: any;
  extras: any;
  media: MediaMap;
  documents: DocMap;
  path: string;
}
const L = (list: any) => ((list ?? []) as any[]).filter(Boolean);

// ───────────────────────── About the School ─────────────────────────
export function AboutSchool({ page, media }: TplProps) {
  const c = page.content ?? {};
  return (
    <div className="space-y-6">
      <Intro intro={c.intro} />
      <Card className="grid grid-cols-2 gap-y-4 px-2 py-4 md:grid-cols-4">
        {L(c.features).map((f, i) => (
          <div key={i} className={clsx('flex items-center gap-3 px-4', i > 0 && 'md:border-l md:border-primary-100')}>
            <Icon name={f.icon} className="h-9 w-9 text-gold-500" strokeWidth={1.4} />
            <span className="font-serif text-[15px] font-bold leading-tight text-primary-800">{f.label}</span>
          </div>
        ))}
      </Card>
      {c.philosophy?.heading && (
        <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
          <div>
            <Heading icon="BookOpen">{c.philosophy.heading}</Heading>
            <p className="text-[14.5px] leading-relaxed text-primary-900">{c.philosophy.text}</p>
            <CheckList items={c.philosophy.points} className="mt-3" />
          </div>
          <Img id={c.philosophy.image} media={media} className="h-full max-h-[260px] w-full rounded-xl object-cover shadow-card" />
        </div>
      )}
      {L(c.facts).length > 0 && (
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-gradient-to-r from-primary-800 to-primary-900 px-6 py-5 text-white md:grid-cols-4">
          {L(c.facts).map((f, i) => (
            <div key={i} className={clsx('flex items-center gap-3', i > 0 && 'md:border-l md:border-white/25 md:pl-5')}>
              <Icon name={f.icon} className="h-10 w-10 text-gold-400" strokeWidth={1.4} />
              <span className="leading-tight">
                <span className={clsx('block', f.emphasis === 'line1' ? 'font-serif text-[24px] font-bold text-gold-400' : 'text-[14px]')}>{f.line1}</span>
                <span className={clsx('block', f.emphasis === 'line2' ? 'font-serif text-[22px] font-bold text-gold-400' : 'text-[14px]')}>{f.line2}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {L(c.explore?.cards).length > 0 && (
        <section>
          <Heading icon="Compass">{c.explore.heading}</Heading>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {L(c.explore.cards).map((x, i) => (
              <SmartLink key={i} href={x.href} className="group overflow-hidden rounded-xl border border-primary-100/70 bg-cream-50 shadow-card hover:shadow-lift">
                <div className="relative">
                  <Img id={x.image} media={media} className="aspect-[16/9] w-full object-cover" sizes="(max-width:768px) 50vw, 16vw" />
                  <span className="absolute -bottom-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow"><Icon name={x.icon} className="h-5 w-5 text-primary-800" /></span>
                </div>
                <p className="px-2 pb-3 pt-7 text-center font-serif text-[14px] font-bold leading-tight text-primary-800">{x.title}</p>
              </SmartLink>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ───────────────────────── History & Heritage ─────────────────────────
export function History({ page, media }: TplProps) {
  const c = page.content ?? {};
  return (
    <div className="space-y-6">
      <Intro intro={c.intro} />
      {c.legacy?.heading && (
        <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
          <div>
            <Heading icon="Landmark">{c.legacy.heading}</Heading>
            <p className="text-[14.5px] leading-relaxed text-primary-900">{c.legacy.text}</p>
          </div>
          <Img id={c.legacy.image} media={media} className="h-full max-h-[240px] w-full rounded-xl object-cover shadow-card" />
        </div>
      )}
      {L(c.milestones?.items).length > 0 && (
        <section>
          <Heading icon="CalendarDays">{c.milestones.heading}</Heading>
          <Card className="relative grid grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4 xl:grid-cols-7">
            <span className="absolute left-8 right-8 top-[58px] hidden h-0.5 bg-gold-400 xl:block" aria-hidden />
            {L(c.milestones.items).map((m, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                <span className="z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold-400 bg-white"><Icon name={m.icon} className="h-7 w-7 text-primary-800" /></span>
                <p className="mt-2 font-serif text-[20px] font-bold text-primary-800">{m.year}</p>
                <p className="text-[12.5px] leading-snug text-primary-900">{m.text}</p>
              </div>
            ))}
          </Card>
        </section>
      )}
      <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        {c.founders?.heading && (
          <Card className="p-5">
            <Heading icon="Users">{c.founders.heading}</Heading>
            <p className="text-[14px] leading-relaxed text-primary-900">{c.founders.text}</p>
            {c.founders.ctaLabel && <Button href={c.founders.ctaHref} variant="outline" className="mt-4 px-5 py-2 text-[14px]">{c.founders.ctaLabel}</Button>}
          </Card>
        )}
        {L(c.gallery?.images).length > 0 && (
          <section>
            <Heading icon="Image">{c.gallery.heading}</Heading>
            <div className="grid grid-cols-3 gap-3">
              {L(c.gallery.images).map((g, i) => (
                <figure key={i}>
                  <Img id={g.image} media={media} className="aspect-[4/3] w-full rounded-lg object-cover shadow-card" sizes="20vw" />
                  {g.caption && <figcaption className="mt-1 text-center text-[12.5px] text-primary-900">{g.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Vision, Mission & Values ─────────────────────────
export function VisionMission({ page, media }: TplProps) {
  const c = page.content ?? {};
  return (
    <div className="space-y-6">
      <Intro intro={c.intro} />
      <div className="grid gap-5 md:grid-cols-2">
        {[c.vision, c.mission].filter((x) => x?.title).map((x, i) => (
          <Card key={i} className="flex gap-4 p-6">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-800"><Icon name={x.icon} className="h-8 w-8 text-gold-400" /></span>
            <div>
              <p className="font-serif text-[24px] font-bold text-primary-800">{x.title}</p>
              {x.tagline && <p className="font-serif text-[16px] italic text-gold-600">{x.tagline}</p>}
              <p className="mt-1 text-[14.5px] leading-relaxed text-primary-900">{x.text}</p>
            </div>
          </Card>
        ))}
      </div>
      {L(c.values?.items).length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <section>
            <Heading icon="Gem">{c.values.heading}</Heading>
            {c.values.text && <p className="mb-3 text-[14.5px] text-primary-900">{c.values.text}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {L(c.values.items).map((v, i) => (
                <Card key={i} className="flex flex-col items-center p-4 text-center">
                  <Icon name={v.icon} className="h-10 w-10 text-gold-500" strokeWidth={1.4} />
                  <p className="mt-1 font-serif text-[16px] font-bold text-primary-800">{v.title}</p>
                  <p className="mt-1 text-[12.5px] leading-snug text-primary-900">{v.text}</p>
                </Card>
              ))}
            </div>
          </section>
          <Img id={c.values.image} media={media} className="h-full max-h-[420px] w-full rounded-xl object-cover shadow-card" />
        </div>
      )}
      {c.motto?.text && (
        <div className="rounded-xl bg-gradient-to-r from-primary-800 to-primary-900 py-6 text-center text-white">
          {c.motto.eyebrow && <p className="text-[12px] font-bold tracking-[0.3em] text-gold-400">{c.motto.eyebrow}</p>}
          <p className="font-serif text-[34px] font-bold tracking-wide">{c.motto.text}</p>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Leadership & Governance overview ─────────────────────────
function MessageTeaser({ m, media, label }: { m: any; media: MediaMap; label: string }) {
  if (!m) return null;
  const href = m.key === 'chairman' ? '/about/leadership-governance/chairmans-message' : '/about/leadership-governance/principals-message';
  return (
    <Card className="flex gap-4 overflow-hidden p-4">
      <Img id={m.person?.photoId} media={media} className="h-36 w-28 shrink-0 rounded-lg object-cover" sizes="112px" alt={m.person?.fullName} />
      <div className="flex flex-col">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gold-500">{m.eyebrow}</p>
        <p className="font-serif text-[19px] font-bold text-primary-800">{m.person?.fullName}</p>
        <p className="text-[13px] text-primary-900">{m.person?.roleTitle}</p>
        <p className="mt-2 flex-1 text-[13.5px] italic leading-snug text-primary-900">“{m.excerpt ?? m.quote}”</p>
        <Button href={href} variant="outline" className="mt-2 w-fit px-4 py-1.5 text-[13.5px]">{label}</Button>
      </div>
    </Card>
  );
}

export function LeadershipOverview({ page, extras, media }: TplProps) {
  const c = page.content ?? {};
  const trustees = L(extras?.trustees?.members).slice(0, Number(c.trustees?.count) || 5);
  return (
    <div className="space-y-6">
      <Intro intro={c.intro} />
      <div className="grid gap-4 md:grid-cols-2">
        <MessageTeaser m={extras?.chairman} media={media} label={c.messages?.ctaLabel ?? 'Read Message'} />
        <MessageTeaser m={extras?.principal} media={media} label={c.messages?.ctaLabel ?? 'Read Message'} />
      </div>
      {L(c.quickLinks).length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {L(c.quickLinks).map((q, i) => (
            <SmartLink key={i} href={q.href} className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-primary-800 to-primary-900 px-4 py-3 font-serif text-[15px] font-bold text-white hover:brightness-110">
              <Icon name={q.icon} className="h-7 w-7 text-gold-400" /> <span className="flex-1">{q.label}</span> <ChevronRight className="h-4 w-4" aria-hidden />
            </SmartLink>
          ))}
        </div>
      )}
      {trustees.length > 0 && (
        <section>
          <Heading icon="Users" action={<Link href="/about/leadership-governance/board-of-trustees" className="font-serif text-[13.5px] font-bold text-primary-800">{c.trustees?.ctaLabel ?? 'View All'} →</Link>}>{c.trustees?.heading}</Heading>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {trustees.map((t: any) => <PersonCard key={t.id} p={t} media={media} />)}
          </div>
        </section>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {c.executive?.heading && (
          <Card className="p-5">
            <Heading icon="Layers" action={<Link href="/about/leadership-governance/executive-committee" className="font-serif text-[13.5px] font-bold text-primary-800">{c.executive.ctaLabel ?? 'View All'} →</Link>}>{c.executive.heading}</Heading>
            <div className="flex gap-4">
              <Img id={c.executive.image} media={media} className="h-24 w-36 shrink-0 rounded-lg object-cover" sizes="150px" />
              <p className="text-[14px] text-primary-900">{c.executive.text}</p>
            </div>
          </Card>
        )}
        {L(c.administration?.items).length > 0 && (
          <Card className="p-5">
            <Heading icon="Network">{c.administration.heading}</Heading>
            <ul className="grid grid-cols-2 gap-2">
              {L(c.administration.items).map((a, i) => (
                <li key={i}><SmartLink href={a.href} className="flex items-center gap-2 text-[14px] font-semibold text-primary-900 hover:text-primary-600"><Icon name={a.icon} className="h-5 w-5 text-gold-500" />{a.label}</SmartLink></li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {c.governance?.heading && (
        <SmartLink href={c.governance.href} className="flex flex-col gap-3 rounded-xl bg-gradient-to-r from-primary-800 to-primary-900 px-6 py-5 text-white md:flex-row md:items-center">
          <Icon name="ShieldCheck" className="h-12 w-12 text-gold-400" strokeWidth={1.3} />
          <p className="font-serif text-[22px] font-bold md:w-1/4">{c.governance.heading}</p>
          <ul className="grid flex-1 gap-2 md:grid-cols-3">{L(c.governance.points).map((p, i) => <li key={i} className="flex items-center gap-2 text-[14px]"><Icon name="CircleCheck" className="h-5 w-5 text-gold-400" />{p}</li>)}</ul>
          <ArrowRight className="h-6 w-6" aria-hidden />
        </SmartLink>
      )}
    </div>
  );
}

export function PersonCard({ p, media }: { p: any; media: MediaMap }) {
  return (
    <Link href={p.href} className="group flex flex-col overflow-hidden rounded-xl border border-primary-100/70 bg-cream-50 text-center shadow-card hover:shadow-lift">
      <div className="bg-gradient-to-b from-primary-50 to-white"><Img id={p.photoId} media={media} className="mx-auto aspect-[196/119] h-full w-full object-cover object-top" sizes="(max-width:768px) 50vw, 15vw" alt={`Portrait of ${p.fullName}`} /></div>
      <div className="flex flex-1 flex-col px-2 py-3">
        <p className="font-serif text-[15px] font-bold leading-tight text-primary-800">{p.fullName}</p>
        <p className="mt-0.5 flex-1 text-[12.5px] text-primary-900">{p.roleTitle}</p>
        <span className="mx-auto mt-2 inline-flex items-center gap-1 font-serif text-[12.5px] font-bold text-primary-700 group-hover:underline">View Profile <ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
      </div>
    </Link>
  );
}

// ───────────────────────── Leadership messages (shared design for all messages) ─────────────────────────
export function LeadershipMessage({ extras, media, documents }: TplProps) {
  const m = extras?.message;
  if (!m) return <p className="text-primary-900">This message will be published soon.</p>;
  const pdf = m.pdfDocumentId ? documents[m.pdfDocumentId] : null;
  return (
    <div className="grid gap-6 md:grid-cols-[250px_1fr]">
      <div className="space-y-3">
        <Card className="overflow-hidden">
          <Img id={m.person?.photoId} media={media} className="aspect-[238/308] w-full object-cover" sizes="250px" alt={m.person?.fullName} priority />
          <div className="bg-gradient-to-r from-primary-800 to-primary-900 px-3 py-3 text-center text-white">
            <p className="font-serif text-[18px] font-bold">{m.person?.fullName}</p>
            <p className="text-[13px] text-white/90">{m.person?.roleTitle}</p>
          </div>
        </Card>
        {m.person?.href && <Button href={m.person.href} variant="outline" className="w-full px-3 py-2 text-[14px]">View Profile</Button>}
        {pdf && <a href={pdf.url ?? '#'} target="_blank" rel="noopener" className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-gold-300 to-gold-400 px-3 py-2 font-serif text-[14px] font-bold text-primary-900"><Download className="h-4 w-4" />Download (PDF)</a>}
      </div>
      <article>
        {m.eyebrow && <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gold-500"><span className="h-px w-8 bg-gold-400" />{m.eyebrow}</p>}
        <h2 className="font-serif text-[36px] font-bold text-primary-800">{m.heading}</h2>
        {m.salutation && <p className="mt-3 font-serif text-[16px] font-bold text-primary-800">{m.salutation}</p>}
        <RichHtml html={m.body} className="mt-2 text-[15px] leading-relaxed text-primary-900" />
        {m.signatureImageId && <Img id={m.signatureImageId} media={media} className="mt-4 h-12 w-auto mix-blend-multiply" alt="Signature" />}
        <p className="font-serif text-[16px] font-bold text-primary-800">{m.person?.fullName}</p>
        {m.signatoryTitle && <p className="text-[13.5px] text-primary-900">{m.signatoryTitle}</p>}
        {m.quote && (
          <blockquote className="mt-6 flex gap-4 rounded-xl bg-gradient-to-r from-primary-800 to-primary-900 px-6 py-5 text-white">
            <Quote className="h-10 w-10 shrink-0 text-gold-400" aria-hidden />
            <p className="font-serif text-[18px] italic leading-snug">{m.quote}</p>
          </blockquote>
        )}
      </article>
    </div>
  );
}

// ───────────────────────── Committee directories ─────────────────────────
export function CommitteeDirectory({ page, extras, media }: TplProps) {
  const c = page.content ?? {};
  const members = L(extras?.committee?.members);
  const head = members.find((m) => m.isHead);
  const rest = members.filter((m) => m !== head);
  return (
    <div className="space-y-5">
      <Intro intro={c.intro} />
      {head && (
        <Card className="flex flex-col gap-5 p-4 sm:flex-row">
          <Img id={head.photoId} media={media} className="h-48 w-40 shrink-0 rounded-lg object-cover object-top" sizes="160px" alt={`Portrait of ${head.fullName}`} />
          <div className="flex flex-col justify-center">
            <p className="font-serif text-[24px] font-bold text-primary-800">{head.fullName}</p>
            <p className="font-semibold text-gold-600">{head.roleTitle}</p>
            {head.shortBio && <p className="mt-2 text-[14px] text-primary-900">{head.shortBio}</p>}
            <Button href={head.href} className="mt-3 w-fit px-4 py-2 text-[14px]">View Profile</Button>
          </div>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{rest.map((m: any) => <PersonCard key={m.id} p={m} media={media} />)}</div>
    </div>
  );
}

export function ExecutiveCommittee({ page, extras, media }: TplProps) {
  const c = page.content ?? {};
  return (
    <div className="space-y-5">
      <Intro intro={c.intro} />
      <section>
        <Heading icon="Users">{c.membersHeading}</Heading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{L(extras?.committee?.members).map((m: any) => <PersonCard key={m.id} p={m} media={media} />)}</div>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        {c.mandate?.heading && <Card className="p-5"><Heading icon={c.mandate.icon}>{c.mandate.heading}</Heading><p className="text-[14.5px] text-primary-900">{c.mandate.text}</p></Card>}
        {c.responsibilities?.heading && <Card className="p-5"><Heading icon={c.responsibilities.icon}>{c.responsibilities.heading}</Heading><CheckList items={c.responsibilities.items} /></Card>}
      </div>
    </div>
  );
}

export function SchoolAdministration({ page, extras, media }: TplProps) {
  const c = page.content ?? {};
  const p = extras?.principal;
  const members = L(extras?.committee?.members);
  return (
    <div className="space-y-5">
      <Intro intro={c.intro} />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {p && (
          <Card className="flex gap-4 p-4">
            <Img id={p.person?.photoId} media={media} className="h-40 w-32 shrink-0 rounded-lg object-cover object-top" sizes="130px" alt={p.person?.fullName} />
            <div>
              <Heading icon="MessageSquare">{c.principal?.heading}</Heading>
              <p className="text-[14px] italic text-primary-900">“{p.excerpt ?? p.quote}”</p>
              <p className="mt-2 font-serif font-bold text-primary-800">{p.person?.fullName}</p>
              <p className="text-[13px] text-primary-900">{p.person?.roleTitle}</p>
              <Button href="/about/leadership-governance/principals-message" variant="outline" className="mt-3 px-4 py-1.5 text-[13.5px]">{c.principal?.ctaLabel ?? 'Read Full Message'}</Button>
            </div>
          </Card>
        )}
        <div className="space-y-5">
          {c.focus?.heading && <Card className="p-5"><Heading icon={c.focus.icon}>{c.focus.heading}</Heading><CheckList items={c.focus.items} /></Card>}
          {c.structure?.heading && (
            <Card className="p-5">
              <Heading icon={c.structure.icon}>{c.structure.heading}</Heading>
              <p className="text-[14px] text-primary-900">{c.structure.text}</p>
              {c.structure.ctaLabel && <Button href={c.structure.ctaHref} variant="outline" className="mt-3 px-4 py-1.5 text-[13.5px]">{c.structure.ctaLabel}</Button>}
            </Card>
          )}
        </div>
      </div>
      <section>
        <Heading icon="UsersRound">{c.teamHeading}</Heading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{members.filter((m) => !m.isHead).map((m: any) => <PersonCard key={m.id} p={m} media={media} />)}</div>
      </section>
      {L(c.departments?.items).length > 0 && (
        <section>
          <Heading icon="Building2">{c.departments.heading}</Heading>
          <Card className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-5 xl:grid-cols-9">
            {L(c.departments.items).map((d, i) => <div key={i} className="flex flex-col items-center text-center"><Icon name={d.icon} className="h-9 w-9 text-primary-800" strokeWidth={1.4} /><span className="mt-1 text-[12.5px] font-semibold text-primary-900">{d.label}</span></div>)}
          </Card>
        </section>
      )}
    </div>
  );
}

// ───────────────────────── Governance framework ─────────────────────────
export function GovernanceFramework({ page, documents }: TplProps) {
  const c = page.content ?? {};
  const tiers = L(c.model?.tiers);
  return (
    <div className="space-y-5">
      <Intro intro={c.intro} />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          {c.overview?.heading && <Card className="p-5"><Heading icon={c.overview.icon}>{c.overview.heading}</Heading><p className="text-[14.5px] text-primary-900">{c.overview.text}</p></Card>}
          {c.principles?.heading && <Card className="p-5"><Heading icon={c.principles.icon}>{c.principles.heading}</Heading><CheckList items={c.principles.items} /></Card>}
        </div>
        {tiers.length > 0 && (
          <Card className="p-5">
            <Heading icon={c.model.icon}>{c.model.heading}</Heading>
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex flex-1 items-center gap-3 rounded-lg px-4 py-3 text-white" style={{ marginLeft: `${(tiers.length - 1 - i) * 0}%`, background: `rgb(var(--p-${[950, 800, 600][i] ?? 600}))`, clipPath: i === 0 ? 'polygon(12% 0, 88% 0, 100% 100%, 0 100%)' : undefined }}>
                    <Icon name={t.icon} className="h-7 w-7 text-gold-400" />
                    <span><span className="block font-serif text-[16px] font-bold">{t.title}</span><span className="text-[12.5px]">{t.subtitle}</span></span>
                  </div>
                  <p className="w-40 text-[12.5px] text-primary-900">{t.note}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        {c.structure?.heading && (
          <Card className="p-5">
            <Heading icon={c.structure.icon}>{c.structure.heading}</Heading>
            <p className="text-[14px] text-primary-900">{c.structure.text}</p>
            {c.structure.ctaLabel && <Button href={c.structure.ctaHref} variant="outline" className="mt-3 px-4 py-1.5 text-[13.5px]">{c.structure.ctaLabel}</Button>}
          </Card>
        )}
        {L(c.decision?.steps).length > 0 && (
          <Card className="p-5">
            <Heading icon={c.decision.icon}>{c.decision.heading}</Heading>
            <ol className="flex flex-wrap items-center gap-2">
              {L(c.decision.steps).map((s, i, arr) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex w-28 flex-col items-center text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50"><Icon name={s.icon} className="h-6 w-6 text-primary-800" /></span><span className="mt-1 font-serif text-[13px] font-bold text-primary-800">{s.title}</span><span className="text-[11.5px] text-primary-900">{s.subtitle}</span></span>
                  {i < arr.length - 1 && <ArrowRight className="h-5 w-5 text-gold-500" aria-hidden />}
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
      {c.policies?.heading && (
        <Card className="p-5">
          <Heading icon={c.policies.icon}>{c.policies.heading}</Heading>
          {c.policies.text && <p className="mb-2 text-[14px] text-primary-900">{c.policies.text}</p>}
          <div className="grid gap-x-8 md:grid-cols-2"><DocList docs={documents} ids={c.policies.documents} /></div>
        </Card>
      )}
    </div>
  );
}

// ───────────────────────── Why choose / Our impact ─────────────────────────
export function WhyChoose({ page, media }: TplProps) {
  const c = page.content ?? {};
  return (
    <div className="space-y-5">
      <Intro intro={c.intro} />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {L(c.features).map((f, i) => (
            <Card key={i} className="p-4">
              <Icon name={f.icon} className="h-10 w-10 text-gold-500" strokeWidth={1.4} />
              <p className="mt-1 font-serif text-[16px] font-bold leading-tight text-primary-800">{f.title}</p>
              <p className="mt-1 text-[13px] leading-snug text-primary-900">{f.text}</p>
            </Card>
          ))}
        </div>
        <Img id={c.image} media={media} className="h-full max-h-[360px] w-full rounded-xl object-cover shadow-card" />
      </div>
      {L(c.strip).length > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-gradient-to-r from-primary-800 to-primary-900 px-5 py-4 text-white sm:grid-cols-3 xl:grid-cols-6">
          {L(c.strip).map((s, i) => (
            <div key={i} className={clsx('flex items-center gap-2', i > 0 && 'xl:border-l xl:border-white/25 xl:pl-3')}>
              <Icon name={s.icon} className="h-8 w-8 text-gold-400" strokeWidth={1.4} />
              <span className="leading-tight">{s.value && <span className="block font-serif text-[17px] font-bold text-gold-400">{s.value}</span>}<span className="text-[13.5px]">{s.label}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OurImpact({ page, extras, media }: TplProps) {
  const c = page.content ?? {};
  const stats = L(extras?.statistics);
  const story = L(extras?.stories)[0];
  return (
    <div className="space-y-5">
      <Intro intro={c.intro} />
      {stats.length > 0 && (
        <Card className="grid grid-cols-2 gap-y-4 px-2 py-4 sm:grid-cols-3 xl:grid-cols-6">
          {stats.map((s: any, i: number) => (
            <div key={s.key} className={clsx('flex flex-col items-center px-2 text-center', i > 0 && 'xl:border-l xl:border-primary-100')}>
              <Icon name={s.icon} className="h-9 w-9 text-gold-500" strokeWidth={1.4} />
              <p className="mt-1 font-serif text-[22px] font-bold leading-tight text-primary-800">{s.value}</p>
              <p className="text-[12.5px] text-primary-900">{s.label}</p>
            </div>
          ))}
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr_1.2fr]">
        {c.keyAreas?.heading && <Card className="p-5"><Heading icon={c.keyAreas.icon}>{c.keyAreas.heading}</Heading><CheckList items={c.keyAreas.items} /></Card>}
        <Card className="p-5">
          <Heading icon={c.stories?.icon} action={c.stories?.ctaLabel && <SmartLink href={c.stories.ctaHref} className="font-serif text-[13px] font-bold text-primary-800">{c.stories.ctaLabel} →</SmartLink>}>{c.stories?.heading}</Heading>
          {story ? (
            <div className="flex gap-4">
              <Img id={story.photoId} media={media} className="h-36 w-28 shrink-0 rounded-lg object-cover" sizes="112px" alt={story.name} />
              <div><p className="text-[14px] italic text-primary-900">“{story.quote}”</p><p className="mt-2 font-serif font-bold text-primary-800">{story.name}</p><p className="text-[12.5px] text-primary-900">{story.subtitle}</p>{story.detail && <p className="text-[12.5px] font-semibold text-gold-600">{story.detail}</p>}</div>
            </div>
          ) : <p className="text-sm text-primary-900/70">Stories will be published soon.</p>}
        </Card>
        {c.alumni?.heading && (
          <Card className="p-5">
            <Heading icon={c.alumni.icon}>{c.alumni.heading}</Heading>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="mb-2 text-[13.5px] text-primary-900">{c.alumni.text}</p>
                <ul className="space-y-1.5">{L(c.alumni.sectors).map((s, i) => <li key={i} className="flex items-center gap-2 text-[13px] text-primary-900"><Icon name={s.icon} className="h-4 w-4 text-primary-800" />{s.label}</li>)}</ul>
              </div>
              <Img id={c.alumni.image} media={media} className="hidden w-28 rounded-lg object-cover sm:block" sizes="112px" />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Generic page used until an approved design exists (legal pages, etc.). */
export function Standard({ page }: TplProps) {
  const c = page.content ?? {};
  return (
    <div className="space-y-5">
      <Intro intro={c.intro} />
      {c.body ? <Card className="p-6"><RichHtml html={c.body} className="text-[15px] leading-relaxed text-primary-900" /></Card> : <Card className="p-6 text-center text-primary-900/70">Content for this page will be published soon.</Card>}
    </div>
  );
}
