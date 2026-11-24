// Bundles the API (including the @sst/shared workspace package) into dist/server.js.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
const external = Object.keys(pkg.dependencies).filter((d) => d !== '@sst/shared');

// server.js — the API; seed.js — the idempotent seed run by the container entrypoint.
await build({
  entryPoints: { server: 'src/server.ts', seed: 'prisma/seed.ts' },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  external,
  sourcemap: true,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
console.log('Built dist/server.js and dist/seed.js');
