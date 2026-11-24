// Walks through the first-run setup wizard in a browser, then opens Administration → System.
//   node scripts/setup-ui-check.mjs <adminBase> <setupCode>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [base, code] = process.argv.slice(2);
const OUT = 'documentation/screenshots/tmp/setup';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${base}/`);
await page.waitForURL(/\/setup$/, { timeout: 20000 });
console.log('✓ unclaimed install redirects to /setup');
await page.screenshot({ path: `${OUT}/1-code.png` });
await page.getByLabel(/^Setup code/).fill(code);
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByLabel(/^Full name/).fill('Asad Admin');
await page.getByLabel(/^Email/).fill('owner@example.org');
await page.getByLabel(/^Password/).fill('Str0ngPassword!');
await page.getByLabel(/^Confirm password/).fill('Str0ngPassword!');
await page.screenshot({ path: `${OUT}/2-admin.png` });
await page.getByRole('button', { name: 'Continue' }).click();
await page.screenshot({ path: `${OUT}/3-site.png` });
await page.getByRole('button', { name: 'Finish setup' }).click();
await page.waitForURL((u) => !u.pathname.endsWith('/setup'), { timeout: 20000 });
await page.waitForLoadState('networkidle');
console.log('✓ wizard finished and signed in:', await page.locator('h1').first().textContent());
await page.goto(`${base}/system`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${OUT}/4-system.png`, fullPage: true });
console.log('✓ System page:', await page.locator('h1').first().textContent());
await page.goto(`${base}/setup`);
await page.waitForTimeout(1500);
console.log('✓ /setup after setup goes to:', new URL(page.url()).pathname);
await browser.close();
console.log(errors.length ? `Page errors: ${errors.join(' | ')}` : 'No page errors.');
