// Opens pages in a clean headless browser and prints any React hydration / console errors.
//   node scripts/hydration-check.mjs <baseUrl> <path> [path …]
import { chromium } from 'playwright';

const [base, ...paths] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 1000 } });
for (const p of paths) {
  const msgs = [];
  const onMsg = (m) => (m.type() === 'error' || m.type() === 'warning') && msgs.push(m.text());
  page.on('console', onMsg);
  page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message));
  await page.goto(`${base}/${p}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1500);
  page.off('console', onMsg);
  const hyd = process.env.ALL ? msgs : msgs.filter((m) => /hydrat|did not match|didn't match|418|425|423/i.test(m));
  console.log(`/${p}: ${hyd.length ? 'HYDRATION MISMATCH' : 'ok'} (${msgs.length} console errors/warnings)`);
  for (const m of hyd) console.log('   ', m.slice(0, 1500).replace(/\n/g, '\n    '));
}
await browser.close();
