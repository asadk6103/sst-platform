import Link from 'next/link';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { ChevronRight, Home, Mail, MapPin, Phone } from 'lucide-react';
import { siteUrl, type MediaMap, type NavItem, type Site } from '@/lib/api';
import { contains, isActive, sectionRoot, trail } from '@/lib/nav';
import { Button, Icon, Img, SmartLink } from './ui';
import { PrintButton } from './client';


// ───────── Hero banner ─────────
export function Hero({ site, eyebrow, title, subtitle, imageId, media }: { site: Site; eyebrow?: string; title: string; subtitle?: string | null; imageId?: string | null; media: MediaMap }) {
  const img = imageId ?? site.settings.website?.defaultHeroImage;
  return (
    <section className="relative overflow-hidden bg-primary-900 text-white">
      <div className="absolute inset-y-0 right-0 w-full md:w-[68%]">
        <Img id={img} media={{ ...site.media, ...media }} className="h-full w-full object-cover" sizes="(max-width: 768px) 100vw, 70vw" priority alt="" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-primary-900 via-primary-900/85 to-primary-900/10 md:via-primary-900/70 md:to-transparent" aria-hidden />
      <div className="relative mx-auto max-w-site px-4 py-6 sm:px-8 sm:py-7 lg:px-[88px]">
        {eyebrow && (
          <p className="mb-1 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-gold-400">
            <span className="h-px w-8 bg-gold-400" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-[34px] font-bold leading-tight sm:text-[44px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[520px] text-[14.5px] leading-snug text-white/95">{subtitle}</p>}
      </div>
    </section>
  );
}

// ───────── Breadcrumb + share bar ─────────
export function Crumbs({ site, path, current, extra, share = true }: { site: Site; path: string; current: string; extra?: { label: string; href: string }[]; share?: boolean }) {
  const items = trail(site.navigation.MAIN ?? [], path);
  const crumbs = [...items.map((i) => ({ label: i.label, href: i.href })), ...(extra ?? [])];
  // Avoid repeating the section and its "Overview" item (same URL).
  const dedup = crumbs.filter((c, i) => i === 0 || c.href !== crumbs[i - 1]!.href);
  // Detail pages pass their own trail (extra); otherwise the page title is the last crumb.
  if (!extra?.length && (!dedup.length || dedup.at(-1)!.label !== current)) dedup.push({ label: current, href: path });
  const url = encodeURIComponent(`${siteUrl(site)}${path}`);
  const showShare = share && site.settings.website?.showShareBar !== false;
  return (
    <div className="border-b border-primary-50 bg-[#f8f6f9] print:hidden">
      <div className="mx-auto flex max-w-site flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-8 lg:px-[88px]">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 font-serif text-[13.5px] font-bold text-primary-800">
            <li><Link href="/" className="flex items-center gap-2 hover:text-primary-600"><Home className="h-5 w-5" aria-hidden /><span>Home</span></Link></li>
            {dedup.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4" aria-hidden />
                {i === dedup.length - 1 ? <span aria-current="page">{c.label}</span> : <Link href={c.href} className="hover:text-primary-600">{c.label}</Link>}
              </li>
            ))}
          </ol>
        </nav>
        {showShare && (
          <div className="flex items-center gap-2.5">
            <span className="font-serif text-[13.5px] font-bold text-primary-800">Share:</span>
            {[
              ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${url}`, 'f'],
              ['X', `https://twitter.com/intent/tweet?url=${url}`, '𝕏'],
              ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${url}`, 'in'],
            ].map(([name, href, glyph]) => (
              <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${name}`} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-800 font-serif text-[14px] font-bold text-primary-800 hover:bg-primary-800 hover:text-white">
                {glyph}
              </a>
            ))}
            <PrintButton />
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── Section sidebar ─────────
export function SectionNav({ site, path }: { site: Site; path: string }) {
  const root = sectionRoot(site.navigation.MAIN ?? [], path);
  if (!root || !root.children.length) return null;
  const link = (it: NavItem) => (it.isComingSoon ? `/coming-soon?from=${encodeURIComponent(it.href)}` : it.href);
  // Exactly one active item: the deepest match.
  const t = trail(root.children, path);
  const activeId = t.at(-1)?.id;
  return (
    <nav aria-label={`${root.label} section`} className="rounded-xl border border-primary-100/70 bg-cream-50 p-2 shadow-card print:hidden">
      {root.icon && (
        <p className="flex items-center gap-3 px-3 pb-2 pt-3 font-serif text-[21px] font-bold text-primary-800">
          <Icon name={root.icon} className="h-8 w-8 text-gold-500" /> {root.label}
        </p>
      )}
      <ul className="space-y-0.5">
        {root.children.map((it) => {
          const active = it.id === activeId;
          const expanded = it.children.length > 0 && (contains(it, path) || t.some((x) => x.id === it.id));
          return (
            <li key={it.id}>
              <Link
                href={link(it)}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 font-serif text-[15.5px] font-bold transition',
                  active ? 'bg-gradient-to-r from-primary-900 to-primary-700 text-white shadow' : expanded ? 'bg-gradient-to-r from-primary-900 to-primary-700 text-white' : 'text-primary-800 hover:bg-primary-50',
                )}
              >
                <Icon name={it.icon} className={clsx('h-6 w-6', active || expanded ? 'text-gold-300' : 'text-gold-500')} />
                <span className="flex-1">{it.label}</span>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
              {expanded && (
                <ul className="mb-1 mt-1 space-y-0.5 pl-5">
                  {it.children.map((c) => {
                    const on = c.id === activeId || (isActive(c.href, path) && !activeId);
                    return (
                      <li key={c.id}>
                        <Link href={link(c)} aria-current={on ? 'page' : undefined} className={clsx('flex items-center gap-3 rounded-md px-3 py-1.5 text-[13.5px]', on ? 'bg-primary-100 font-bold text-primary-900' : 'text-primary-900 hover:bg-primary-50')}>
                          <span className={clsx('flex h-4 w-4 items-center justify-center rounded-full border-2', on ? 'border-primary-800 bg-primary-800' : 'border-primary-300')} aria-hidden>
                            {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          {c.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SidebarCard({ card, children }: { card?: { icon?: string; heading?: string; text?: string; ctaLabel?: string; ctaHref?: string } | null; children?: ReactNode }) {
  if (!card?.heading && !children) return null;
  return (
    <div className="rounded-xl border border-primary-100/70 bg-cream-50 px-6 py-7 text-center shadow-card print:hidden">
      <Icon name={card?.icon} className="mx-auto mb-2 h-12 w-12 text-primary-800" strokeWidth={1.4} />
      {card?.heading && <p className="font-serif text-[22px] font-bold leading-tight text-primary-800">{card.heading}</p>}
      {card?.text && <p className="mt-2 text-[14.5px] leading-snug text-primary-900">{card.text}</p>}
      {children}
      {card?.ctaLabel && card.ctaHref && (
        <Button href={card.ctaHref} className="mt-4 w-full">
          {card.ctaLabel}
        </Button>
      )}
    </div>
  );
}

// ───────── Closing quote banner ─────────
export function QuoteBanner({ banner, site }: { banner?: { icon?: string | null; line1?: string; line2?: string; quote?: string; ctaLabel?: string; ctaHref?: string } | null; site: Site }) {
  if (!banner?.quote && !banner?.line1) return null;
  const art = site.settings.website?.sketchImage;
  return (
    <section className="mx-auto max-w-site px-4 pb-6 pt-2 sm:px-8 lg:px-[40px] 2xl:px-[56px] print:hidden" aria-label="Highlight">
      <div className="relative flex min-h-[84px] flex-col items-center gap-4 overflow-hidden rounded-xl bg-gradient-to-r from-primary-800 via-primary-900 to-primary-800 px-6 py-4 text-white md:flex-row md:gap-6 md:px-10">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 opacity-25 mix-blend-screen" aria-hidden>
          <Img id={art} media={site.media} className="h-full w-full object-cover" alt="" />
        </div>
        {banner.line1 ? (
          <div className="relative flex items-center gap-4 md:w-[30%]">
            <Icon name={banner.icon} className="h-11 w-11 text-gold-400" strokeWidth={1.4} />
            <p className="font-serif text-[21px] font-bold leading-tight">
              {banner.line1}
              {banner.line2 && <span className="block text-[24px] text-gold-400">{banner.line2}</span>}
            </p>
          </div>
        ) : (
          <div className="hidden md:block md:w-[30%]" />
        )}
        <span className="relative hidden h-12 w-0.5 bg-gold-400 md:block" aria-hidden />
        <p className="relative flex-1 text-center font-serif text-[19px] italic leading-snug md:text-[22px]">{banner.quote}</p>
        <div className="relative flex items-center gap-1">
          <span className="text-3xl text-gold-400" aria-hidden>❦</span>
          {banner.ctaLabel ? (
            <SmartLink href={banner.ctaHref} className="rounded-lg bg-gradient-to-b from-gold-300 to-gold-400 px-6 py-2.5 font-serif text-[17px] font-bold uppercase text-primary-900 shadow hover:brightness-105">
              {banner.ctaLabel} →
            </SmartLink>
          ) : (
            <span className="rounded-lg bg-gradient-to-b from-gold-300 to-gold-400 px-7 py-2.5 font-serif text-[20px] font-bold uppercase tracking-wide text-primary-900 shadow">{site.settings.identity?.motto ?? 'EXCEL TO LEAD'}</span>
          )}
          <span className="-scale-x-100 text-3xl text-gold-400" aria-hidden>❦</span>
        </div>
      </div>
    </section>
  );
}

// ───────── Page frame: hero, breadcrumb, sidebar + content, banner ─────────
export function PageFrame({
  site,
  path,
  hero,
  sidebar = true,
  sidebarCard,
  sidebarExtra,
  banner,
  children,
  crumbExtra,
  media = {},
}: {
  site: Site;
  path: string;
  hero: { eyebrow?: string; title: string; subtitle?: string | null; imageId?: string | null };
  sidebar?: boolean;
  sidebarCard?: any;
  sidebarExtra?: ReactNode;
  banner?: any;
  children: ReactNode;
  crumbExtra?: { label: string; href: string }[];
  media?: MediaMap;
}) {
  return (
    <>
      <Hero site={site} media={media} {...hero} />
      <Crumbs site={site} path={path} current={hero.title} extra={crumbExtra} />
      <div className="relative">
        <SketchArt site={site} />
        <div className={clsx('relative mx-auto max-w-site px-4 py-6 sm:px-8 lg:px-[40px] 2xl:px-[56px]', sidebar && 'flex flex-col lg:grid lg:grid-cols-[290px_1fr] lg:gap-6')}>
          {sidebar && (
            <aside className="order-2 mt-8 space-y-5 lg:order-none lg:mt-0">
              <SectionNav site={site} path={path} />
              {sidebarExtra}
              <SidebarCard card={sidebarCard} />
            </aside>
          )}
          <div className="min-w-0">{children}</div>
        </div>
      </div>
      <QuoteBanner banner={banner} site={site} />
    </>
  );
}

function SketchArt({ site }: { site: Site }) {
  const id = site.settings.website?.sketchImage;
  if (!id) return null;
  return (
    <div className="pointer-events-none absolute right-6 top-4 hidden w-[340px] opacity-[0.12] mix-blend-multiply 2xl:block" aria-hidden>
      <Img id={id} media={site.media} alt="" className="w-full" />
    </div>
  );
}

// ───────── Footer ─────────
export function Footer({ site }: { site: Site }) {
  const s = site.settings;
  const id = s.identity ?? {};
  const contact = s.contact ?? {};
  const social = s.social ?? {};
  const year = new Date().getFullYear();
  const cols = [
    ['Quick Links', site.navigation.FOOTER_QUICK ?? []],
    ['Useful Links', site.navigation.FOOTER_USEFUL ?? []],
  ] as const;
  const socials = [
    ['facebook', 'Facebook', 'f'],
    ['instagram', 'Instagram', '◎'],
    ['youtube', 'YouTube', '▶'],
    ['linkedin', 'LinkedIn', 'in'],
    ['x', 'X', '𝕏'],
  ].filter(([k]) => social[k!]);
  return (
    <footer className="bg-primary-900 text-white print:hidden">
      <div className="mx-auto grid max-w-site gap-8 px-4 py-6 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr_0.9fr] lg:px-[80px]">
        <div className="flex items-center gap-4">
          <Img id={id.logo} media={site.media} className="h-24 w-24 rounded-full bg-white object-contain" alt="SST logo" />
          <div className="font-serif leading-tight">
            <p className="text-[15px]">{id.nameLine1}</p>
            <p className="text-[18px]">{id.nameLine2}</p>
            <p className="mt-1 text-[11px] tracking-[0.45em]">{id.nameLine3}</p>
            {id.motto && <p className="mt-2 flex items-center gap-2 text-[11px] tracking-[0.25em]"><span className="h-0.5 w-8 bg-gold-400" />{id.motto}<span className="h-0.5 w-8 bg-gold-400" /></p>}
          </div>
        </div>
        {cols.map(([title, items]) => (
          <div key={title} className="lg:border-l lg:border-white/20 lg:pl-8">
            <p className="mb-2 font-serif text-[16px] font-bold">{title}</p>
            <ul className="space-y-1 text-[13.5px]">
              {items.map((i) => (
                <li key={i.id}><SmartLink href={i.href} comingSoon={i.isComingSoon} className="hover:text-gold-300">› {i.label}</SmartLink></li>
              ))}
            </ul>
          </div>
        ))}
        <div className="lg:border-l lg:border-white/20 lg:pl-8">
          <p className="mb-2 font-serif text-[16px] font-bold">Get in Touch</p>
          <ul className="space-y-1.5 text-[13.5px]">
            {contact.address && <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="whitespace-pre-line">{contact.address}</span></li>}
            {contact.phone && <li><a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="flex gap-2 hover:text-gold-300"><Phone className="h-4 w-4" aria-hidden />{contact.phone}</a></li>}
            {contact.email && <li><a href={`mailto:${contact.email}`} className="flex gap-2 hover:text-gold-300"><Mail className="h-4 w-4" aria-hidden />{contact.email}</a></li>}
          </ul>
        </div>
        <div className="lg:border-l lg:border-white/20 lg:pl-8">
          {socials.length > 0 && (
            <>
              <p className="mb-2 font-serif text-[16px] font-bold">Follow Us</p>
              <ul className="flex flex-wrap gap-2.5">
                {socials.map(([k, name, glyph]) => (
                  <li key={k}>
                    <a href={social[k!]} target="_blank" rel="noopener noreferrer" aria-label={name} className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-bold text-primary-900 hover:bg-gold-300">{glyph}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-site flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] sm:px-8 lg:px-[56px]">
          <p>{(id.copyright ?? '© {year} SST Public School Rashidabad.').replace('{year}', String(year))}</p>
          <ul className="flex items-center">
            {(site.navigation.FOOTER_LEGAL ?? []).map((l, i) => (
              <li key={l.id} className="flex items-center">
                {i > 0 && <span className="mx-4 h-3.5 w-px bg-white/50" aria-hidden />}
                <SmartLink href={l.href} className="hover:text-gold-300">{l.label}</SmartLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
