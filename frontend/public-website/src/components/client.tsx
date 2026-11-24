'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Download, Printer, Send } from 'lucide-react';
import { clsx } from 'clsx';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="flex h-9 w-9 items-center justify-center text-primary-800 hover:text-primary-600" aria-label="Print this page">
      <Printer className="h-6 w-6" strokeWidth={1.8} />
    </button>
  );
}

/** Labelled print button ("Download Profile (PDF)" uses the browser's Save as PDF). */
export function PrintButtonLabel({ label, icon, variant }: { label: string; icon: 'Download' | 'Printer'; variant?: 'gold' }) {
  return (
    <button type="button" onClick={() => window.print()} className={clsx('flex items-center gap-2 rounded-lg border-2 px-4 py-1.5 font-serif text-[14px] font-bold', variant === 'gold' ? 'border-gold-400 bg-white text-gold-600 hover:bg-gold-100' : 'border-primary-200 bg-white text-primary-800 hover:border-primary-500')}>
      {icon === 'Download' ? <Download className="h-4 w-4" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
      {label}
    </button>
  );
}

/** Counts a view of a news item (used for "Popular News"). */
export function ViewCounter({ slug }: { slug: string }) {
  useEffect(() => {
    fetch(`/api/public/posts/${encodeURIComponent(slug)}/view`, { method: 'POST' }).catch(() => undefined);
  }, [slug]);
  return null;
}

type Status = { tone: 'ok' | 'error'; text: string } | null;

/** Generic website form posting JSON (or multipart when it contains files) to /api/public/forms/*. */
export function SiteForm({ endpoint, children, submitLabel, className, multipart, buttonClass, id }: { endpoint: string; children: ReactNode; submitLabel: ReactNode; className?: string; multipart?: boolean; buttonClass?: string; id?: string }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [startedAt] = useState(() => Date.now());
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('startedAt', String(startedAt));
    setBusy(true);
    setStatus(null);
    setErrors({});
    try {
      const res = await fetch(`/api/public/forms/${endpoint}`, multipart ? { method: 'POST', body: fd } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd)) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = Array.isArray(body?.error?.details) ? body.error.details : [];
        setErrors(Object.fromEntries(details.map((d: any) => [d.path, d.message])));
        setStatus({ tone: 'error', text: details.length ? 'Please check the highlighted fields.' : body?.error?.message ?? 'Something went wrong. Please try again.' });
      } else {
        setStatus({ tone: 'ok', text: body.message ?? 'Thank you!' });
        form.reset();
      }
    } catch {
      setStatus({ tone: 'error', text: 'Could not send. Please check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form id={id} onSubmit={submit} className={className} noValidate>
      {/* Honeypot: hidden from people, filled in by bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <FieldErrors.Provider value={errors}>{children}</FieldErrors.Provider>
      <button type="submit" disabled={busy} className={clsx('inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-primary-700 to-primary-900 px-5 py-2.5 font-serif text-[15px] font-bold text-white shadow-sm hover:from-primary-600 disabled:opacity-60', buttonClass)}>
        {busy ? 'Sending…' : submitLabel}
        {!busy && <Send className="h-4 w-4" aria-hidden />}
      </button>
      {status && (
        <p role="status" className={clsx('mt-3 rounded-md px-3 py-2 text-sm', status.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>
          {status.text}
        </p>
      )}
    </form>
  );
}

import { createContext, useContext } from 'react';
const FieldErrors = createContext<Record<string, string>>({});

export function Field({ name, label, required, type = 'text', placeholder, textarea, options, maxLength, accept, className }: { name: string; label: string; required?: boolean; type?: string; placeholder?: string; textarea?: boolean; options?: string[]; maxLength?: number; accept?: string; className?: string }) {
  const errors = useContext(FieldErrors);
  const [count, setCount] = useState(0);
  const id = `f-${name}`;
  const cls = clsx('w-full rounded-lg border bg-white px-3 py-2.5 text-[14px] text-primary-900 outline-none placeholder:text-primary-900/40 focus:border-primary-500 focus:ring-2 focus:ring-primary-200', errors[name] ? 'border-red-400' : 'border-primary-200');
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-[13.5px] font-bold text-primary-900">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {textarea ? (
        <div className="relative">
          <textarea id={id} name={name} required={required} rows={5} maxLength={maxLength} placeholder={placeholder} className={cls} onChange={(e) => setCount(e.target.value.length)} />
          {maxLength && <span className="absolute bottom-2 right-3 text-[11px] text-primary-900/60">{count} / {maxLength}</span>}
        </div>
      ) : options ? (
        <select id={id} name={name} required={required} className={cls} defaultValue="">
          <option value="">Select an option</option>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input id={id} name={name} type={type} required={required} placeholder={placeholder} maxLength={maxLength} accept={accept} className={cls} />
      )}
      {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>}
    </div>
  );
}

/** Email subscription box (sidebar / footer variants). */
export function SubscribeForm({ source }: { source: string }) {
  return (
    <SiteForm endpoint="subscribe" submitLabel="Subscribe" className="space-y-3" id="subscribe">
      <input type="hidden" name="source" value={source} />
      <label htmlFor={`sub-${source}`} className="sr-only">Email address</label>
      <input id={`sub-${source}`} name="email" type="email" required placeholder="Enter your email" className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-primary-500" />
    </SiteForm>
  );
}

/** FAQ search + category filter + accordion. */
export function FaqBrowser({ faqs, categories }: { faqs: { id: string; category: string; question: string; answer: string }[]; categories: { name: string; slug: string; icon: string | null; count: number }[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);
  useEffect(() => {
    const h = () => setCat(new URLSearchParams(location.hash.slice(1)).get('category') ?? '');
    h();
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const term = q.trim().toLowerCase();
  const list = faqs.filter((f) => (!cat || f.category === cat) && (!term || `${f.question} ${f.answer}`.toLowerCase().includes(term)));
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-xl border-2 border-primary-100 bg-white p-1.5 pl-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for a question (e.g., eligibility, documents, fees, scholarships…)" aria-label="Search questions" className="flex-1 bg-transparent py-2 text-[14px] outline-none" />
        <span className="rounded-lg bg-primary-800 px-5 py-2 font-serif text-sm font-bold text-white">Search</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Question categories">
        {[{ name: 'All FAQs', slug: '', count: faqs.length }, ...categories].map((c) => (
          <button key={c.slug} role="tab" aria-selected={cat === c.slug} onClick={() => setCat(c.slug)} className={clsx('rounded-lg border px-3 py-2 font-serif text-[13px] font-bold', cat === c.slug ? 'border-primary-800 bg-primary-800 text-white' : 'border-primary-100 bg-cream-50 text-primary-800 hover:border-primary-300')}>
            {c.name.split(' ')[0]} ({c.count})
          </button>
        ))}
      </div>
      {!list.length && <p className="rounded-lg bg-white p-6 text-center text-sm text-primary-900/70">No questions match your search.</p>}
      <div className="space-y-2.5">
        {list.map((f) => {
          const isOpen = open === f.id;
          return (
            <div key={f.id} className={clsx('rounded-xl border bg-white', isOpen ? 'border-primary-200 bg-primary-50/40' : 'border-primary-100')}>
              <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : f.id)}>
                <span className="flex-1 font-serif text-[16px] font-bold text-primary-800">{f.question}</span>
                <span className="text-2xl leading-none text-primary-800" aria-hidden>{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && <p className="px-4 pb-4 text-[14px] leading-relaxed text-primary-900">{f.answer}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Accessible tab set (content is rendered on the server and passed in). */
export function TabSet({ tabs }: { tabs: { id: string; label: string; icon?: ReactNode; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div>
      <div role="tablist" aria-label="Profile sections" className="mb-4 flex flex-wrap gap-2 rounded-xl border border-primary-100 bg-cream-50 p-1.5 print:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={clsx('flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 font-serif text-[14px] font-bold', active === t.id ? 'bg-gradient-to-b from-primary-700 to-primary-900 text-white' : 'text-primary-800 hover:bg-white')}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="print:!block">
          {t.content}
        </div>
      ))}
    </div>
  );
}

/** Horizontal scroller with arrow buttons (featured clubs, albums). */
export function Scroller({ children, label }: { children: ReactNode; label: string }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const by = (d: number) => el?.scrollBy({ left: d * el.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <div className="relative">
      <button type="button" onClick={() => by(-1)} aria-label={`Previous ${label}`} className="absolute -left-4 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-800 shadow md:flex">‹</button>
      <div ref={setEl} className="flex snap-x gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">{children}</div>
      <button type="button" onClick={() => by(1)} aria-label={`Next ${label}`} className="absolute -right-4 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-800 shadow md:flex">›</button>
    </div>
  );
}
