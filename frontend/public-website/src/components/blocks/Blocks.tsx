import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import type { Block, Cell, PageLayout, Row } from '@sst/shared';
import type { DocMap, MediaMap } from '@/lib/api';
import { Button, Card, CheckList, DocList, Heading, Icon, Img, SmartLink, TickList } from '../ui';
import { Scroller } from '../client';

export interface Ctx {
  media: MediaMap;
  documents: DocMap;
}
type V = Record<string, any>;
const items = (v: V) => ((v?.items ?? []) as V[]).filter(Boolean);

/** Renders one block of a fixed layout. Empty blocks render nothing so layouts never break. */
export function BlockView({ block, v, ctx }: { block: Block; v: V | undefined; ctx: Ctx }) {
  if (!v) return null;
  const { media, documents } = ctx;
  switch (block.type) {
    case 'strip': {
      const list = items(v);
      if (!list.length) return null;
      if (block.variant === 'band')
        return (
          <div className="grid gap-4 rounded-xl bg-gradient-to-r from-primary-800 to-primary-900 px-6 py-6 text-white sm:grid-cols-2 lg:grid-cols-4">
            {list.map((it, i) => (
              <div key={i} className={clsx('flex items-center gap-3', i > 0 && 'lg:border-l lg:border-white/25 lg:pl-5')}>
                <Icon name={it.icon} className="h-10 w-10 text-gold-400" strokeWidth={1.4} />
                <div>
                  <p className="font-serif text-[16px] font-bold">{it.title}</p>
                  {it.subtitle && <p className="text-[12.5px] text-white/85">{it.subtitle}</p>}
                </div>
              </div>
            ))}
          </div>
        );
      return (
        <Card className="grid grid-cols-2 gap-y-4 px-2 py-4 sm:grid-cols-3 lg:flex lg:flex-wrap">
          {list.map((it, i) => (
            <div key={i} className={clsx('flex flex-1 basis-0 flex-col items-center px-3 text-center lg:min-w-[110px]', i > 0 && 'lg:border-l lg:border-primary-100')}>
              <Icon name={it.icon} className="mb-1.5 h-10 w-10 text-gold-500" strokeWidth={1.4} />
              <p className="font-serif text-[15px] font-bold leading-tight text-primary-800">{it.title}</p>
              {it.subtitle && <p className="mt-0.5 text-[13px] text-primary-900">{it.subtitle}</p>}
            </div>
          ))}
        </Card>
      );
    }
    case 'image':
    case 'illustration':
      return v.image ? (
        // Photos fill the height of the row they sit in (so they match the card beside them).
        <figure className={clsx(block.type === 'image' && 'relative h-full min-h-[220px] overflow-hidden rounded-xl shadow-card')}>
          <Img id={v.image} media={media} className={clsx(block.type === 'image' ? 'absolute inset-0 h-full w-full object-cover' : 'mx-auto max-h-[110px] w-auto object-contain')} />
          {v.caption && <figcaption className="sr-only">{v.caption}</figcaption>}
        </figure>
      ) : null;
    case 'checklist':
      if (!v.heading && !(v.items ?? []).length) return null;
      return (
        <Card className="h-full p-5">
          <Heading icon={v.icon}>{v.heading}</Heading>
          {v.text && <p className="mb-3 text-[14px] leading-snug text-primary-900">{v.text}</p>}
          <CheckList items={v.items} />
          {v.ctaLabel && v.ctaHref && (
            <div className="mt-4 text-center">
              <Button href={v.ctaHref} variant="outline" className="px-8 py-2 text-[14px]">{v.ctaLabel}</Button>
            </div>
          )}
        </Card>
      );
    case 'downloads':
      if (!(v.documents ?? []).length) return null;
      if (block.variant === 'button') {
        const d = documents[v.documents[0]];
        return d ? (
          <a href={d.url ?? '#'} target="_blank" rel="noopener" className="flex h-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-primary-800 to-primary-900 px-6 py-4 font-serif text-[18px] font-bold text-white shadow-card hover:brightness-110">
            <Icon name="Download" className="h-7 w-7 text-gold-400" /> {v.heading || 'Download'} <ChevronRight className="h-5 w-5" />
          </a>
        ) : null;
      }
      return (
        <Card className="h-full p-5">
          <Heading icon={v.icon}>{v.heading}</Heading>
          {v.text && <p className="mb-2 text-[14px] text-primary-900">{v.text}</p>}
          <DocList docs={documents} ids={v.documents} />
        </Card>
      );
    case 'imageCards': {
      const list = items(v);
      if (!list.length) return null;
      const overlay = block.variant === 'overlay';
      const cards = list.map((it, i) => (
        <SmartLink key={i} href={it.href || undefined} className={clsx('group relative block shrink-0 snap-start overflow-hidden rounded-xl bg-cream-50 shadow-card', overlay ? 'w-[46%] sm:w-[31%] lg:w-auto lg:flex-1' : 'w-[46%] sm:w-[31%] lg:w-auto lg:flex-1 border border-primary-100/70')}>
          <div className={clsx('overflow-hidden', overlay ? 'aspect-[16/10]' : 'aspect-[16/8]')}>
            <Img id={it.image} media={media} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" sizes="(max-width: 768px) 50vw, 20vw" />
          </div>
          {overlay ? (
            <span className="absolute inset-x-3 bottom-2 rounded-md bg-primary-900/90 px-2 py-1 text-center font-serif text-[14px] font-bold text-white">{it.label}</span>
          ) : (
            <p className="px-2 py-3 text-center font-serif text-[14.5px] font-bold leading-tight text-primary-800">{it.label}</p>
          )}
        </SmartLink>
      ));
      return (
        <section>
          <Heading icon={v.icon}>{v.heading}</Heading>
          {list.length > 6 || block.variant === 'gallery' ? <Scroller label={v.heading || 'items'}>{cards}</Scroller> : <div className="flex gap-3 overflow-x-auto pb-1 lg:overflow-visible">{cards}</div>}
        </section>
      );
    }
    case 'iconGrid': {
      const list = items(v);
      if (!list.length) return null;
      const withText = list.some((it) => it.text);
      return (
        <Card className="h-full p-5">
          <Heading icon={v.icon}>{v.heading}</Heading>
          <div className={clsx('grid gap-2', withText ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6' : block.variant === 'tiles' ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')}>
            {list.map((it, i) => (
              <div key={i} className={clsx('flex flex-col items-center rounded-lg px-2 py-3 text-center', block.variant === 'tiles' ? 'border border-primary-100 bg-white' : withText ? 'border-primary-100 xl:border-l xl:first:border-l-0' : 'bg-white/70')}>
                <Icon name={it.icon} className={clsx('mb-1.5 text-primary-800', withText ? 'h-9 w-9' : 'h-8 w-8')} strokeWidth={1.4} />
                <p className={clsx('font-serif font-bold leading-tight', withText ? 'text-[15.5px] text-primary-800' : 'text-[13px] text-primary-900')}>{it.label}</p>
                {it.text && <p className="mt-1.5 text-[13px] leading-snug text-primary-900">{it.text}</p>}
              </div>
            ))}
          </div>
        </Card>
      );
    }
    case 'stats': {
      const list = items(v);
      if (!list.length) return null;
      return (
        <Card className="p-5">
          <Heading icon={v.icon}>{v.heading}</Heading>
          <dl className="divide-y divide-primary-100">
            {list.map((it, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <Icon name={it.icon} className="h-6 w-6 text-primary-800" />
                <dt className="flex-1 text-[14.5px] text-primary-900">{it.label}</dt>
                <dd className="font-bold text-primary-900">{it.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      );
    }
    case 'table': {
      const cols: string[] = v.columns ?? [];
      const rows: string[][] = (v.rows ?? []).map((r: V) => r.cells ?? []);
      if (!rows.length) return null;
      if (block.variant === 'grouped')
        return (
          <section className="h-full">
            <Heading icon={v.icon}>{v.heading}</Heading>
            <Card className="divide-y divide-primary-100 overflow-hidden">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[120px_1fr]">
                  <p className="flex items-center justify-center bg-primary-50 px-2 py-3 text-center font-serif text-[14px] font-bold text-primary-800">{r[0]}</p>
                  <TickList items={(r[1] ?? '').split(';').map((s) => s.trim())} className="space-y-1 px-4 py-2.5" />
                </div>
              ))}
            </Card>
          </section>
        );
      return (
        <section className="h-full">
          <Heading icon={v.icon}>{v.heading}</Heading>
          {v.text && <p className="mb-2 text-[14px] text-primary-900">{v.text}</p>}
          <div className="overflow-x-auto rounded-xl border border-primary-100 bg-white shadow-card">
            <table className="w-full min-w-[420px] text-[13.5px]">
              {cols.length > 0 && (
                <thead className="bg-gradient-to-r from-primary-800 to-primary-900 text-left text-white">
                  <tr>{cols.map((c, i) => <th key={i} scope="col" className="px-3 py-2.5 font-serif text-[13.5px] font-bold">{c}</th>)}</tr>
                </thead>
              )}
              <tbody className="divide-y divide-primary-100">
                {rows.map((r, i) => (
                  <tr key={i} className="even:bg-cream-50">
                    {r.map((c, j) => (
                      <td key={j} className={clsx('px-3 py-2.5 text-primary-900', j === 0 && 'font-serif font-bold text-primary-800', /^#|^\d{2}$/.test(cols[0] ?? '') && j === 0 && 'w-12 text-center')}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {v.note && <p className="mt-2 flex gap-2 rounded-lg border border-gold-300 bg-gold-100/60 px-3 py-2 text-[12.5px] text-primary-900"><Icon name="Info" className="h-4 w-4 text-gold-600" /><span><b>Note:</b> {v.note}</span></p>}
        </section>
      );
    }
    case 'steps': {
      const list = items(v);
      if (!list.length) return null;
      if (block.variant === 'circles' || block.variant === 'dates')
        return (
          <section>
            <Heading icon={v.icon}>{v.heading}</Heading>
            <Card className={clsx('grid grid-cols-2 gap-4 px-4 py-5 sm:grid-cols-3', list.length >= 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-4')}>
              {list.map((it, i) => (
                <div key={i} className="relative flex flex-col items-center text-center">
                  <span className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border border-primary-100 bg-gradient-to-b from-white to-primary-50 shadow-card">
                    <Icon name={it.icon} className="h-8 w-8 text-primary-800" strokeWidth={1.4} />
                    {block.variant === 'circles' && <span className="font-serif text-[15px] font-bold text-primary-800">{String(i + 1).padStart(2, '0')}</span>}
                  </span>
                  {i < list.length - 1 && <ChevronRight className="absolute -right-3 top-6 hidden h-6 w-6 text-primary-800 lg:block" aria-hidden />}
                  <p className="mt-2 font-serif text-[14.5px] font-bold leading-tight text-primary-800">{it.title}</p>
                  {it.badge && <span className="mt-2 rounded-full bg-primary-100 px-3 py-1 font-serif text-[13px] font-bold text-primary-900">{it.badge}</span>}
                  {it.text && <p className="mt-1 text-[12.5px] text-primary-900">{it.text}</p>}
                </div>
              ))}
            </Card>
          </section>
        );
      if (block.variant === 'numbered')
        return (
          <div className={clsx('grid grid-cols-2 gap-3 sm:grid-cols-3', list.length >= 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-4')}>
            {list.map((it, i) => (
              <Card key={i} className="relative flex flex-col items-center px-3 pb-4 pt-7 text-center">
                <span className="absolute -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary-800 font-serif text-[14px] font-bold text-white">{String(i + 1).padStart(2, '0')}</span>
                <Icon name={it.icon} className="mb-1 h-10 w-10 text-primary-800" strokeWidth={1.4} />
                <p className="font-serif text-[16px] font-bold text-primary-800">{it.title}</p>
                {it.text && <p className="mt-1 text-[13px] leading-snug text-primary-900">{it.text}</p>}
              </Card>
            ))}
          </div>
        );
      if (block.variant === 'vertical')
        return (
          <Card className="p-5">
            <Heading icon={v.icon}>{v.heading}</Heading>
            <ol className="relative space-y-4 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:border-l-2 before:border-dashed before:border-primary-200">
              {list.map((it, i) => (
                <li key={i} className="relative flex gap-4">
                  <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-800 text-[13px] font-bold text-white">{i + 1}</span>
                  <span>
                    <span className="block font-serif text-[15px] font-bold text-primary-800">{it.title}</span>
                    {it.text && <span className="block text-[13px] text-primary-900">{it.text}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        );
      // inline (events strip) and timeline
      return (
        <Card className={clsx('h-full p-4', block.variant === 'inline' ? 'flex flex-col gap-3 lg:flex-row lg:items-center' : '')}>
          <Heading icon={v.icon} className={block.variant === 'inline' ? 'mb-0 shrink-0 lg:border-r lg:border-primary-100 lg:pr-5' : ''}>{v.heading}</Heading>
          <ol className={clsx(block.variant === 'inline' ? 'grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4' : 'relative space-y-4 border-l-2 border-gold-400 pl-6')}>
            {list.map((it, i) => (
              <li key={i} className={clsx('flex items-start gap-2.5', block.variant === 'inline' && i > 0 && 'lg:border-l lg:border-primary-100 lg:pl-3')}>
                <Icon name={it.icon} className="h-7 w-7 text-primary-800" strokeWidth={1.4} />
                <span>
                  <span className="block font-serif text-[13.5px] font-bold leading-tight text-primary-800">{it.title}</span>
                  {it.badge && <span className="block text-[12px] text-primary-900">{it.badge}</span>}
                  {it.text && <span className="block text-[13.5px] text-primary-900">{it.text}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      );
    }
    case 'keyValues': {
      const list = items(v);
      if (!list.length) return null;
      return (
        <Card className="flex h-full flex-col p-5">
          <Heading icon={v.icon}>{v.heading}</Heading>
          <dl className="flex-1 divide-y divide-primary-100">
            {list.map((it, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Icon name={it.icon} className="h-5 w-5 text-primary-700" />
                <dt className="flex-1 font-serif text-[14px] font-bold text-primary-800">{it.label}</dt>
                <dd className="text-right text-[14px] text-primary-900">{it.value}</dd>
              </div>
            ))}
          </dl>
          {v.ctaLabel && v.ctaHref && (
            <div className="mt-4 text-center">
              <Button href={v.ctaHref} variant="outline" className="px-8 py-2 text-[14px]">{v.ctaLabel}</Button>
            </div>
          )}
        </Card>
      );
    }
    case 'benefits': {
      const list = items(v);
      if (!list.length) return null;
      if (block.variant === 'inline')
        return (
          <Card className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
            <div className="shrink-0 lg:max-w-[190px] lg:border-r lg:border-primary-100 lg:pr-5">
              <Heading icon={v.icon} className="mb-0">{v.heading}</Heading>
              {v.text && <p className="text-[13px] text-primary-900">{v.text}</p>}
            </div>
            <ul className={clsx('grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3', list.length >= 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-5')}>
              {list.map((it, i) => (
                <li key={i} className={clsx('flex items-center gap-2.5', i > 0 && 'xl:border-l xl:border-primary-100 xl:pl-3')}>
                  <Icon name={it.icon} className="h-8 w-8 text-gold-500" strokeWidth={1.4} />
                  <span className="font-serif text-[13.5px] font-bold leading-tight text-primary-900">{it.title}{it.text && <span className="block font-sans text-[12px] font-normal">{it.text}</span>}</span>
                </li>
              ))}
            </ul>
          </Card>
        );
      if (block.variant === 'tiles')
        return (
          <section>
            <Heading>{v.heading}</Heading>
            <Card className="grid grid-cols-2 gap-y-4 px-2 py-5 sm:grid-cols-3 lg:grid-cols-6">
              {list.map((it, i) => (
                <div key={i} className={clsx('flex flex-col items-center px-2 text-center', i > 0 && 'lg:border-l lg:border-primary-100')}>
                  <Icon name={it.icon} className="mb-2 h-10 w-10 text-primary-800" strokeWidth={1.4} />
                  <p className="text-[14px] text-primary-900">{it.title}</p>
                </div>
              ))}
            </Card>
          </section>
        );
      return (
        <Card className="p-5">
          <Heading icon={v.icon}>{v.heading}</Heading>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {list.map((it, i) => (
              <li key={i} className={clsx('flex gap-3', i > 0 && 'xl:border-l xl:border-primary-100 xl:pl-4')}>
                <Icon name={it.icon} className="h-9 w-9 text-gold-500" strokeWidth={1.4} />
                <span>
                  <span className="block font-serif text-[15px] font-bold text-primary-800">{it.title}</span>
                  {it.text && <span className="block text-[13.5px] text-primary-900">{it.text}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      );
    }
    case 'note':
      if (!v.text && !(v.items ?? []).length) return null;
      return (
        <div className={clsx('h-full rounded-xl border border-gold-300/60 bg-gradient-to-b from-[#fffaf0] to-[#fff6e5] p-5 shadow-card', block.variant === 'inline' && 'md:flex md:items-center md:gap-6')}>
          <Heading icon={v.icon || 'Info'} className={block.variant === 'inline' ? 'md:mb-0 md:shrink-0 md:border-r md:border-gold-300 md:pr-6' : ''}>{v.heading}</Heading>
          {v.text && <p className="text-[14.5px] leading-relaxed text-primary-900">{v.text}</p>}
          <TickList items={v.items} />
        </div>
      );
    case 'cta':
      if (!v.heading && !v.primaryLabel) return null;
      return (
        <Card className={clsx('flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center', block.variant === 'wide' && 'bg-gradient-to-r from-[#fdf5ea] to-cream-50')}>
          <Icon name={v.icon} className="h-12 w-12 text-gold-500" strokeWidth={1.4} />
          <div className="flex-1">
            <p className="font-serif text-[22px] font-bold text-primary-800">{v.heading}</p>
            {v.text && <p className="text-[14.5px] text-primary-900">{v.text}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            {v.secondaryLabel && <Button href={v.secondaryHref} variant="outline">{v.secondaryLabel}</Button>}
            {v.primaryLabel && <Button href={v.primaryHref} comingSoon={v.primaryHref?.endsWith('/apply-online')}>{v.primaryLabel}</Button>}
          </div>
        </Card>
      );
    case 'links': {
      const list = items(v);
      if (!list.length) return null;
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((it, i) => (
            <SmartLink key={i} href={it.href} className="flex items-center justify-center gap-3 rounded-full border-2 border-primary-200 bg-white px-4 py-3 font-serif text-[14.5px] font-bold text-primary-800 shadow-card hover:border-primary-500">
              <Icon name={it.icon} className="h-6 w-6 text-primary-800" /> {it.label}
            </SmartLink>
          ))}
        </div>
      );
    }
    case 'cards': {
      const list = items(v);
      if (!list.length) return null;
      if (block.variant === 'feature') {
        const c = list[0]!;
        return (
          <Card className="overflow-hidden">
            <Img id={c.image} media={media} className="aspect-[16/7] w-full object-cover" />
            <div className="p-5">
              <p className="font-serif text-[26px] font-bold text-primary-800">{c.title}</p>
              <p className="mt-1 text-[14.5px] text-primary-900">{c.text}</p>
              {c.badge && <Button href={c.href} className="mt-3 w-full">{c.badge}</Button>}
            </div>
          </Card>
        );
      }
      if (block.variant === 'programme')
        return (
          <section>
            <Heading icon={v.icon}>{v.heading}</Heading>
            <div className="grid gap-4 md:grid-cols-3">
              {list.map((c, i) => (
                <Card key={i} className="flex flex-col items-center p-5 text-center">
                  <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50"><Icon name={c.icon} className="h-9 w-9 text-gold-500" strokeWidth={1.4} /></span>
                  <p className="font-serif text-[19px] font-bold text-primary-800">{c.title}</p>
                  {c.badge && <span className="mt-1.5 rounded-full bg-primary-800 px-3 py-0.5 font-serif text-[13px] font-bold text-white">{c.badge}</span>}
                  {c.text && <p className="mt-2 flex-1 text-[14px] text-primary-900">{c.text}</p>}
                  {c.href && <Button href={c.href} variant="outline" className="mt-4 px-6 py-2 text-[14px]">Learn More</Button>}
                </Card>
              ))}
            </div>
          </section>
        );
      // campus-style cards: image, round icon badge, title, text, arrow
      return (
        <section>
          <Heading icon={v.icon}>{v.heading}</Heading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {list.map((c, i) => (
              <SmartLink key={i} href={c.href} className="group flex flex-col overflow-hidden rounded-xl border border-primary-100/70 bg-cream-50 shadow-card transition hover:shadow-lift">
                <div className="relative">
                  <Img id={c.image} media={media} className="aspect-[16/9] w-full object-cover" sizes="(max-width: 768px) 100vw, 20vw" />
                  <span className="absolute -bottom-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow"><Icon name={c.icon} className="h-7 w-7 text-primary-800" /></span>
                </div>
                <div className="flex flex-1 flex-col items-center px-4 pb-4 pt-9 text-center">
                  <p className="font-serif text-[19px] font-bold text-primary-800">{c.title}</p>
                  {c.text && <p className="mt-1.5 flex-1 text-[14px] leading-snug text-primary-900">{c.text}</p>}
                  {c.href && <span className="mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-800 group-hover:bg-primary-800 group-hover:text-white"><ArrowRight className="h-5 w-5" aria-hidden /><span className="sr-only">Read more about {c.title}</span></span>}
                </div>
              </SmartLink>
            ))}
          </div>
        </section>
      );
    }
    case 'houses': {
      const list = items(v);
      if (!list.length) return null;
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((h, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl border pb-10 pt-4 text-center shadow-card" style={{ borderColor: `${h.color}40`, background: `linear-gradient(180deg, ${h.color}14, #fff 70%)` }}>
              <Img id={h.image} media={media} className="mx-auto h-[86px] w-auto object-contain" />
              <p className="mt-1 font-serif text-[22px] font-bold" style={{ color: h.color }}>{h.title}</p>
              {h.text && <p className="mx-3 mt-1 rounded bg-white/70 px-2 py-1 font-serif text-[13px] font-bold" style={{ color: h.color }}>{h.text}</p>}
              <svg viewBox="0 0 300 40" className="absolute inset-x-0 bottom-0 h-10 w-full" aria-hidden preserveAspectRatio="none">
                <path d="M0 40 L0 22 L40 10 L80 24 L130 6 L180 22 L230 12 L300 26 L300 40 Z" fill={h.color} />
              </svg>
            </div>
          ))}
        </div>
      );
    }
    case 'routine': {
      const list = items(v);
      if (!list.length) return null;
      return (
        <Card className="h-full p-5">
          <Heading icon={v.icon}>{v.heading}</Heading>
          <ol className="relative grid grid-cols-3 gap-y-4 sm:grid-cols-6">
            <span className="absolute left-4 right-4 top-[46px] hidden h-0.5 bg-primary-300 sm:block" aria-hidden />
            {list.map((it, i) => (
              <li key={i} className="relative flex flex-col items-center text-center">
                <Icon name={it.icon} className="h-7 w-7 text-primary-800" strokeWidth={1.4} />
                <span className="z-10 my-2 h-3 w-3 rounded-full bg-primary-800" aria-hidden />
                <span className="font-serif text-[12.5px] font-bold text-primary-800">{it.title}</span>
                <span className="text-[12px] text-primary-900">{it.text}</span>
              </li>
            ))}
          </ol>
        </Card>
      );
    }
    case 'detailList': {
      const list = items(v);
      if (!list.length) return null;
      const numbered = block.variant === 'numbered';
      return (
        <section className="h-full">
          <Card className="h-full p-5">
            <Heading icon={v.icon}>{v.heading}</Heading>
            {v.text && <p className="mb-2 text-[14px] text-primary-900">{v.text}</p>}
            <ul className="divide-y divide-primary-100 rounded-lg border border-primary-100 bg-white">
              {list.map((it, i) => (
                <li key={i} className="grid grid-cols-[minmax(150px,0.8fr)_1.4fr] items-center">
                  <span className="flex items-center gap-3 border-r border-primary-100 px-3 py-2.5 font-serif text-[14.5px] font-bold text-primary-800">
                    {numbered ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-800 text-[12px] text-white">{String(i + 1).padStart(2, '0')}</span> : <Icon name={it.icon} className="h-7 w-7 text-gold-500" strokeWidth={1.4} />}
                    {it.title}
                  </span>
                  <span className="px-3 py-2.5 text-[13px] leading-snug text-primary-900">{it.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      );
    }
    case 'gradeCards': {
      const list = items(v);
      if (!list.length) return null;
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((c, i) => (
            <Card key={i} className="flex flex-col items-center px-4 py-5 text-center">
              <Icon name={c.icon} className="h-11 w-11 text-gold-500" strokeWidth={1.4} />
              <p className="mt-1 font-serif text-[19px] font-bold text-primary-800">{c.title}</p>
              {c.badge && <span className="mt-1 rounded-full bg-primary-800 px-3 py-0.5 font-serif text-[14px] font-bold text-white">{c.badge}</span>}
              {c.text && <p className="mt-2 text-[14px] text-primary-900">{c.text}</p>}
            </Card>
          ))}
        </div>
      );
    }
    case 'progression': {
      const list = items(v);
      if (!list.length) return null;
      return (
        <section>
          <Heading icon={v.icon}>{v.heading}</Heading>
          <Card className="flex items-center justify-between gap-1 p-4">
            {list.map((s, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className={clsx('flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full border-2 text-center', i % 2 ? 'border-gold-300 bg-gold-100/50' : 'border-primary-200 bg-primary-50')}>
                  <span className="font-serif text-[16px] font-bold text-primary-800">{s.title}</span>
                  <span className="text-[10.5px] text-primary-900">{s.text}</span>
                </span>
                {i < list.length - 1 && <ArrowRight className="h-5 w-5 text-primary-800" aria-hidden />}
              </span>
            ))}
          </Card>
        </section>
      );
    }
    case 'richText':
      return v.body ? (
        <Card className="p-6">
          <Heading icon={v.icon}>{v.heading}</Heading>
          <div className="rich" dangerouslySetInnerHTML={{ __html: v.body }} />
        </Card>
      ) : null;
    case 'textPanel':
      return (
        <Card className="h-full p-5">
          <Heading icon={v.icon}>{v.heading}</Heading>
          {v.text && <p className="mb-3 text-[14.5px] leading-relaxed text-primary-900">{v.text}</p>}
          <CheckList items={v.items} />
          {v.ctaLabel && <Button href={v.ctaHref} className="mt-4">{v.ctaLabel}</Button>}
        </Card>
      );
    default:
      return null;
  }
}

function CellView({ cell, content, ctx }: { cell: Cell; content: V; ctx: Ctx }) {
  if (Array.isArray(cell)) return <div className="flex flex-col gap-5">{cell.map((b) => <BlockView key={b.id} block={b} v={content[b.id]} ctx={ctx} />)}</div>;
  return <BlockView block={cell} v={content[cell.id]} ctx={ctx} />;
}

export function RowsView({ rows, content, ctx }: { rows?: Row[]; content: V; ctx: Ctx }) {
  return (
    <>
      {(rows ?? []).map((r, i) =>
        'blocks' in r ? (
          <div key={i} className="grid gap-5 lg:[grid-template-columns:var(--cols)]" style={{ ['--cols' as any]: r.cols }}>
            {r.blocks.map((c, j) => <CellView key={j} cell={c} content={content} ctx={ctx} />)}
          </div>
        ) : (
          <BlockView key={i} block={r} v={content[r.id]} ctx={ctx} />
        ),
      )}
    </>
  );
}

/** The intro (eyebrow, heading, text) shown at the top of every content column. */
export function Intro({ intro, aside, compact }: { intro?: V; aside?: ReactNode; compact?: boolean }) {
  if (!intro?.heading) return null;
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="flex-1">
        <Eyebrow2 text={intro.eyebrow} />
        <h2 className={clsx('font-serif font-bold leading-tight text-primary-800', compact ? 'text-[30px] sm:text-[34px]' : 'text-[32px] sm:text-[38px]')}>{intro.heading}</h2>
        {compact && <span className="mt-1 block h-[3px] w-24 rounded bg-gold-400" aria-hidden />}
        {intro.text && <p className="mt-1.5 max-w-[760px] text-[15.5px] leading-snug text-primary-700">{intro.text}</p>}
      </div>
      {aside && <div className="md:w-[38%] md:max-w-[400px]">{aside}</div>}
    </div>
  );
}
function Eyebrow2({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gold-500">
      <span className="h-px w-8 bg-gold-400" aria-hidden />
      {text}
    </p>
  );
}

/** Full composed layout (intro, main column, optional aside, full-width rows). */
export function ComposedBody({ layout, content, ctx, dynamic }: { layout: PageLayout; content: V; ctx: Ctx; dynamic?: ReactNode }) {
  const aside = layout.introAside ? <BlockView block={layout.introAside} v={content[layout.introAside.id]} ctx={ctx} /> : null;
  const hasAside = !!layout.aside?.length;
  return (
    <div className="space-y-5">
      <div className={clsx(hasAside && 'gap-5 xl:grid xl:[grid-template-columns:1fr_var(--aside)]')} style={{ ['--aside' as any]: layout.asideWidth ?? '340px' }}>
        <div className="min-w-0 space-y-5">
          <Intro intro={content.intro} aside={aside} compact={!content.intro?.text} />
          <RowsView rows={layout.main} content={content} ctx={ctx} />
          {dynamic}
        </div>
        {hasAside && (
          <div className="mt-5 space-y-5 xl:mt-0 [&>*]:!h-auto">
            {layout.aside!.map((b) => <BlockView key={b.id} block={b} v={content[b.id]} ctx={ctx} />)}
          </div>
        )}
      </div>
      <RowsView rows={layout.full} content={content} ctx={ctx} />
    </div>
  );
}

export { Check, Button };
