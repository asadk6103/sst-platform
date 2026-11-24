import type { Metadata } from 'next';
import { getSite } from '@/lib/api';
import { PageFrame } from '@/components/shell';
import { Button, Icon } from '@/components/ui';

export const metadata: Metadata = { title: 'Coming soon', robots: { index: false } };

export default async function ComingSoon({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const site = await getSite();
  const from = (await searchParams).from ?? '';
  const find = (items: any[]): any => items.flatMap((i) => [i, ...find(i.children ?? [])]);
  const item = Object.values(site.navigation).flatMap(find).find((i: any) => i.href === from);
  const title = item?.label ?? 'Coming Soon';
  return (
    <PageFrame site={site} path="/coming-soon" sidebar={false} hero={{ eyebrow: 'COMING SOON', title, subtitle: site.settings.website?.comingSoonText ?? 'This section is coming soon.' }}>
      <div className="mx-auto max-w-xl rounded-xl border border-primary-100 bg-cream-50 px-6 py-12 text-center shadow-card">
        <Icon name="Hourglass" className="mx-auto h-14 w-14 text-gold-500" strokeWidth={1.3} />
        <h2 className="mt-3 font-serif text-[28px] font-bold text-primary-800">{title} is coming soon</h2>
        <p className="mt-2 text-primary-900">{site.settings.website?.comingSoonText ?? 'We are working on this section. Please check back later.'}</p>
        <Button href="/" className="mt-6">Back to Home</Button>
      </div>
    </PageFrame>
  );
}
