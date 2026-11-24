// Screenshots pages at several viewport widths (fluid-layout check).
//   node scripts/widths.mjs <baseUrl> <path> [path …]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [base, ...paths] = process.argv.slice(2);
const OUT = 'documentation/screenshots/tmp/widths';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const w of [390, 1366, 1920, 2560]) {
  const page = await browser.newPage({ viewport: { width: w, height: 1000 } });
  for (const p of paths) {
    await page.goto(`${base}/${p}`, { waitUntil: 'networkidle' });
    const name = `${p.replace(/\//g, '_') || 'home'}-${w}.png`;
    await page.screenshot({ path: `${OUT}/${name}`, fullPage: w === 390 ? false : false });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${w}px ${p}: horizontal overflow ${overflow}px`);
  }
  await page.close();
}
await browser.close();
