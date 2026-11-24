import { getSite } from '@/lib/api';
import { PageFrame } from '@/components/shell';
import { Button } from '@/components/ui';

export default async function NotFound() {
  const site = await getSite();
  return (
    <PageFrame site={site} path="/404" sidebar={false} hero={{ eyebrow: 'ERROR 404', title: 'Page Not Found', subtitle: 'The page you are looking for may have been moved or no longer exists.' }}>
      <div className="mx-auto max-w-xl py-10 text-center">
        <p className="font-serif text-[80px] font-bold leading-none text-primary-200">404</p>
        <p className="mt-2 text-primary-900">Try searching the website or return to the homepage.</p>
        <form action="/search" className="mx-auto mt-5 flex max-w-md gap-2">
          <input name="q" aria-label="Search" placeholder="Search…" className="flex-1 rounded-lg border-2 border-primary-200 px-4 py-2" />
          <button className="rounded-lg bg-primary-800 px-5 font-serif font-bold text-white">Search</button>
        </form>
        <Button href="/" className="mt-6">Back to Home</Button>
      </div>
    </PageFrame>
  );
}
