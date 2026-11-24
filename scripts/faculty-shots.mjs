// Screenshots of the faculty overview section and the faculty directory at desktop and phone widths.
//   node scripts/faculty-shots.mjs <websiteBase>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:3100';
const OUT = 'documentation/screenshots/tmp/faculty';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [label, width] of [['desktop', 1366], ['phone', 390]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${base}/academics/faculty`, { waitUntil: 'networkidle', timeout: 120000 });
  const sec = page.locator('section', { has: page.getByRole('heading', { name: 'Meet Our Faculty' }) }).first();
  await sec.scrollIntoViewIfNeeded();
  await sec.screenshot({ path: `${OUT}/featured-${label}.png` });
  await page.goto(`${base}/academics/faculty/directory`, { waitUntil: 'networkidle', timeout: 120000 });
  const grid = page.locator('div.grid', { has: page.getByText('View Profile').first() }).first();
  await grid.screenshot({ path: `${OUT}/directory-${label}.png` });
  console.log(label, 'directory columns:', await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length));
  await page.close();
}
await browser.close();
