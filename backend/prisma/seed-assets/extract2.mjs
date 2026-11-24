// Second batch of PLACEHOLDER imagery (academics, admissions, campus life, news & events, careers),
// cropped from the approved design mock-ups. Replace via Admin → Media Library.
// Usage: node prisma/seed-assets/extract2.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const refs = join(here, '../../../documentation/design-references');
const out = join(here, 'images');
const F = {
  support: 'Academic Support at SST.png',
  library: 'SST Libraries & Resources Page.png',
  faculty: 'SST Public School Faculty Page.png',
  dir: 'SST Faculty Directory Page.png',
  profile: 'SST Faculty Profile_ Inspiring Young Minds.png',
  assess: 'SST Assessment & Reporting Page.png',
  cal: 'SST Academic Calendar 2026–2027.png',
  ach: 'Academic Excellence at SST.png',
  high: 'SST High Achievers Excellence Page.png',
  adm: 'SST Admissions Portal Overview.png',
  grades: 'SST Grade Levels Admissions Journey.png',
  dates: 'Important Dates_ Admissions 2026–2027.png',
  docs: 'SST Required Documents Admissions Page.png',
  campus: 'SST Campus Life Overview.png',
  clubs: 'SST Clubs & Societies Campus Life Page.png',
  welfare: 'Student Welfare Support at SST.png',
  res: 'Residential Life at SST.png',
  house: 'SST House System Showcase.png',
  sports: 'SST Sports & Activities Campus Life Page.png',
  news: 'SST Latest News Webpage UI.png',
  events: 'SST Events Page_ Purple-Gold School Calendar.png',
  achv: 'SST Achievements_ Celebrating Excellence.png',
  gallery: 'SST Gallery_ Campus Life in Focus.png',
  careers: 'Careers at SST_ Build a Meaningful Future.png',
};
const row = (file, prefix, names, y1, y2, xs) => Object.fromEntries(names.map((n, i) => [`${prefix}-${n}`, [file, xs[i][0], y1, xs[i][1], y2]]));
const X5 = [[263, 428], [441, 601], [614, 774], [787, 946], [959, 1118]];
const X6dir = [[378, 550], [565, 737], [751, 923], [938, 1110], [1125, 1297], [1312, 1484]];
const X4 = [[339, 529], [544, 734], [749, 939], [954, 1142]];
const crops = {
  'support-mentoring': [F.support, 378, 518, 744, 714],
  ...row(F.support, 'support', ['remedial', 'mentoring', 'counselling', 'individual', 'enrichment'], 768, 842, X5),
  'library-reading': [F.library, 377, 517, 744, 714],
  ...row(F.library, 'library', ['lending', 'digital', 'research', 'reading', 'study'], 771, 847, [[262, 425], [439, 598], [611, 771], [784, 943], [957, 1116]]),
  'faculty-team': [F.faculty, 372, 460, 751, 627],
  ...row(F.dir, 'faculty', ['ayesha-khurram', 'muhammad-farhan', 'sana-muneer', 'imran-ali', 'bilal-ahmed', 'zara-shah'], 493, 578, X6dir),
  ...row(F.dir, 'faculty', ['faisal-kamran', 'hina-iqbal', 'usman-raza', 'nadia-khan', 'rehan-siddiqui', 'mahnoor-ali'], 722, 807, X6dir),
  'faculty-ayesha-khurram-large': [F.profile, 70, 312, 376, 624],
  'assessment-exam': [F.assess, 1104, 305, 1492, 500],
  'calendar-desk': [F.cal, 1038, 301, 1488, 488],
  'achievements-trophy': [F.ach, 380, 505, 746, 675],
  ...row(F.high, 'achiever', ['ayesha-khan', 'ali-raza', 'usman-ali', 'zara-siddiqui', 'hina-iqbal'], 527, 630, [[400, 550], [630, 780], [858, 1008], [1085, 1235], [1312, 1462]]),
  'admissions-students': [F.adm, 1104, 304, 1486, 496],
  'art-grades': [F.grades, 1282, 300, 1490, 395],
  'art-calendar': [F.dates, 1240, 293, 1490, 392],
  'art-documents': [F.docs, 1250, 296, 1484, 392],
  ...row(F.campus, 'campus-card', ['residential', 'house', 'sports', 'welfare', 'clubs'], 452, 538, [[351, 567], [582, 798], [813, 1029], [1044, 1261], [1276, 1492]]),
  'clubs-robotics': [F.clubs, 354, 432, 807, 657],
  ...row(F.clubs, 'club', ['robotics', 'debating', 'drama', 'music', 'art', 'environment'], 720, 803, [[389, 557], [569, 737], [749, 917], [929, 1100], [1113, 1282], [1294, 1462]]),
  'hero-clubs': [F.clubs, 560, 118, 1536, 262],
  'welfare-counselling': [F.welfare, 354, 430, 780, 632],
  'welfare-health-centre': [F.welfare, 1180, 430, 1494, 632],
  'residential-room': [F.res, 358, 424, 819, 630],
  'residential-students': [F.res, 1188, 424, 1494, 630],
  'hero-residential': [F.res, 640, 118, 1536, 262],
  ...row(F.house, 'crest', ['lions', 'eagles', 'stags', 'sailors'], 432, 515, [[450, 526], [738, 815], [1027, 1103], [1315, 1392]]),
  'house-students': [F.house, 352, 635, 711, 829],
  'hero-houses': [F.house, 560, 118, 1536, 262],
  'sports-ground': [F.sports, 352, 429, 749, 635],
  ...row(F.sports, 'sport', ['football', 'cricket', 'basketball', 'hockey', 'athletics', 'swimming'], 688, 798, [[357, 536], [547, 726], [737, 914], [926, 1107], [1119, 1300], [1312, 1493]]),
  'hero-sports': [F.sports, 560, 118, 1536, 262],
  'hero-campus-2': [F.news, 520, 118, 1536, 260],
  'news-trophy': [F.news, 350, 386, 804, 575],
  ...row(F.news, 'news', ['football-2', 'olympiad', 'lecture'], 603, 693, [[351, 612], [637, 899], [924, 1187]]),
  ...row(F.news, 'news', ['plantation', 'science-week', 'cultural'], 771, 848, [[351, 612], [637, 899], [924, 1187]]),
  'event-sports-week': [F.events, 338, 418, 764, 575],
  ...row(F.events, 'event', ['debate', 'exhibition', 'founders', 'cultural'], 631, 713, X4),
  ...row(F.events, 'event', ['football', 'olympiad', 'plantation', 'talk'], 839, 899, [[339, 526], [544, 731], [749, 936], [954, 1140]]),
  'achv-olympiad': [F.achv, 338, 423, 705, 587],
  ...row(F.achv, 'achv', ['maths', 'football', 'debating', 'cultural'], 638, 700, [[334, 533], [548, 747], [762, 962], [977, 1176]]),
  ...row(F.achv, 'achv', ['innovation', 'cadet', 'arts', 'swimming'], 789, 850, [[334, 533], [548, 747], [762, 962], [977, 1176]]),
  'album-featured': [F.gallery, 372, 428, 800, 600],
  ...row(F.gallery, 'album', ['science', 'football', 'cultural', 'lecture'], 663, 712, [[341, 537], [552, 748], [763, 958], [973, 1168]]),
  ...row(F.gallery, 'album', ['plantation', 'olympiad', 'guest', 'cadet'], 809, 857, [[341, 537], [552, 748], [763, 958], [973, 1168]]),
  'video-campus': [F.gallery, 1206, 540, 1481, 673],
  'careers-team': [F.careers, 1103, 314, 1487, 460],
};
for (const [name, [file, l, t, r, b]] of Object.entries(crops)) {
  await sharp(join(refs, file)).extract({ left: l, top: t, width: r - l, height: b - t }).jpeg({ quality: 92 }).toFile(join(out, `${name}.jpg`));
}
console.log(`Extracted ${Object.keys(crops).length} placeholder images`);
