/** @type {import('next').NextConfig} */
const api = process.env.API_INTERNAL_URL ?? 'http://localhost:4200';
export default {
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@sst/shared'],
  // Behind nginx these paths never reach Next.js; without nginx (development, previews) they are
  // forwarded to the API so images and website forms keep working.
  async rewrites() {
    return [
      { source: '/uploads/:path*', destination: `${api}/uploads/:path*` },
      { source: '/api/public/:path*', destination: `${api}/api/public/:path*` },
    ];
  },
  experimental: { optimizePackageImports: ['lucide-react'] },
};
