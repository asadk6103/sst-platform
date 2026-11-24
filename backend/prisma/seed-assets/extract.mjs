// Extracts PLACEHOLDER imagery from the approved design mock-ups (documentation/design-references)
// so the seeded website matches the designs until official photographs are uploaded.
// Every extracted file is low resolution and must be replaced via Admin → Media Library.
//
// Usage: node prisma/seed-assets/extract.mjs
import sharp from 'sharp';
import { mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const refs = join(here, '../../../documentation/design-references');
const out = join(here, 'images');
mkdirSync(out, { recursive: true });

const F = {
  home: 'SST Rashidabad_ Excellence in Education.png',
  about: 'SST About School Legacy Page.png',
  history: 'SST History & Heritage Website.png',
  vision: 'Vision, Mission & Values at SST.png',
  leadership: 'SST Leadership and Governance Page.png',
  chairman: 'Chairman’s Message — SST Rashidabad.png',
  board: 'SST Board of Trustees Directory.png',
  admin: 'School Administration Leadership & Governance.png',
  why: 'Why Choose SST_ Excel to Lead.png',
  impact: 'SST Our Impact_ Nurturing Leaders.png',
};

// name: [file, left, top, right, bottom, options]
const crops = {
  'hero-campus': [F.about, 520, 136, 1199, 338],
  'home-hero-campus': [F.home, 440, 156, 1024, 362],
  'home-students-library': [F.home, 50, 508, 452, 727],
  'campus-sports': [F.home, 41, 1106, 220, 1187],
  'campus-discipline': [F.home, 234, 1106, 411, 1187],
  'campus-library': [F.home, 426, 1106, 603, 1187],
  'campus-arts': [F.home, 617, 1106, 792, 1187],
  'campus-community': [F.home, 806, 1106, 985, 1187],
  'news-guest-lecture': [F.home, 304, 1251, 515, 1320],
  'news-football': [F.home, 535, 1251, 746, 1320],
  'news-science-fair': [F.home, 767, 1251, 986, 1320],
  'students-studying': [F.about, 343, 633, 672, 836],
  'explore-history': [F.about, 34, 1004, 210, 1082],
  'explore-vision': [F.about, 232, 1004, 409, 1082],
  'explore-leadership': [F.about, 434, 1004, 600, 1082],
  'explore-why': [F.about, 625, 1004, 787, 1082],
  'explore-impact': [F.about, 809, 1004, 973, 1082],
  'explore-campus': [F.about, 1000, 1004, 1166, 1082],
  'virtual-tour': [F.about, 42, 728, 292, 851],
  'history-legacy': [F.history, 340, 528, 672, 676],
  'years-gate': [F.history, 508, 1005, 714, 1132],
  'years-parade': [F.history, 732, 1005, 935, 1132],
  'years-campus': [F.history, 950, 1005, 1168, 1132],
  'values-student-flag': [F.vision, 973, 717, 1177, 1001],
  'executive-meeting': [F.leadership, 322, 928, 516, 1017],
  'why-students': [F.why, 1182, 314, 1496, 649],
  'impact-alumnus': [F.impact, 628, 584, 764, 737],
  'impact-alumni-monument': [F.impact, 1318, 539, 1495, 763],
  'banner-campus-art': [F.why, 96, 774, 600, 851, { grayscale: true }],
  'sketch-campus': [F.board, 1160, 318, 1505, 444, { grayscale: true }],
  'signature-chairman': [F.chairman, 676, 712, 834, 757, { grayscale: true }],
  // Portraits (Board of Trustees directory)
  'portrait-ahmed-raza': [F.chairman, 384, 346, 622, 654],
  'portrait-tariq-mahmood': [F.board, 619, 459, 815, 578],
  'portrait-kamran-siddiqui': [F.admin, 379, 411, 579, 543],
  'portrait-imran-ahmad': [F.board, 1069, 459, 1265, 578],
  'portrait-faisal-khan': [F.board, 1293, 459, 1489, 578],
  'portrait-salman-ali': [F.board, 395, 657, 591, 766],
  'portrait-asad-mahmood': [F.board, 619, 657, 815, 766],
  'portrait-nadeem-hassan': [F.board, 844, 657, 1040, 766],
  'portrait-zahid-iqbal': [F.board, 1069, 657, 1265, 766],
  'portrait-omer-farooq': [F.board, 1293, 657, 1489, 766],
  'portrait-sara-ahmed': [F.admin, 670, 631, 789, 697],
  'portrait-ayesha-khan': [F.admin, 1088, 631, 1207, 697],
};

for (const [name, [file, l, t, r, b, opts = {}]] of Object.entries(crops)) {
  let img = sharp(join(refs, file)).extract({ left: l, top: t, width: r - l, height: b - t });
  if (opts.grayscale) img = img.grayscale();
  await img.jpeg({ quality: 92 }).toFile(join(out, `${name}.jpg`));
}
copyFileSync(join(here, '../../../../_incoming_logo/sst-logo.jpg'), join(out, 'sst-logo.jpg'));
console.log(`Extracted ${Object.keys(crops).length} placeholder images to ${out}`);
