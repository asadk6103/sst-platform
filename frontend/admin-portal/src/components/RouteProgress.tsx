import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

/**
 * Slim progress bar at the top of the window while a screen is loading its data.
 *
 * Screens switch instantly; what takes time is their first data request. The bar shows while any
 * query that has no data yet is loading — background refreshes of data already on screen do not
 * trigger it.
 */
export function RouteProgress() {
  const loading = useIsFetching({ predicate: (q) => q.state.data === undefined }) > 0;
  const [progress, setProgress] = useState<number | null>(null); // null = hidden
  const timers = useRef<{ show?: number; trickle?: number; hide?: number }>({});

  useEffect(() => {
    const t = timers.current;
    window.clearTimeout(t.show);
    window.clearInterval(t.trickle);
    window.clearTimeout(t.hide);
    if (loading) {
      // Short delay so cached / instant loads do not flash the bar.
      t.show = window.setTimeout(() => {
        setProgress(8);
        t.trickle = window.setInterval(() => {
          setProgress((p) => (p === null ? p : Math.min(90, p + (90 - p) * 0.1 + 0.5)));
        }, 200);
      }, 80);
    } else {
      setProgress((p) => (p === null ? null : 100));
      t.hide = window.setTimeout(() => setProgress(null), 300);
    }
    return () => {
      window.clearTimeout(t.show);
      window.clearInterval(t.trickle);
      window.clearTimeout(t.hide);
    };
  }, [loading]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: progress === null || progress === 100 ? 0 : 1, transition: 'opacity 300ms ease 100ms' }}
    >
      <div
        className="h-full bg-gold-500 shadow-[0_0_8px_rgba(201,161,74,0.7)] motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out"
        style={{ width: `${progress ?? 0}%` }}
      />
    </div>
  );
}
