import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import { Button, Card, Icon, Img, SmartLink } from '../ui';
import { HeroSlider } from './HeroSlider';
import type { TplProps } from './About';

const L = (x: any) => ((x ?? []) as any[]).filter(Boolean);

function SectionTitle({ eyebrow, heading, text, center }: { eyebrow?: string; heading?: string; text?: string; center?: boolean }) {
  if (!heading) return null;
  return (
    <div className={clsx('mb-5', center && 'text-center')}>
      {eyebrow && <p className={clsx('mb-1 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-gold-500', center && 'justify-center')}><span className="h-px w-8 bg-gold-400" />{eyebrow}<span className={clsx('h-px w-8 bg-gold-400', !center && 'hidden')} /></p>}
      <h2 className="font-serif text-[30px] font-bold leading-tight text-primary-800 sm:text-[34px]">{heading}</h2>
      {text && <p className={clsx('mt-2 text-[15px] text-primary-900', center && 'mx-auto max-w-2xl')}>{text}</p>}
    </div>
  );
}

export function Home({ page, extras, media }: TplProps) {
  const c = page.content ?? {};
  const news = L(extras?.news);
  return (
    <>
      <HeroSlider slides={L(c.slides).map((s) => ({ ...s, img: s.image ? media[s.image] : null }))} />

      {L(c.highlights).length > 0 && (
        <div className="relative z-10 mx-auto -mt-8 max-w-site px-4 sm:px-8 lg:px-[88px]">
          <Card className="grid grid-cols-1 gap-4 bg-white px-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {L(c.highlights).map((h, i) => (
              <div key={i} className={clsx('flex items-center gap-4 px-2', i > 0 && 'lg:border-l lg:border-primary-100 lg:pl-5')}>
                <Icon name={h.icon} className="h-11 w-11 text-gold-500" strokeWidth={1.4} />
                <span><span className="block font-serif text-[17px] font-bold text-primary-800">{h.title}</span><span className="text-[13.5px] text-primary-900">{h.text}</span></span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="mx-auto max-w-site space-y-10 px-4 py-10 sm:px-8 lg:px-[88px]">
        {c.about?.heading && (
          <section className="grid items-center gap-8 md:grid-cols-[0.85fr_1fr]">
            <Img id={c.about.image} media={media} className="aspect-[16/9] w-full rounded-xl border-b-4 border-l-4 border-gold-400 object-cover shadow-lift" />
            <div>
              <SectionTitle eyebrow={c.about.eyebrow} heading={c.about.heading} />
              <p className="text-[15.5px] leading-relaxed text-primary-900">{c.about.text}</p>
              {c.about.ctaLabel && <Button href={c.about.ctaHref} className="mt-5">{c.about.ctaLabel}</Button>}
            </div>
          </section>
        )}

        {L(c.academics?.programmes).length > 0 && (
          <section>
            <SectionTitle eyebrow={c.academics.eyebrow} heading={c.academics.heading} text={c.academics.text} center />
            <div className="grid gap-5 md:grid-cols-3">
              {L(c.academics.programmes).map((p, i) => (
                <SmartLink key={i} href={p.href} className="group flex items-start gap-4 rounded-xl border border-primary-100 bg-white p-5 shadow-card hover:shadow-lift">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-primary-50"><Icon name={p.icon} className="h-8 w-8 text-primary-800" /></span>
                  <span className="flex-1">
                    <span className="block font-serif text-[18px] font-bold text-primary-800">{p.title}</span>
                    {p.grades && <span className="block text-[13.5px] font-semibold text-gold-600">{p.grades}</span>}
                    <span className="mt-1 block text-[13.5px] text-primary-900">{p.text}</span>
                  </span>
                  <span className="mt-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-800 group-hover:bg-primary-800 group-hover:text-white"><ArrowRight className="h-4 w-4" aria-hidden /><span className="sr-only">Learn more about {p.title}</span></span>
                </SmartLink>
              ))}
            </div>
          </section>
        )}
      </div>

      {c.admissions?.heading && (
        <section className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-900 text-white">
          <div className="mx-auto flex max-w-site flex-col gap-6 px-4 py-8 sm:px-8 lg:flex-row lg:items-center lg:px-[88px]">
            <div className="lg:w-1/3">
              <h2 className="font-serif text-[30px] font-bold">{c.admissions.heading}</h2>
              <p className="text-white/90">{c.admissions.text}</p>
            </div>
            <ul className="grid flex-1 gap-4 sm:grid-cols-3">
              {L(c.admissions.features).map((f, i) => <li key={i} className="flex items-center gap-3"><Icon name={f.icon} className="h-9 w-9 text-gold-400" strokeWidth={1.4} /><span className="font-serif text-[15.5px] font-bold">{f.label}</span></li>)}
            </ul>
            {c.admissions.ctaLabel && <Button href={c.admissions.ctaHref} variant="gold">{c.admissions.ctaLabel}</Button>}
          </div>
        </section>
      )}

      <div className="mx-auto max-w-site space-y-10 px-4 py-10 sm:px-8 lg:px-[88px]">
        {L(c.campusLife?.tiles).length > 0 && (
          <section>
            <SectionTitle eyebrow={c.campusLife.eyebrow} heading={c.campusLife.heading} text={c.campusLife.text} center />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {L(c.campusLife.tiles).map((t, i) => (
                <SmartLink key={i} href={t.href} className="group relative overflow-hidden rounded-xl shadow-card">
                  <Img id={t.image} media={media} className="aspect-[178/120] w-full object-cover transition duration-300 group-hover:scale-105" sizes="(max-width:768px) 50vw, 20vw" />
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-primary-950/90 to-transparent px-3 pb-2.5 pt-8 font-serif text-[14.5px] font-bold text-white"><Icon name={t.icon} className="h-5 w-5 text-gold-400" />{t.label}</span>
                </SmartLink>
              ))}
            </div>
          </section>
        )}

        {c.news?.heading && (
          <section className="grid gap-6 lg:grid-cols-[1fr_3fr]">
            <div>
              <SectionTitle heading={c.news.heading} text={c.news.text} />
              {c.news.ctaLabel && <Button href={c.news.ctaHref} variant="outline">{c.news.ctaLabel}</Button>}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {news.map((n: any) => (
                <Link key={n.id} href={`/news-events/news/${n.slug}`} className="group overflow-hidden rounded-xl border border-primary-100 bg-cream-50 shadow-card hover:shadow-lift">
                  <Img id={n.featuredImageId} media={media} className="aspect-[211/100] w-full object-cover" sizes="(max-width:768px) 100vw, 25vw" />
                  <div className="p-4">
                    <p className="flex items-center gap-1.5 text-[12.5px] text-primary-900"><CalendarDays className="h-4 w-4" />{fmtDate(n.publicationDate)}</p>
                    <p className="mt-1 font-serif text-[16px] font-bold leading-tight text-primary-800 group-hover:underline">{n.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
