// Visual comparison: screenshots website pages at the reference width and writes
// side-by-side images (design | implementation) for review.
//   node scripts/compare.mjs [baseUrl] [name …]
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const only = process.argv.slice(3);
const REF = 'documentation/design-references';
const OUT = 'documentation/screenshots/tmp/compare';
mkdirSync(OUT, { recursive: true });

export const PAGES = [
  ['home', '/', 'SST Rashidabad_ Excellence in Education.png'],
  ['about', '/about', 'SST About School Legacy Page.png'],
  ['history', '/about/history-heritage', 'SST History & Heritage Website.png'],
  ['vision', '/about/vision-mission-values', 'Vision, Mission & Values at SST.png'],
  ['leadership', '/about/leadership-governance', 'SST Leadership and Governance Page.png'],
  ['chairman', '/about/leadership-governance/chairmans-message', 'Chairman’s Message — SST Rashidabad.png'],
  ['board', '/about/leadership-governance/board-of-trustees', 'SST Board of Trustees Directory.png'],
  ['trustee', '/about/leadership-governance/board-of-trustees/ahmed-raza', 'SST Trustee Profile Page.png'],
  ['executive', '/about/leadership-governance/executive-committee', 'SST Executive Committee Leadership Page.png'],
  ['administration', '/about/leadership-governance/school-administration', 'School Administration Leadership & Governance.png'],
  ['governance', '/about/leadership-governance/governance-framework', 'SST Governance Framework Website UI.png'],
  ['why', '/about/why-choose-sst', 'Why Choose SST_ Excel to Lead.png'],
  ['impact', '/about/our-impact', 'SST Our Impact_ Nurturing Leaders.png'],
  ['campus-location', '/about/campus-location', 'SST Campus & Location Website Mockup.png'],
  ['academics', '/academics', 'SST Academics_ Excellence to Lead.png'],
  ['programmes', '/academics/programmes', 'SST Academic Programmes Showcase.png'],
  ['middle', '/academics/programmes/middle-school', 'SST Middle School Programme Details.png'],
  ['curriculum', '/academics/curriculum', 'SST Curriculum Page_ Excellence in Education.png'],
  ['teaching', '/academics/teaching-learning', 'Teaching & Learning at SST.png'],
  ['calendar', '/academics/academic-calendar', 'SST Academic Calendar 2026–2027.png'],
  ['assessment', '/academics/assessment-reporting', 'SST Assessment & Reporting Page.png'],
  ['support', '/academics/academic-support', 'Academic Support at SST.png'],
  ['libraries', '/academics/libraries-resources', 'SST Libraries & Resources Page.png'],
  ['faculty', '/academics/faculty', 'SST Public School Faculty Page.png'],
  ['directory', '/academics/faculty/directory', 'SST Faculty Directory Page.png'],
  ['faculty-profile', '/academics/faculty/ayesha-khurram', 'SST Faculty Profile_ Inspiring Young Minds.png'],
  ['achievements-acad', '/academics/academic-achievements', 'Academic Excellence at SST.png'],
  ['detailed', '/academics/academic-achievements/detailed-results', 'SST Detailed Academic Results Dashboard.png'],
  ['achievers', '/academics/academic-achievements/high-achievers', 'SST High Achievers Excellence Page.png'],
  ['admissions', '/admissions', 'SST Admissions Portal Overview.png'],
  ['eligibility', '/admissions/eligibility-criteria', 'SST Eligibility Criteria Page.png'],
  ['process', '/admissions/admission-process', 'SST Admission Process Webpage.png'],
  ['grades', '/admissions/grade-levels', 'SST Grade Levels Admissions Journey.png'],
  ['dates', '/admissions/important-dates', 'Important Dates_ Admissions 2026–2027.png'],
  ['documents', '/admissions/required-documents', 'SST Required Documents Admissions Page.png'],
  ['fees', '/admissions/fees-scholarships', 'SST Fees & Scholarships Admissions Page.png'],
  ['faqs', '/admissions/faqs', 'SST Admissions FAQs Webpage Interface.png'],
  ['campus', '/campus-life', 'SST Campus Life Overview.png'],
  ['residential', '/campus-life/residential-life', 'Residential Life at SST.png'],
  ['houses', '/campus-life/house-system', 'SST House System Showcase.png'],
  ['sports', '/campus-life/sports-activities', 'SST Sports & Activities Campus Life Page.png'],
  ['welfare', '/campus-life/student-welfare', 'Student Welfare Support at SST.png'],
  ['clubs', '/campus-life/clubs-societies', 'SST Clubs & Societies Campus Life Page.png'],
  ['news', '/news-events', 'SST Latest News Webpage UI.png'],
  ['events', '/news-events/events', 'SST Events Page_ Purple-Gold School Calendar.png'],
  ['announcements', '/news-events/announcements', 'SST Announcements Page Mockup.png'],
  ['achievements', '/news-events/achievements', 'SST Achievements_ Celebrating Excellence.png'],
  ['gallery', '/news-events/gallery', 'SST Gallery_ Campus Life in Focus.png'],
  ['contact', '/contact', 'SST Contact Us Page Design.png'],
  ['careers', '/careers', 'Careers at SST_ Build a Meaningful Future.png'],
  ['downloads', '/downloads', 'SST Public School Downloads Page.png'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
for (const [name, path, ref] of PAGES.filter(([n]) => !only.length || only.includes(n))) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const shot = await page.screenshot({ fullPage: true });
  const refMeta = await sharp(`${REF}/${ref}`).metadata();
  const H = 1400;
  const left = await sharp(`${REF}/${ref}`).resize({ width: 1536 * (refMeta.width / 1536) > 0 ? 1536 : 1536 }).resize({ height: H, fit: 'contain', background: '#fff' }).toBuffer();
  const lm = await sharp(left).metadata();
  const right = await sharp(shot).resize({ width: 1536 }).toBuffer();
  const rm = await sharp(right).metadata();
  const rightScaled = await sharp(right).resize({ height: Math.round((rm.height * lm.width) / 1536) > 0 ? undefined : undefined, width: lm.width }).toBuffer();
  const r2 = await sharp(rightScaled).metadata();
  const height = Math.max(lm.height, r2.height);
  await sharp({ create: { width: lm.width * 2 + 20, height, channels: 3, background: '#888' } })
    .composite([{ input: left, left: 0, top: 0 }, { input: rightScaled, left: lm.width + 20, top: 0 }])
    .jpeg({ quality: 70 })
    .toFile(`${OUT}/${name}.jpg`);
  console.log(`✓ ${name}  (page height ${rm.height}px)`);
}
await browser.close();
if (errors.length) console.log('Page errors:', [...new Set(errors)]);
