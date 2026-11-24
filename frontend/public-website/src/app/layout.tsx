import type { Metadata } from 'next';
// Fonts are bundled (no download at build or run time).
import '@fontsource-variable/playfair-display/wght.css';
import '@fontsource-variable/playfair-display/wght-italic.css';
import '@fontsource-variable/montserrat/wght.css';
import { draftMode } from 'next/headers';
import { getSite, siteUrl } from '@/lib/api';
import { themeCss } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Footer } from '@/components/shell';
import './globals.css';


export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite().catch(() => null);
  const seo = site?.settings.seo ?? {};
  const og = seo.ogImage && site?.media[seo.ogImage]?.url;
  return {
    metadataBase: new URL(siteUrl(site)),
    title: { default: seo.defaultTitle ?? 'SST Public School Rashidabad', template: `%s${seo.titleSuffix ?? ' | SST Rashidabad'}` },
    description: seo.defaultDescription,
    keywords: seo.keywords,
    openGraph: { type: 'website', siteName: 'SST Public School Rashidabad', images: og ? [og] : undefined },
    icons: site?.settings.identity?.logo && site.media[site.settings.identity.logo] ? { icon: site.media[site.settings.identity.logo]!.url } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  const s = site.settings;
  const logo = s.identity?.logo ? site.media[s.identity.logo] : null;
  const preview = (await draftMode()).isEnabled;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss(s.theme) }} />
      </head>
      <body suppressHydrationWarning>
        <a href="#main" className="skip-link">Skip to main content</a>
        {preview && (
          <div className="sticky top-0 z-[60] flex items-center justify-center gap-3 bg-gold-400 px-4 py-1.5 text-sm font-semibold text-primary-900">
            Preview mode — you are viewing unpublished content.
            <a href="/cms-hooks/preview/exit" className="underline">Exit preview</a>
          </div>
        )}
        <Header main={site.navigation.MAIN ?? []} utility={site.navigation.UTILITY ?? []} contact={s.contact ?? {}} identity={s.identity ?? {}} logo={logo ? { src: logo.variants[0]?.url ?? logo.url, alt: logo.alt || 'SST logo' } : null} />
        <main id="main" tabIndex={-1} className="outline-none">{children}</main>
        <Footer site={site} />
      </body>
    </html>
  );
}

// Every page renders on request; API responses are cached (tag "cms") and refreshed on publish.
export const dynamic = 'force-dynamic';
