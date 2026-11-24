// Admin portal smoke test: signs in, opens every screen, records console errors and failed
// API calls, and saves a screenshot per screen.
//   node scripts/admin-smoke.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3001/admin';
const OUT = process.argv[3] ?? 'documentation/screenshots/tmp/admin';
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@sst.edu.pk';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe!2026';
mkdirSync(OUT, { recursive: true });

const screens = [
  ['dashboard', '/'],
  ['workflow', '/workflow'],
  ['pages', '/pages'],
  ['page-home', '/pages/home'],
  ['navigation', '/navigation'],
  ['statistics', '/statistics'],
  ['board', '/committees/board-of-trustees'],
  ['school-admin', '/committees/school-administration'],
  ['people', '/people'],
  ['messages', '/messages'],
  ['news', '/posts/news'],
  ['events', '/events'],
  ['testimonials', '/stories/testimonials'],
  ['alumni-stories', '/stories/alumni'],
  ['media', '/media'],
  ['galleries', '/galleries'],
  ['documents', '/documents'],
  ['settings-identity', '/settings/identity'],
  ['settings-website', '/settings/website'],
  ['users', '/users'],
  ['roles', '/roles'],
  ['revisions', '/revisions'],
  ['audit', '/audit'],
  ['account', '/account'],
  ['faculty', '/faculty'],
  ['results', '/results'],
  ['vacancies', '/vacancies'],
  ['faqs', '/faqs'],
  ['categories', '/categories'],
  ['submissions', '/submissions'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('response', (r) => r.url().includes('/api/') && r.status() >= 400 && !r.url().endsWith('/auth/refresh') && problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`));

await page.goto(`${BASE}/login`);
await page.fill('#email', EMAIL);
await page.fill('#password', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });

for (const [name, path] of screens) {
  const before = problems.length;
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const heading = await page.locator('h1').first().textContent().catch(() => '(no h1)');
  console.log(`${problems.length > before ? '✗' : '✓'} ${name.padEnd(18)} ${heading}`);
}
// Open the first people record and the first page editor via list clicks
await page.goto(`${BASE}/people`);
await page.waitForLoadState('networkidle');
await page.locator('tbody tr').first().click();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${OUT}/person-editor.png`, fullPage: true });
console.log(`✓ person editor      ${await page.locator('h1').first().textContent()}`);

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s):\n${[...new Set(problems)].join('\n')}` : '\nNo console errors or failed API calls.');
