import type { Metadata } from 'next';
import { pageMetadata, renderPage } from '@/components/PageRenderer';

export const generateMetadata = (): Promise<Metadata> => pageMetadata([]);

export default async function HomePage() {
  return renderPage([], {});
}
