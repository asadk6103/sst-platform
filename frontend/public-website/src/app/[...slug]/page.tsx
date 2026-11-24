import type { Metadata } from 'next';
import { pageMetadata, renderPage } from '@/components/PageRenderer';

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageMetadata((await params).slug);
}

export default async function CmsPage({ params, searchParams }: Props) {
  return renderPage((await params).slug, await searchParams);
}
