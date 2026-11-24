// Checks the website's navigation progress bar: appears during a slow client navigation, then hides.
//   node scripts/nav-progress-check.mjs <websiteBase>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:3100';
const OUT = 'documentation/screenshots/tmp/nav-progress';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 120000 });
const bar = page.locator('div[aria-hidden].fixed.top-0 > div');
const state = async () => bar.evaluate((el) => ({ width: el.style.width, opacity: getComputedStyle(el.parentElement).opacity }));
console.log('idle on load:', await state());

// Delay the server-component payload so the navigation takes ~2.5 s.
await page.route('**/*', async (route) => {
  if (route.request().headers()['rsc'] === '1') await new Promise((r) => setTimeout(r, 2500));
  await route.continue();
});

const link = page.locator('header a[href^="/"]:not([href="/"])').first();
const href = await link.getAttribute('href');
console.log('clicking', href);
await link.click();
await page.waitForTimeout(1200);
const mid = await state();
console.log('mid-navigation:', mid);
await page.screenshot({ path: `${OUT}/mid.png`, clip: { x: 0, y: 0, width: 1366, height: 120 } });
await page.waitForURL((u) => u.pathname === href, { timeout: 60000 });
await page.waitForTimeout(800);
const after = await state();
console.log('after navigation:', after);

// Same-page hash link must not start the bar.
await page.evaluate(() => { const a = document.createElement('a'); a.href = '#main'; a.id = 'hash-test'; a.textContent = 'x'; document.body.append(a); });
await page.click('#hash-test');
await page.waitForTimeout(500);
console.log('after #hash click:', await state());

const ok = parseFloat(mid.width) > 0 && mid.opacity === '1' && after.opacity === '0';
console.log(ok ? '✓ bar shows during navigation and hides afterwards' : '✗ unexpected bar behaviour');
console.log(errors.length ? `Page errors: ${errors.join(' | ')}` : 'No page errors.');
await browser.close();
