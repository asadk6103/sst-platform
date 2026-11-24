import Link from 'next/link';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { ArrowRight, Check, ChevronRight, CircleCheck, Download, FileText } from 'lucide-react';
import { ICONS } from '@/lib/icons';
import type { Doc, Media, MediaMap } from '@/lib/api';
import { fmtSize, isExternal } from '@/lib/format';

/** Renders an icon chosen in the CMS (gold by default, as in the designs). */
export function Icon({ name, className, strokeWidth = 1.6 }: { name?: string | null; className?: string; strokeWidth?: number }) {
  const C = name ? ICONS[name] : null;
  return C ? <C aria-hidden className={clsx('shrink-0', className ?? 'h-6 w-6 text-gold-500')} strokeWidth={strokeWidth} /> : null;
}

/** Responsive image from the media library; renders nothing when the image is missing. */
export function Img({ id, media, className, sizes = '(max-width: 768px) 100vw, 50vw', alt, priority }: { id?: string | null; media: MediaMap; className?: string; sizes?: string; alt?: string; priority?: boolean }) {
  const m: Media | undefined = id ? media[id] : undefined;
  if (!m) return null;
  const srcSet = m.variants.length ? m.variants.map((v) => `${v.url} ${v.width}w`).join(', ') : undefined;
  const src = m.variants.find((v) => v.width >= 960)?.url ?? m.variants.at(-1)?.url ?? m.url;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} srcSet={srcSet} sizes={sizes} alt={alt ?? m.alt ?? ''} width={m.width ?? undefined} height={m.height ?? undefined} loading={priority ? 'eager' : 'lazy'} decoding="async" className={className} />
  );
}

/** Internal/external link that also handles CMS "coming soon" items. */
export function SmartLink({ href, children, className, comingSoon, newTab, ariaLabel }: { href?: string | null; children: ReactNode; className?: string; comingSoon?: boolean; newTab?: boolean; ariaLabel?: string }) {
  if (comingSoon) return <Link href={`/coming-soon?from=${encodeURIComponent(href ?? '')}`} className={className} aria-label={ariaLabel}>{children}</Link>;
  if (!href) return <span className={className}>{children}</span>;
  if (isExternal(href) || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('/uploads/'))
    return <a href={href} className={className} aria-label={ariaLabel} {...(newTab || isExternal(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
  return <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>;
}

export function Card({ children, className, as: As = 'div', id }: { children: ReactNode; className?: string; as?: any; id?: string }) {
  return <As id={id} className={clsx('rounded-xl border border-primary-100/70 bg-cream-50 shadow-card', className)}>{children}</As>;
}

/** Section heading: gold icon + serif title, as used throughout the designs. */
export function Heading({ icon, children, className, as: As = 'h2', action }: { icon?: string | null; children: ReactNode; className?: string; as?: any; action?: ReactNode }) {
  if (!children) return null;
  return (
    <div className={clsx('mb-3 flex items-center justify-between gap-3', className)}>
      <As className="flex items-center gap-2.5 font-serif text-[22px] font-bold leading-tight text-primary-800">
        <Icon name={icon} className="h-7 w-7 text-gold-500" />
        {children}
      </As>
      {action}
    </div>
  );
}

export function Eyebrow({ children, light }: { children?: ReactNode; light?: boolean }) {
  if (!children) return null;
  return (
    <p className={clsx('mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider', light ? 'text-gold-400' : 'text-gold-500')}>
      <span className="h-px w-7 bg-current" aria-hidden />
      {children}
    </p>
  );
}

export function Button({ href, children, variant = 'primary', className, icon = true, comingSoon }: { href?: string | null; children: ReactNode; variant?: 'primary' | 'outline' | 'gold'; className?: string; icon?: boolean; comingSoon?: boolean }) {
  const styles = {
    primary: 'bg-gradient-to-b from-primary-700 to-primary-900 text-white hover:from-primary-600 hover:to-primary-800 shadow-sm',
    outline: 'border-2 border-primary-700 bg-white text-primary-800 hover:bg-primary-50',
    gold: 'bg-gradient-to-b from-gold-300 to-gold-400 text-primary-900 hover:from-gold-400 hover:to-gold-500 shadow',
  }[variant];
  return (
    <SmartLink href={href} comingSoon={comingSoon} className={clsx('inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-serif text-[15px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400', styles, className)}>
      {children}
      {icon && <ArrowRight className="h-4 w-4" aria-hidden />}
    </SmartLink>
  );
}

export function CheckList({ items, className, size = 'md' }: { items?: (string | null | undefined)[]; className?: string; size?: 'sm' | 'md' }) {
  const list = (items ?? []).filter(Boolean) as string[];
  if (!list.length) return null;
  return (
    <ul className={clsx('space-y-2', className)}>
      {list.map((t, i) => (
        <li key={i} className={clsx('flex items-start gap-2.5 text-primary-900', size === 'sm' ? 'text-[13px]' : 'text-[14.5px]')}>
          <CircleCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 fill-primary-800 text-white" aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function TickList({ items, className }: { items?: (string | null)[]; className?: string }) {
  const list = (items ?? []).filter(Boolean) as string[];
  if (!list.length) return null;
  return (
    <ul className={clsx('space-y-2', className)}>
      {list.map((t, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[14px] text-primary-900">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-800" strokeWidth={3} aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function DocList({ docs, ids }: { docs: Record<string, Doc>; ids?: string[] }) {
  const list = (ids ?? []).map((id) => docs[id]).filter(Boolean) as Doc[];
  if (!list.length) return <p className="text-sm text-primary-900/60">Documents will be published soon.</p>;
  return (
    <ul className="divide-y divide-primary-100">
      {list.map((d) => (
        <li key={d.id}>
          <a href={d.url ?? '#'} target="_blank" rel="noopener" className="group flex items-center gap-3 py-2.5 text-[14px] font-semibold text-primary-900 hover:text-primary-700">
            <FileText className="h-6 w-6 shrink-0 text-gold-500" strokeWidth={1.5} aria-hidden />
            <span className="flex-1">
              {d.title} {d.fileType && <span className="font-normal text-primary-900/70">({d.fileType})</span>}
              <span className="sr-only"> — download{d.size ? `, ${fmtSize(d.size)}` : ''}</span>
            </span>
            <Download className="h-5 w-5 shrink-0 text-primary-700 group-hover:translate-y-0.5" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Chevron() {
  return <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />;
}

/** Placeholder shown where content has not been published yet. */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-primary-200 bg-white px-6 py-10 text-center text-sm text-primary-900/70">{children}</div>;
}

/** Pagination links preserving the current query string. */
export function Pager({ page, totalPages, href }: { page: number; totalPages: number; href: (p: number) => string }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2);
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-1.5">
      <Link aria-label="Previous page" href={href(Math.max(1, page - 1))} className={clsx('flex h-9 w-9 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-800', page === 1 && 'pointer-events-none opacity-40')}>‹</Link>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1]! > 1 && <span className="px-1 text-primary-800">…</span>}
          <Link href={href(p)} aria-current={p === page ? 'page' : undefined} className={clsx('flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-semibold', p === page ? 'border-primary-800 bg-primary-800 text-white' : 'border-primary-100 bg-white text-primary-800 hover:bg-primary-50')}>
            {p}
          </Link>
        </span>
      ))}
      <Link aria-label="Next page" href={href(Math.min(totalPages, page + 1))} className={clsx('flex h-9 w-9 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-800', page === totalPages && 'pointer-events-none opacity-40')}>›</Link>
    </nav>
  );
}

export function RichHtml({ html, className }: { html?: string | null; className?: string }) {
  if (!html) return null;
  // HTML is sanitised by the API before it is stored.
  return <div className={clsx('rich', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
