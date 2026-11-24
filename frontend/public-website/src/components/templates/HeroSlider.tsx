'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface Slide {
  eyebrow?: string;
  headline: string;
  text?: string;
  img: { url: string; alt: string; variants: { width: number; url: string }[] } | null;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

/** Homepage hero slider. Pauses on hover/focus; respects reduced-motion preferences. */
export function HeroSlider({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  useEffect(() => {
    if (n < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 7000);
    return () => clearInterval(t);
  }, [n, paused]);
  if (!n) return null;
  const s = slides[i]!;
  const src = s.img?.variants.find((v) => v.width >= 1280)?.url ?? s.img?.url;
  return (
    <section aria-roledescription="carousel" aria-label="Highlights" className="relative overflow-hidden bg-primary-900 text-white" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} srcSet={s.img!.variants.map((v) => `${v.url} ${v.width}w`).join(', ')} sizes="100vw" alt={s.img!.alt} className="absolute inset-y-0 right-0 h-full w-full object-cover md:w-[62%]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-primary-900 via-primary-900/90 to-primary-900/10 md:via-primary-900/80 md:to-transparent" aria-hidden />
      <div className="relative mx-auto flex min-h-[420px] max-w-site items-center px-4 pb-16 pt-10 sm:px-8 lg:px-[88px]" aria-live="polite">
        <div className="max-w-xl">
          {s.eyebrow && <p className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-gold-400"><span className="h-px w-8 bg-gold-400" />{s.eyebrow}</p>}
          <h1 className="font-serif text-[36px] font-bold leading-tight sm:text-[46px]">{s.headline}</h1>
          {s.text && <p className="mt-3 text-[16px] text-white/90">{s.text}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {s.primaryLabel && <Link href={s.primaryHref ?? '#'} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-gold-300 to-gold-400 px-5 py-2.5 font-serif font-bold text-primary-900">{s.primaryLabel}<ArrowRight className="h-4 w-4" /></Link>}
            {s.secondaryLabel && <Link href={s.secondaryHref ?? '#'} className="inline-flex items-center gap-2 rounded-lg border-2 border-white px-5 py-2.5 font-serif font-bold text-white hover:bg-white/10">{s.secondaryLabel}</Link>}
          </div>
        </div>
      </div>
      {n > 1 && (
        <>
          <button aria-label="Previous slide" onClick={() => setI((i - 1 + n) % n)} className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 md:flex"><ChevronLeft /></button>
          <button aria-label="Next slide" onClick={() => setI((i + 1) % n)} className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 md:flex"><ChevronRight /></button>
          <div className="absolute bottom-12 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((_, k) => <button key={k} aria-label={`Show slide ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} className={clsx('h-2.5 rounded-full transition-all', k === i ? 'w-7 bg-gold-400' : 'w-2.5 bg-white/60')} />)}
          </div>
        </>
      )}
    </section>
  );
}
