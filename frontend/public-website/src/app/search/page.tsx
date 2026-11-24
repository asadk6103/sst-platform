import Link from 'next/link';
import type { Metadata } from 'next';
import { api, getSite, qs } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { PageFrame } from '@/components/shell';
import { Empty } from '@/components/ui';

export const metadata: Metadata = { title: 'Search', robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim();
  const [site, data] = await Promise.all([getSite(), q.length >= 2 ? api(`/search${qs({ q })}`) : Promise.resolve(null)]);
  const results = data?.results ?? [];
  return (
    <PageFrame site={site} path="/search" sidebar={false} hero={{ eyebrow: 'SEARCH', title: 'Search', subtitle: 'Find pages, news, events, people and faculty across the SST website.' }}>
      <form action="/search" role="search" className="mb-6 flex max-w-2xl gap-2">
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" defaultValue={q} minLength={2} placeholder="Search the website…" className="flex-1 rounded-lg border-2 border-primary-200 bg-white px-4 py-2.5 outline-none focus:border-primary-500" />
        <button className="rounded-lg bg-primary-800 px-6 font-serif font-bold text-white">Search</button>
      </form>
      {q.length < 2 ? (
        <Empty>Type at least two characters to search.</Empty>
      ) : !results.length ? (
        <Empty>No results for “{q}”. Try a different word.</Empty>
      ) : (
        <>
          <p className="mb-3 text-sm text-primary-900">{results.length} result{results.length === 1 ? '' : 's'} for “{q}”</p>
          <ul className="space-y-3">
            {results.map((r: any, i: number) => (
              <li key={i}>
                <Link href={r.href} className="block rounded-xl border border-primary-100 bg-cream-50 p-4 shadow-card hover:shadow-lift">
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-gold-600">{r.type}{r.date ? ` · ${fmtDate(r.date)}` : ''}</span>
                  <span className="block font-serif text-[18px] font-bold text-primary-800">{r.title}</span>
                  {r.text && <span className="block text-[14px] text-primary-900">{r.text}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageFrame>
  );
}
