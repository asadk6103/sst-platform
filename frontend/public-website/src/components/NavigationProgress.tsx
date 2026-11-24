'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Slim progress bar at the top of the window while a page is loading.
 *
 * Pages render on the server, so after a link click the old page stays on screen until the new
 * one arrives. The bar starts on internal link clicks and back/forward, creeps towards 90%, and
 * completes when the URL changes (the new page has rendered).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [progress, setProgress] = useState<number | null>(null); // null = hidden
  const current = useRef('');
  const timers = useRef<{ show?: number; trickle?: number; hide?: number; fallback?: number }>({});

  const clear = () => {
    const t = timers.current;
    window.clearTimeout(t.show);
    window.clearInterval(t.trickle);
    window.clearTimeout(t.hide);
    window.clearTimeout(t.fallback);
    timers.current = {};
  };

  const done = () => {
    clear();
    setProgress((p) => (p === null ? null : 100));
    timers.current.hide = window.setTimeout(() => setProgress(null), 300);
  };

  const start = () => {
    clear();
    // Short delay so near-instant navigations do not flash the bar.
    timers.current.show = window.setTimeout(() => {
      setProgress(8);
      timers.current.trickle = window.setInterval(() => {
        setProgress((p) => (p === null ? p : Math.min(90, p + (90 - p) * 0.1 + 0.5)));
      }, 200);
    }, 80);
    timers.current.fallback = window.setTimeout(done, 20_000); // never stay stuck
  };

  // A new URL has rendered → finish.
  useEffect(() => {
    current.current = location.pathname + location.search;
    done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  useEffect(() => {
    // Not checking e.defaultPrevented: next/link cancels the default action and navigates itself.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || !a.href || a.hasAttribute('download')) return;
      const target = a.getAttribute('target');
      if (target && target !== '_self') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // Same page (or only the #hash changes): nothing to load.
      if (url.pathname === location.pathname && url.search === location.search) return;
      // Routes handled outside the website (admin portal, API, files) do a full page load.
      if (/^\/(admin|api|uploads|cms-hooks)(\/|$)/.test(url.pathname)) return;
      start();
    };
    const onPop = () => {
      if (location.pathname + location.search !== current.current) start();
    };
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPop);
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: progress === null || progress === 100 ? 0 : 1, transition: 'opacity 300ms ease 100ms' }}
    >
      <div
        className="h-full bg-gold-500 shadow-[0_0_8px_rgb(var(--accent)/0.7)] motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out"
        style={{ width: `${progress ?? 0}%` }}
      />
    </div>
  );
}
