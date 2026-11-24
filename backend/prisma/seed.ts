/**
 * Seed data for the SST platform.
 *
 * - Roles & permissions are always synchronised (safe to re-run).
 * - Website content is inserted only when the database has no pages, unless `--reset` is passed.
 *
 * ALL institutional text, names, dates and figures below are transcribed from the approved UI
 * designs and are PLACEHOLDER content until verified by SST. Images are placeholders cropped from
 * the design mock-ups (prisma/seed-assets/images). See documentation/PLACEHOLDER-CONTENT.md.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, DEFAULT_ROLES } from '@sst/shared';
import { storeFile } from '../src/modules/media/storage';
import { pagesConfig, peopleConfig, messagesConfig, postsConfig, storiesConfig } from '../src/modules/content/entities';
import { writeRevision, type ContentConfig } from '../src/modules/content/content-factory';
import { syncMediaUsage } from '../src/lib/media-refs';
import { seedV2, seedNavigationV2 } from './seed-v2';

const prisma = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));
const RESET = process.argv.includes('--reset');

// ───────────────────────── Roles & permissions ─────────────────────────
async function seedAccess() {
  const knownBefore = new Set((await prisma.permission.findMany({ select: { key: true } })).map((p) => p.key));
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, update: { module: p.module, description: p.description }, create: p });
  }
  await prisma.permission.deleteMany({ where: { key: { notIn: PERMISSIONS.map((p) => p.key) } } });
  const perms = await prisma.permission.findMany();
  const permId = new Map(perms.map((p) => [p.key, p.id]));
  for (const r of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description, isSystem: true },
      create: { key: r.key, name: r.name, description: r.description, isSystem: true },
    });
    // Built-in roles are reset to their defaults only on first creation or for super_admin.
    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existing === 0 || r.key === 'super_admin') {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermission.createMany({ data: [...new Set(r.permissions)].map((k) => ({ roleId: role.id, permissionId: permId.get(k)! })) });
    } else if (knownBefore.size) {
      // Grant only permissions introduced since the last seed; administrators' edits are kept.
      const added = [...new Set(r.permissions)].filter((k) => !knownBefore.has(k));
      if (added.length) await prisma.rolePermission.createMany({ data: added.map((k) => ({ roleId: role.id, permissionId: permId.get(k)! })), skipDuplicates: true });
    }
  }
  // Optional: unattended installs may pre-create the first administrator via environment.
  // Otherwise it is created in the first-run setup wizard (Administration portal).
  if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) return;
  const email = process.env.SEED_ADMIN_EMAIL.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const superRole = await prisma.role.findUniqueOrThrow({ where: { key: 'super_admin' } });
  if (!(await prisma.user.findUnique({ where: { email } }))) {
    await prisma.user.create({
      data: { email, name: 'System Administrator', passwordHash: await bcrypt.hash(password, 12), roles: { create: [{ roleId: superRole.id }] } },
    });
    console.log(`Created super administrator ${email}`);
  }
}

// ───────────────────────── Helpers ─────────────────────────
const media: Record<string, string> = {};
async function seedMedia() {
  // Works both from prisma/seed.ts (tsx) and from the bundled dist/seed.js (Docker).
  const dir = imagesDir();
  const alt: Record<string, string> = {
    'sst-logo': 'SST Public School Rashidabad logo',
    'hero-campus': 'SST Rashidabad campus main building',
    'home-hero-campus': 'SST Rashidabad campus with the national flag',
    'home-students-library': 'SST students reading together in the library',
    'students-studying': 'SST students studying in the library',
    'values-student-flag': 'SST students looking up at the national flag',
    'why-students': 'SST students on campus',
    'executive-meeting': 'Executive Committee meeting',
  };
  const V1 = new Set(['sst-logo', 'hero-campus', 'home-hero-campus', 'home-students-library', 'students-studying', 'values-student-flag', 'why-students', 'executive-meeting', 'history-legacy', 'virtual-tour', 'banner-campus-art', 'sketch-campus', 'signature-chairman', 'impact-alumnus', 'impact-alumni-monument']);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jpg') && (V1.has(f.replace(/.jpg$/, '')) || /^(campus|news|explore|years|portrait)-/.test(f)))) {
    const name = file.replace(/\.jpg$/, '');
    const id = crypto.randomUUID();
    const stored = await storeFile(id, readFileSync(join(dir, file)));
    const category = name.startsWith('portrait') || name.startsWith('signature') ? 'leadership' : name === 'sst-logo' ? 'branding' : name.startsWith('news') ? 'news' : 'campus';
    const personName = name.startsWith('portrait-') ? name.replace('portrait-', '').split('-').map((s) => s[0]!.toUpperCase() + s.slice(1)).join(' ') : null;
    await prisma.media.create({
      data: {
        id,
        originalName: file,
        ...stored,
        alt: alt[name] ?? (personName ? `Portrait of ${personName}` : name.replace(/-/g, ' ')),
        caption: name === 'sst-logo' ? null : 'PLACEHOLDER — cropped from the design mock-up; replace with the official photograph',
        category,
      },
    });
    media[name] = id;
  }
}
const M = (name: string) => {
  if (!media[name]) throw new Error(`Missing seed image ${name}`);
  return media[name]!;
};

/** Minimal valid one-page PDF used as a stand-in for documents that have not been supplied. */
function placeholderPdf(title: string): Buffer {
  const text = `${title} - PLACEHOLDER: the official document has not been uploaded yet.`.replace(/[()\\]/g, '');
  const stream = `BT /F1 14 Tf 60 760 Td (${text.slice(0, 90)}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

async function publishRow(cfg: ContentConfig, id: string) {
  const row = await cfg.delegate().findUnique({ where: { id }, include: cfg.include });
  const snapshot = await cfg.serialize(row);
  const updated = await cfg.delegate().update({ where: { id }, data: { status: 'PUBLISHED', publishedData: snapshot, publishedAt: new Date() } });
  await writeRevision(cfg, updated, 'PUBLISH', undefined, 'Initial seed content');
  await syncMediaUsage(cfg.type, id, updated, cfg.titleOf(updated));
}

// ───────────────────────── Settings & navigation ─────────────────────────
async function seedSettings() {
  const settings: Record<string, any> = {
    identity: {
      logo: M('sst-logo'),
      nameLine1: 'SARGODHAN SPIRIT TRUST',
      nameLine2: 'PUBLIC SCHOOL',
      nameLine3: 'RASHIDABAD',
      shortName: 'SST',
      motto: 'EXCEL TO LEAD',
      copyright: '© {year} Sargodhan Spirit Trust Public School, Rashidabad. All Rights Reserved.',
    },
    theme: { preset: 'navy', primary: '', accent: '' },
    contact: { address: 'Rashidabad, Tando Allahyar, Sindh, Pakistan', phone: '+92-22-3890061-4', email: 'info@sst.edu.pk', mapUrl: '', officeHours: '' },
    social: { facebook: '', instagram: '', youtube: '', linkedin: '', x: '' },
    seo: {
      defaultTitle: 'SST Public School Rashidabad — Excel to Lead',
      titleSuffix: ' | SST Rashidabad',
      defaultDescription: 'Sargodhan Spirit Trust Public School Rashidabad is a residential institution offering academic learning, character development and leadership training.',
      keywords: 'SST, Rashidabad, residential school, Cambridge, Tando Allahyar, Sindh',
      ogImage: M('home-hero-campus'),
    },
    website: {
      defaultHeroImage: M('hero-campus'),
      sketchImage: M('sketch-campus'),
      virtualTour: { image: M('virtual-tour'), heading: 'Virtual Campus Tour', text: 'Explore our campus, facilities and residential life.', ctaLabel: 'Watch Tour', videoUrl: '' },
      comingSoonText: 'This section is coming soon.',
      showShareBar: true,
    },
  };
  for (const [key, value] of Object.entries(settings)) await prisma.setting.create({ data: { key, value } });
}

async function seedNavigation() {
  type Item = { label: string; href: string; icon?: string; isComingSoon?: boolean; children?: Item[] };
  const LG = '/about/leadership-governance';
  const aboutChildren: Item[] = [
    { label: 'About the School', href: '/about', icon: 'Landmark' },
    { label: 'History & Heritage', href: '/about/history-heritage', icon: 'BookOpen' },
    { label: 'Vision, Mission & Values', href: '/about/vision-mission-values', icon: 'Target' },
    {
      label: 'Leadership & Governance',
      href: LG,
      icon: 'Users',
      children: [
        { label: "Chairman's Message", href: `${LG}/chairmans-message` },
        { label: "Principal's Message", href: `${LG}/principals-message` },
        { label: 'Board of Trustees', href: `${LG}/board-of-trustees` },
        { label: 'Executive Committee', href: `${LG}/executive-committee` },
        { label: 'School Administration', href: `${LG}/school-administration` },
        { label: 'Governance Framework', href: `${LG}/governance-framework` },
      ],
    },
    { label: 'Why Choose SST', href: '/about/why-choose-sst', icon: 'Award' },
    { label: 'Our Impact', href: '/about/our-impact', icon: 'HandHeart' },
    { label: 'Campus & Location', href: '/about/campus-location', icon: 'MapPin' },
  ];
  const menus: Record<string, Item[]> = {
    MAIN: [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about', children: aboutChildren.map(({ children, ...i }) => i) },
      { label: 'Academics', href: '/academics' },
      { label: 'Admissions', href: '/admissions' },
      { label: 'Campus Life', href: '/campus-life' },
      { label: 'Facilities', href: '/facilities' },
      { label: 'News & Events', href: '/news-events' },
      { label: 'Contact', href: '/contact' },
    ],
    UTILITY: [
      { label: 'Alumni', href: '/alumni' },
      { label: 'Careers', href: '/careers' },
      { label: 'Downloads', href: '/downloads' },
      { label: 'Student Portal', href: '/student-portal', icon: 'UsersRound', isComingSoon: true },
    ],
    ABOUT_SIDEBAR: aboutChildren,
    FOOTER_QUICK: [
      { label: 'About SST', href: '/about' },
      { label: 'Academics', href: '/academics' },
      { label: 'Admissions', href: '/admissions' },
      { label: 'Campus Life', href: '/campus-life' },
    ],
    FOOTER_USEFUL: [
      { label: 'Student Portal', href: '/student-portal', isComingSoon: true },
      { label: 'Alumni Network', href: '/alumni' },
      { label: 'Careers', href: '/careers' },
      { label: 'Downloads', href: '/downloads' },
    ],
    FOOTER_LEGAL: [
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Terms of Use', href: '/terms-of-use' },
      { label: 'Sitemap', href: '/sitemap' },
    ],
  };
  for (const [menu, items] of Object.entries(menus)) {
    let order = 0;
    for (const it of items) {
      const parent = await prisma.navigationItem.create({
        data: { menu: menu as any, label: it.label, href: it.href, icon: it.icon, isComingSoon: !!it.isComingSoon, sortOrder: ++order },
      });
      let childOrder = 0;
      for (const c of it.children ?? []) {
        await prisma.navigationItem.create({
          data: { menu: menu as any, label: c.label, href: c.href, icon: c.icon, isComingSoon: !!c.isComingSoon, sortOrder: ++childOrder, parentId: parent.id },
        });
      }
    }
  }
}

// ───────────────────────── Leadership ─────────────────────────
async function seedLeadership() {
  const committees = {
    board: await prisma.committee.create({ data: { slug: 'board-of-trustees', name: 'Board of Trustees', profileLabel: 'Trustee Profile', sortOrder: 1 } }),
    exec: await prisma.committee.create({ data: { slug: 'executive-committee', name: 'Executive Committee', profileLabel: 'Committee Member Profile', sortOrder: 2 } }),
    admin: await prisma.committee.create({ data: { slug: 'school-administration', name: 'School Administration', profileLabel: 'Administration Profile', sortOrder: 3 } }),
  };

  const people: Record<string, any> = {
    ahmed: {
      fullName: 'Mr. Ahmed Raza',
      slug: 'ahmed-raza',
      photo: 'portrait-ahmed-raza',
      designation: 'Chairman, Board of Trustees',
      biography:
        '<p>Mr. Ahmed Raza is the Chairman of the Board of Trustees at Sargodhan Spirit Trust Public School (SST), Rashidabad. He brings extensive experience in institutional leadership, education governance and strategic planning.</p><p>He is deeply committed to SST’s mission of providing quality education, character development and leadership training to talented young people from across Pakistan, irrespective of their background.</p>',
      shortBio: 'Chairman of the Board of Trustees.',
      tenure: '2024 – 2027',
      profession: 'Education & Institutional Leadership',
      education: 'M.Sc. (Management), LUMS',
      focusAreas: [
        { icon: 'Target', label: 'Strategic Leadership' },
        { icon: 'BookOpen', label: 'Academic Excellence' },
        { icon: 'ShieldCheck', label: 'Governance & Compliance' },
        { icon: 'Coins', label: 'Resource Development' },
        { icon: 'UsersRound', label: 'Student Welfare' },
      ],
    },
    tariq: { fullName: 'Brig. (R) Tariq Mahmood', slug: 'tariq-mahmood', photo: 'portrait-tariq-mahmood', designation: 'Trustee' },
    kamran: { fullName: 'Mr. Kamran Siddiqui', slug: 'kamran-siddiqui', photo: 'portrait-kamran-siddiqui', designation: 'Principal' },
    imran: { fullName: 'Mr. Imran Ahmad', slug: 'imran-ahmad', photo: 'portrait-imran-ahmad', designation: 'Trustee' },
    faisal: { fullName: 'Mr. Faisal Khan', slug: 'faisal-khan', photo: 'portrait-faisal-khan', designation: 'Trustee' },
    salman: { fullName: 'Mr. Salman Ali', slug: 'salman-ali', photo: 'portrait-salman-ali', designation: 'Vice Principal (Academics)' },
    asad: { fullName: 'Mr. Asad Mahmood', slug: 'asad-mahmood', photo: 'portrait-asad-mahmood', designation: 'Vice Principal (Administration)' },
    nadeem: { fullName: 'Mr. Nadeem Hassan', slug: 'nadeem-hassan', photo: 'portrait-nadeem-hassan', designation: 'Controller of Examinations' },
    zahid: { fullName: 'Mr. Zahid Iqbal', slug: 'zahid-iqbal', photo: 'portrait-zahid-iqbal', designation: 'Head of Residential Life' },
    omer: { fullName: 'Mr. Omer Farooq', slug: 'omer-farooq', photo: 'portrait-omer-farooq', designation: 'Manager Administration' },
    sara: { fullName: 'Ms. Sara Ahmed', slug: 'sara-ahmed', photo: 'portrait-sara-ahmed', designation: 'Registrar' },
    ayesha: { fullName: 'Ms. Ayesha Khan', slug: 'ayesha-khan', photo: 'portrait-ayesha-khan', designation: 'Head of Student Welfare' },
  };
  const ids: Record<string, string> = {};
  for (const [k, p] of Object.entries(people)) {
    const { photo, ...rest } = p;
    const row = await prisma.person.create({ data: { ...rest, photoId: M(photo) } });
    ids[k] = row.id;
  }

  const assign = async (committeeId: string, list: [string, string, boolean?][]) => {
    let i = 0;
    for (const [k, roleTitle, isHead] of list) {
      await prisma.committeeMember.create({ data: { committeeId, personId: ids[k]!, roleTitle, isHead: !!isHead, sortOrder: ++i } });
    }
  };
  await assign(committees.board.id, [
    ['ahmed', 'Chairman, Board of Trustees', true],
    ['tariq', 'Trustee'],
    ['kamran', 'Trustee'],
    ['imran', 'Trustee'],
    ['faisal', 'Trustee'],
    ['salman', 'Trustee'],
    ['asad', 'Trustee'],
    ['nadeem', 'Trustee'],
    ['zahid', 'Trustee'],
    ['omer', 'Trustee'],
  ]);
  await assign(committees.exec.id, [
    ['ahmed', 'Chairman, Executive Committee', true],
    ['tariq', 'Member'],
    ['kamran', 'Member'],
    ['imran', 'Member'],
    ['faisal', 'Member'],
    ['salman', 'Member'],
    ['asad', 'Member'],
    ['nadeem', 'Member'],
    ['zahid', 'Member'],
  ]);
  await assign(committees.admin.id, [
    ['kamran', 'Principal', true],
    ['salman', 'Vice Principal (Academics)'],
    ['asad', 'Vice Principal (Administration)'],
    ['sara', 'Registrar'],
    ['zahid', 'Head of Residential Life'],
    ['nadeem', 'Controller of Examinations'],
    ['ayesha', 'Head of Student Welfare'],
    ['omer', 'Manager Administration'],
    ['faisal', 'HR & Compliance Manager'],
  ]);
  for (const id of Object.values(ids)) await publishRow(peopleConfig, id);

  const chairman = await prisma.leadershipMessage.create({
    data: {
      key: 'chairman',
      personId: ids.ahmed,
      eyebrow: 'MESSAGE FROM THE CHAIRMAN',
      heading: 'Chairman’s Message',
      salutation: 'Dear Students, Parents and Well-wishers,',
      excerpt: 'A continued commitment to providing quality education, developing character and creating opportunities for Pakistan’s future leaders.',
      body: [
        'It gives me great pleasure to welcome you to Sargodhan Spirit Trust Public School (SST), Rashidabad. SST is a living expression of the Sargodha Old Boys’ Association (SOBA)’s enduring commitment to provide quality education, character development and leadership training to talented young people from across Pakistan.',
        'Since its inception in 2005, our aim has been to create a nurturing residential environment where academic excellence goes hand in hand with strong moral values, self-discipline and a sense of responsibility towards society and the nation.',
        'We believe in unlocking the immense potential of our students and preparing them to meet the challenges of a rapidly changing world with confidence, integrity and compassion. I am proud of how SST continues to grow, evolve and remain true to its motto — Excel to Lead.',
        'I invite you to explore our institution, learn about our work and become a part of this meaningful journey.',
      ]
        .map((p) => `<p>${p}</p>`)
        .join(''),
      quote: 'Our commitment is to develop responsible, principled and capable leaders who can contribute positively to Pakistan and beyond.',
      signatureImageId: M('signature-chairman'),
      signatoryTitle: 'Chairman, Board of Trustees',
    },
  });
  const principal = await prisma.leadershipMessage.create({
    data: {
      key: 'principal',
      personId: ids.kamran,
      eyebrow: 'MESSAGE FROM THE PRINCIPAL',
      heading: 'Principal’s Message',
      excerpt: 'At SST, we nurture curious minds, responsible citizens and principled leaders in a disciplined and supportive residential environment.',
      body: '<p>At SST, we nurture curious minds, responsible citizens and principled leaders in a disciplined, supportive and residential environment.</p>',
      quote: 'At SST, we nurture curious minds, responsible citizens and principled leaders in a disciplined, supportive and residential environment.',
      signatoryTitle: 'Principal',
    },
  });
  await publishRow(messagesConfig, chairman.id);
  await publishRow(messagesConfig, principal.id);
}

// ───────────────────────── Documents, statistics, stories, news, galleries ─────────────────────────
async function seedLibrary() {
  const docs: Record<string, string> = {};
  const titles: [string, string][] = [
    ['governance-policy', 'Governance Policy'],
    ['code-of-conduct', 'Code of Conduct'],
    ['academic-policy-framework', 'Academic Policy Framework'],
    ['residential-life-policy', 'Residential Life Policy'],
  ];
  let order = 0;
  for (const [slug, title] of titles) {
    const id = crypto.randomUUID();
    const stored = await storeFile(id, placeholderPdf(title));
    await prisma.media.create({ data: { id, originalName: `${slug}.pdf`, ...stored, title, category: 'documents', caption: 'PLACEHOLDER document' } });
    const d = await prisma.document.create({
      data: { slug, title, description: 'PLACEHOLDER — official document to be uploaded.', category: 'GOVERNANCE_POLICY', fileId: id, isPublished: true, sortOrder: ++order },
    });
    docs[slug] = d.id;
  }

  const stats: [string, string, string, string][] = [
    ['graduates', '3,500+', 'Graduates', 'GraduationCap'],
    ['students_enrolled', '1,200+', 'Students Enrolled', 'UsersRound'],
    ['scholarships', '350+', 'Scholarships Awarded', 'BookOpenCheck'],
    ['achievements', '150+', 'National & Provincial Achievements', 'Trophy'],
    ['community_initiatives', '50+', 'Community Initiatives', 'HandHeart'],
    ['alumni_network', 'A Growing Alumni Network', 'Across Pakistan & Abroad', 'Users'],
  ];
  let s = 0;
  for (const [key, value, label, icon] of stats) await prisma.statistic.create({ data: { key, group: 'impact', value, label, icon, sortOrder: ++s } });
  await prisma.statistic.createMany({
    data: [
      { key: 'established', group: 'about', value: '2005', label: 'Established', icon: 'Calendar', sortOrder: 1 },
      { key: 'campus_acres', group: 'about', value: '61', label: 'Acres Campus', icon: 'Landmark', sortOrder: 2 },
      { key: 'years_of_excellence', group: 'about', value: '20+', label: 'Years of Excellence', icon: 'GraduationCap', sortOrder: 3 },
    ],
  });

  const story = await prisma.story.create({
    data: {
      kind: 'ALUMNI_STORY',
      name: 'Ali Rehman',
      subtitle: 'SST Alumnus (Class of 2018)',
      detail: 'Now: Civil Servant (PCS)',
      quote: 'SST not only gave me quality education but also the discipline, confidence and leadership skills to pursue my goals.',
      photoId: M('impact-alumnus'),
      isFeatured: true,
      sortOrder: 1,
    },
  });
  await publishRow(storiesConfig, story.id);

  const news: [string, string, string, string][] = [
    ['Guest Lecture on Leadership and Nation Building', '2026-11-05', 'news-guest-lecture', 'Lectures'],
    ['SST Students Win Inter-School Football Championship', '2026-10-28', 'news-football', 'Sports'],
    ['SST Students Win at Inter-School Science Fair', '2026-11-10', 'news-science-fair', 'Achievements'],
  ];
  for (const [title, date, img, category] of news) {
    const p = await prisma.post.create({
      data: {
        kind: 'NEWS',
        title,
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
        category,
        publicationDate: new Date(`${date}T09:00:00+05:00`),
        featuredImageId: M(img),
        isFeatured: true,
        excerpt: null,
        body: '',
      },
    });
    await publishRow(postsConfig, p.id);
  }

  const gallery = await prisma.gallery.create({
    data: { slug: 'campus-life', title: 'Campus Life', category: 'CAMPUS', coverImageId: M('home-hero-campus'), isPublished: true, description: 'PLACEHOLDER images from the design mock-ups.' },
  });
  const galleryImgs = ['home-hero-campus', 'campus-sports', 'campus-discipline', 'campus-library', 'campus-arts', 'campus-community', 'years-campus'];
  await prisma.galleryImage.createMany({ data: galleryImgs.map((n, i) => ({ galleryId: gallery.id, mediaId: M(n), sortOrder: i })) });
  return docs;
}

// ───────────────────────── Pages ─────────────────────────
async function seedPages(docs: Record<string, string>) {
  const LG = '/about/leadership-governance';
  const hero = (eyebrow: string) => ({ eyebrow });
  const sidebar = (showVirtualTour: boolean) => ({ showVirtualTour });
  const pages: { slug: string; template: string; section: string; title: string; subtitle?: string; heroImage?: string; content: any }[] = [
    {
      slug: 'home',
      template: 'home',
      section: 'home',
      title: 'Home',
      content: {
        slides: ['home-hero-campus', 'hero-campus', 'years-campus'].map((img) => ({
          eyebrow: 'SST PUBLIC SCHOOL RASHIDABAD',
          headline: 'Nurturing Character, Leadership & Excellence',
          text: 'A premier residential school committed to academic excellence, character building and the holistic development of young minds.',
          image: M(img),
          primaryLabel: 'Admissions Open',
          primaryHref: '/admissions',
          secondaryLabel: 'Explore Academics',
          secondaryHref: '/academics',
        })),
        highlights: [
          { icon: 'GraduationCap', title: 'Holistic Education', text: 'Academic, moral and life skills' },
          { icon: 'BedDouble', title: 'Residential Campus', text: 'A disciplined and enriching learning environment' },
          { icon: 'Trophy', title: 'Academic Excellence', text: 'A strong and balanced curriculum' },
          { icon: 'Users', title: 'Values & Leadership', text: 'Preparing responsible future leaders' },
        ],
        about: {
          eyebrow: 'ABOUT SST',
          heading: 'A Legacy of Excellence at Rashidabad',
          text: 'Sargodhan Spirit Trust Public School Rashidabad is a distinguished residential institution offering a conducive environment for academic learning, character development and leadership training.',
          image: M('home-students-library'),
          ctaLabel: 'Learn More About SST',
          ctaHref: '/about',
        },
        academics: {
          eyebrow: 'ACADEMICS',
          heading: 'A Comprehensive Academic Pathway',
          text: 'A structured and progressive curriculum from foundational years to internationally recognized Cambridge qualifications.',
          programmes: [
            { icon: 'BookOpen', title: 'Foundation Programme', grades: 'Grades I – V', text: 'A strong academic and moral foundation with a focus on core learning and character.', href: '/academics' },
            { icon: 'Layers', title: 'Pre-Cambridge', grades: 'Grades VI – VIII', text: 'Building conceptual clarity, analytical thinking and academic confidence.', href: '/academics' },
            { icon: 'Award', title: 'Cambridge (IGCSE)', grades: 'Grades IX – XI', text: 'A globally recognized curriculum preparing students for higher education and beyond.', href: '/academics' },
          ],
        },
        admissions: {
          heading: 'Admissions & Scholarships',
          text: 'Join a tradition of excellence at SST Rashidabad.',
          features: [
            { icon: 'CalendarDays', label: 'Entry Test & Assessment' },
            { icon: 'GraduationCap', label: 'Need-based Scholarships' },
            { icon: 'BedDouble', label: 'Residential Facilities' },
          ],
          ctaLabel: 'Apply Now',
          ctaHref: '/admissions',
        },
        campusLife: {
          eyebrow: 'CAMPUS LIFE',
          heading: 'A Vibrant & Enriching Residential Experience',
          text: 'Beyond academics, SST offers a well-rounded campus life that builds character, confidence and lifelong friendships.',
          tiles: [
            { icon: 'Volleyball', label: 'Sports & Athletics', image: M('campus-sports'), href: '/campus-life' },
            { icon: 'ShieldCheck', label: 'Discipline & Leadership', image: M('campus-discipline'), href: '/campus-life' },
            { icon: 'Library', label: 'Library & Research', image: M('campus-library'), href: '/campus-life' },
            { icon: 'Music', label: 'Arts & Culture', image: M('campus-arts'), href: '/campus-life' },
            { icon: 'HandHeart', label: 'Community Service', image: M('campus-community'), href: '/campus-life' },
          ],
        },
        news: { heading: 'News & Events', text: 'Stay updated with the latest happenings, achievements and announcements at SST.', ctaLabel: 'View All News', ctaHref: '/news-events', count: 3 },
      },
    },
    {
      slug: 'about',
      template: 'about-school',
      section: 'about',
      title: 'A Legacy of Excellence at Rashidabad',
      subtitle: 'Built on a tradition of quality education, character development and leadership for a brighter Pakistan.',
      content: {
        hero: hero('ABOUT SST'),
        intro: {
          eyebrow: 'ABOUT THE SCHOOL',
          heading: 'Sargodhan Spirit Trust Public School',
          text: 'Sargodhan Spirit Trust Public School (SST), Rashidabad is a distinguished residential institution committed to providing quality education, character development and leadership training in a nurturing and disciplined environment.',
        },
        features: [
          { icon: 'GraduationCap', label: 'Residential Boys’ School' },
          { icon: 'Layers', label: 'Cambridge Curriculum' },
          { icon: 'ShieldCheck', label: 'Character Development' },
          { icon: 'Users', label: 'Leadership Training' },
        ],
        philosophy: {
          heading: 'Our Educational Philosophy',
          text: 'At SST, we believe that true education goes beyond academic success. Our holistic approach nurtures intellectual curiosity, moral integrity, self-discipline and a strong sense of responsibility towards society and the nation.',
          image: M('students-studying'),
          points: ['Academic excellence with a balanced curriculum', 'Character building and ethical values', 'Leadership and decision-making skills', 'A disciplined and supportive residential environment'],
        },
        facts: [
          { icon: 'Users', line1: 'Established', line2: '2005', emphasis: 'line2' },
          { icon: 'GraduationCap', line1: '61', line2: 'Acres Campus', emphasis: 'line1' },
          { icon: 'BedDouble', line1: 'Residential', line2: 'Boys’ School', emphasis: null },
          { icon: 'Award', line1: 'A Tradition of', line2: 'Excellence', emphasis: 'line2' },
        ],
        explore: {
          heading: 'Explore More About SST',
          cards: [
            { image: M('explore-history'), icon: 'Landmark', title: 'History & Heritage', href: '/about/history-heritage' },
            { image: M('explore-vision'), icon: 'Target', title: 'Vision, Mission & Values', href: '/about/vision-mission-values' },
            { image: M('explore-leadership'), icon: 'Users', title: 'Leadership & Governance', href: LG },
            { image: M('explore-why'), icon: 'Trophy', title: 'Why Choose SST', href: '/about/why-choose-sst' },
            { image: M('explore-impact'), icon: 'Users', title: 'Our Impact', href: '/about/our-impact' },
            { image: M('explore-campus'), icon: 'Landmark', title: 'Campus & Location', href: '/about/campus-location' },
          ],
        },
        sidebar: sidebar(true),
      },
    },
    {
      slug: 'about/history-heritage',
      template: 'history',
      section: 'about',
      title: 'History & Heritage',
      subtitle: 'The story of a vision to create a residential institution of character, learning and leadership.',
      content: {
        hero: hero('ABOUT SST'),
        intro: {
          eyebrow: 'OUR JOURNEY',
          heading: 'History & Heritage',
          text: 'Sargodhan Spirit Trust Public School (SST), Rashidabad, was established on 14 September 2005 by the Sargodha Old Boys’ Association (SOBA), built on a shared vision to provide quality education, nurture character and develop future leaders for Pakistan.',
        },
        legacy: {
          heading: 'The Legacy',
          text: 'SST reflects the enduring spirit of the Sargodha Old Boys’ Association (SOBA) – a commitment to giving talented young people, regardless of their background, access to an excellent residential education. The Rashidabad campus was conceived as a purpose-built institution where academic learning, character development and leadership training go hand in hand.',
          image: M('history-legacy'),
        },
        milestones: {
          heading: 'Key Milestones',
          items: [
            { icon: 'Calendar', year: '2005', text: 'SST formally established and classes commenced on 14 September.' },
            { icon: 'GraduationCap', year: '2006', text: 'Residential programme expanded and houses established.' },
            { icon: 'Landmark', year: '2008', text: 'Academic and co-curricular facilities strengthened.' },
            { icon: 'FlaskConical', year: '2012', text: 'Science laboratories and library modernized.' },
            { icon: 'Volleyball', year: '2018', text: 'Sports and recreation facilities enhanced.' },
            { icon: 'Users', year: '2020', text: 'Academic programmes further diversified and strengthened.' },
            { icon: 'Flag', year: '2025', text: 'Two decades of excellence in education, character and leadership.' },
          ],
        },
        founders: {
          heading: 'Our Founders & Heritage',
          text: 'SST is an initiative of the Sargodha Old Boys’ Association (SOBA), whose members envisioned a residential institution that would carry forward their shared values of learning, discipline, service and leadership.',
          ctaLabel: 'Learn About Our Founders',
          ctaHref: LG,
        },
        gallery: {
          heading: 'Through the Years',
          images: [
            { image: M('years-gate'), caption: '' },
            { image: M('years-parade'), caption: '' },
            { image: M('years-campus'), caption: '' },
          ],
        },
        sidebar: sidebar(true),
      },
    },
    {
      slug: 'about/vision-mission-values',
      template: 'vision-mission',
      section: 'about',
      title: 'Vision, Mission & Values',
      subtitle: 'The guiding principles that shape our purpose, inspire our actions and define the SST experience.',
      content: {
        hero: hero('ABOUT SST'),
        intro: {
          eyebrow: 'OUR GUIDING PURPOSE',
          heading: 'Vision, Mission & Values',
          text: 'At SST, our vision, mission and values define who we are, what we aspire to achieve and how we nurture young minds to become responsible, principled and effective leaders.',
        },
        vision: { icon: 'Binoculars', title: 'Our Vision', tagline: 'Aim High.', text: 'To develop future leaders and make quality education accessible to talented young people, regardless of their background.' },
        mission: { icon: 'Target', title: 'Our Mission', text: 'To educate responsible citizens, develop leadership, and promote justice, understanding and cooperation in society and the nation.' },
        values: {
          heading: 'Our Core Values',
          text: 'The values we uphold at SST shape the character, conduct and contribution of every student.',
          items: [
            { icon: 'ShieldCheck', title: 'Integrity', text: 'Honesty, trust and strong moral character.' },
            { icon: 'GraduationCap', title: 'Discipline', text: 'Self-control, responsibility and respect for rules.' },
            { icon: 'Trophy', title: 'Excellence', text: 'A consistent pursuit of high academic and personal standards.' },
            { icon: 'Users', title: 'Leadership', text: 'Initiative, confidence and the ability to inspire others.' },
            { icon: 'Heart', title: 'Compassion', text: 'Empathy, care and respect for all.' },
            { icon: 'Flag', title: 'National Responsibility', text: 'A deep sense of duty towards Pakistan and its people.' },
            { icon: 'Handshake', title: 'Service to Society', text: 'A commitment to contribute positively to our community and beyond.' },
          ],
          image: M('values-student-flag'),
        },
        motto: { eyebrow: 'OUR MOTTO', text: 'EXCEL TO LEAD' },
        sidebar: sidebar(true),
      },
    },
    {
      slug: 'about/leadership-governance',
      template: 'leadership-overview',
      section: 'about',
      title: 'Leadership & Governance',
      subtitle: 'A committed leadership, a strong governance framework, and a shared vision for excellence.',
      content: {
        hero: hero('ABOUT SST'),
        intro: {
          eyebrow: 'INSTITUTIONAL LEADERSHIP',
          heading: 'Leadership & Governance',
          text: 'SST is guided by a distinguished Board of Trustees and a dedicated leadership team, ensuring strategic direction, academic excellence and the continued fulfillment of the school’s mission.',
        },
        messages: { ctaLabel: 'Read Message' },
        quickLinks: [
          { icon: 'Users', label: 'Board of Trustees', href: `${LG}/board-of-trustees` },
          { icon: 'Layers', label: 'Executive Committee', href: `${LG}/executive-committee` },
          { icon: 'Network', label: 'School Administration', href: `${LG}/school-administration` },
          { icon: 'ShieldCheck', label: 'Governance Framework', href: `${LG}/governance-framework` },
        ],
        trustees: { heading: 'Board of Trustees', ctaLabel: 'View All', count: 5 },
        executive: {
          heading: 'Executive Committee',
          ctaLabel: 'View All',
          text: 'The Executive Committee provides strategic oversight and supports the school management in policy, planning and effective implementation.',
          image: M('executive-meeting'),
        },
        administration: {
          heading: 'School Administration',
          items: [
            { icon: 'GraduationCap', label: 'Principal', href: `${LG}/school-administration` },
            { icon: 'Users', label: 'Vice Principal (Academics)', href: `${LG}/school-administration` },
            { icon: 'Users', label: 'Vice Principal (Administration)', href: `${LG}/school-administration` },
            { icon: 'Settings', label: 'Registrar', href: `${LG}/school-administration` },
            { icon: 'Layers', label: 'Head of Residential Life', href: `${LG}/school-administration` },
          ],
        },
        governance: {
          heading: 'Our Governance Framework',
          href: `${LG}/governance-framework`,
          points: ['Strategic Oversight & Policy Direction', 'Academic Quality & Student Development', 'Transparency & Accountability'],
        },
        sidebar: sidebar(true),
      },
    },
    {
      slug: 'about/leadership-governance/chairmans-message',
      template: 'leadership-message',
      section: 'about',
      title: 'Chairman’s Message',
      subtitle: 'A message from the Chairman, Board of Trustees',
      content: { hero: hero('ABOUT SST'), sidebar: sidebar(false) },
    },
    {
      slug: 'about/leadership-governance/principals-message',
      template: 'leadership-message',
      section: 'about',
      title: 'Principal’s Message',
      subtitle: 'A message from the Principal',
      content: { hero: hero('ABOUT SST'), sidebar: sidebar(false) },
    },
    {
      slug: 'about/leadership-governance/board-of-trustees',
      template: 'committee-directory',
      section: 'about',
      title: 'Board of Trustees',
      subtitle: 'The governing body that provides strategic direction, oversight and stewardship for SST.',
      content: {
        hero: hero('LEADERSHIP & GOVERNANCE'),
        intro: {
          eyebrow: 'LEADERSHIP & GOVERNANCE',
          heading: 'Board of Trustees',
          text: 'The Board of Trustees provides overall policy guidance, strategic direction and institutional oversight, ensuring that SST remains true to its mission of quality education, character development and leadership training.',
        },
        sidebar: sidebar(false),
      },
    },
    {
      slug: 'about/leadership-governance/executive-committee',
      template: 'executive-committee',
      section: 'about',
      title: 'Executive Committee',
      subtitle: 'The management body responsible for the effective governance and strategic implementation of SST’s policies.',
      content: {
        hero: hero('LEADERSHIP & GOVERNANCE'),
        intro: {
          eyebrow: 'LEADERSHIP & GOVERNANCE',
          heading: 'Executive Committee',
          text: 'The Executive Committee (EC) is responsible for the day-to-day management, policy implementation and operational oversight of SST, ensuring excellence in academics, residential life and institutional development in line with the vision of the Board of Trustees.',
        },
        membersHeading: 'Committee Members',
        mandate: {
          icon: 'Users',
          heading: 'Committee Mandate',
          text: 'To provide strategic oversight and administrative leadership for the effective management of the School and to implement the policies and decisions of the Board of Trustees.',
        },
        responsibilities: {
          icon: 'Settings',
          heading: 'Key Responsibilities',
          items: [
            'Implementation of Board policies',
            'Academic and residential operations',
            'Financial and resource management',
            'Infrastructure and facilities development',
            'Student welfare and discipline',
            'Monitoring performance and institutional goals',
          ],
        },
        sidebar: sidebar(false),
      },
    },
    {
      slug: 'about/leadership-governance/school-administration',
      template: 'school-administration',
      section: 'about',
      title: 'School Administration',
      subtitle: 'The professional leadership team responsible for the academic, residential and administrative management of SST, Rashidabad.',
      content: {
        hero: hero('LEADERSHIP & GOVERNANCE'),
        intro: {
          eyebrow: 'LEADERSHIP & GOVERNANCE',
          heading: 'School Administration',
          text: 'The School Administration is responsible for the day-to-day academic, residential and administrative operations of SST, ensuring a safe, disciplined and enriching environment for the all-round development of students.',
        },
        principal: { heading: 'Principal’s Message', ctaLabel: 'Read Full Message' },
        focus: {
          icon: 'Target',
          heading: 'Key Focus Areas',
          items: ['Academic Excellence', 'Student Development', 'Residential Life & Welfare', 'Discipline & Character Building', 'Safe and Inclusive Campus'],
        },
        structure: {
          icon: 'Network',
          heading: 'Organization Structure',
          text: 'View the School Administration organizational chart and reporting structure.',
          ctaLabel: 'View Org Chart',
          ctaHref: `${LG}/governance-framework`,
        },
        teamHeading: 'Administrative Leadership Team',
        departments: {
          heading: 'Administrative Departments',
          items: [
            { icon: 'GraduationCap', label: 'Academics' },
            { icon: 'BedDouble', label: 'Residential Life' },
            { icon: 'UsersRound', label: 'Student Welfare' },
            { icon: 'Layers', label: 'Examinations' },
            { icon: 'Settings', label: 'Administration' },
            { icon: 'Users', label: 'Human Resources' },
            { icon: 'Coins', label: 'Finance' },
            { icon: 'Shield', label: 'Health & Safety' },
            { icon: 'Landmark', label: 'Facilities & Maintenance' },
          ],
        },
        sidebar: sidebar(false),
      },
    },
    {
      slug: 'about/leadership-governance/governance-framework',
      template: 'governance-framework',
      section: 'about',
      title: 'Governance Framework',
      subtitle: 'The structure, policies and processes that ensure effective, transparent and accountable governance at SST.',
      content: {
        hero: hero('LEADERSHIP & GOVERNANCE'),
        intro: {
          eyebrow: 'LEADERSHIP & GOVERNANCE',
          heading: 'Governance Framework',
          text: 'The Governance Framework defines the institutional structure, roles, responsibilities, policies and processes that guide the strategic direction, management and accountability of SST, Rashidabad.',
        },
        overview: {
          icon: 'Target',
          heading: 'Framework Overview',
          text: 'A structured system of governance that ensures effective leadership, clear accountability, policy compliance and the sustainable fulfilment of SST’s mission and objectives.',
        },
        model: {
          icon: 'Settings',
          heading: 'Governance Model',
          tiers: [
            { icon: 'Users', title: 'Strategic Governance', subtitle: '(Board of Trustees)', note: 'Policy, oversight and strategic direction' },
            { icon: 'Settings', title: 'Executive Governance', subtitle: '(Executive Committee)', note: 'Implementation, management and performance' },
            { icon: 'Landmark', title: 'Operational Governance', subtitle: '(School Administration)', note: 'Day-to-day academic, residential and administrative operations' },
          ],
        },
        principles: {
          icon: 'Scale',
          heading: 'Key Governance Principles',
          items: ['Accountability & Transparency', 'Academic Integrity & Excellence', 'Student-Centric Decision Making', 'Regulatory Compliance', 'Proper Stewardship of Resources', 'Continuous Improvement'],
        },
        structure: {
          icon: 'Network',
          heading: 'Organizational Structure',
          text: 'A clear and defined structure that enables effective decision-making and institutional management.',
          ctaLabel: 'View Organizational Chart',
          ctaHref: LG,
        },
        decision: {
          icon: 'Settings',
          heading: 'Decision-Making Framework',
          steps: [
            { icon: 'FileText', title: 'Proposal / Issue', subtitle: '' },
            { icon: 'Users', title: 'Review', subtitle: '(Relevant Forum)' },
            { icon: 'Settings', title: 'Deliberation', subtitle: '(EC / BoT)' },
            { icon: 'CircleCheck', title: 'Approval & Implementation', subtitle: '' },
          ],
        },
        policies: {
          icon: 'FileText',
          heading: 'Policies & Key Documents',
          text: 'Institutional policies and governance documents that guide operations, ethical conduct and compliance.',
          documents: Object.values(docs),
        },
        sidebar: sidebar(false),
      },
    },
    {
      slug: 'about/why-choose-sst',
      template: 'why-choose',
      section: 'about',
      title: 'Why Choose SST',
      subtitle: 'A premier residential school that nurtures character, builds leadership and prepares students for a meaningful future.',
      content: {
        hero: hero('ABOUT SST'),
        intro: {
          eyebrow: 'ABOUT SST',
          heading: 'Why Choose SST',
          text: 'SST offers a distinctive residential education that combines academic excellence, character building, leadership development and a disciplined, values-based environment — preparing young leaders to serve Pakistan and society.',
        },
        features: [
          { icon: 'GraduationCap', title: 'Academic Excellence', text: 'A rigorous, well-rounded curriculum with a focus on conceptual learning, critical thinking and achievement.' },
          { icon: 'ShieldCheck', title: 'Character & Discipline', text: 'A values-driven environment that builds integrity, resilience and a strong moral foundation.' },
          { icon: 'Users', title: 'Leadership Development', text: 'Structured opportunities in academics, co-curricular activities and residential life to nurture confident, responsible leaders.' },
          { icon: 'School', title: 'Residential Experience', text: 'A safe, structured and enriching boarding environment that promotes independence, teamwork and life skills.' },
          { icon: 'TreePine', title: 'Holistic Development', text: 'A balance of academics, sports, arts, community service and co-curricular activities.' },
          { icon: 'Crown', title: 'World-Class Facilities', text: 'Modern academic, residential, sports and recreation facilities that support all-round growth.' },
          { icon: 'UsersRound', title: 'Qualified & Caring Faculty', text: 'A dedicated team of experienced educators, mentors and house staff committed to student success.' },
          { icon: 'Target', title: 'Purpose & National Service', text: 'Developing responsible citizens with a strong sense of service to Pakistan and society.' },
        ],
        image: M('why-students'),
        strip: [
          { icon: 'GraduationCap', value: '20+ Years', label: 'of Excellence' },
          { icon: 'Users', value: '', label: 'Residential Schooling' },
          { icon: 'Trophy', value: '', label: 'Holistic Development' },
          { icon: 'Volleyball', value: '', label: 'Sports & Recreation' },
          { icon: 'Sprout', value: '', label: 'Values-Based Education' },
          { icon: 'UsersRound', value: '', label: 'National Impact' },
        ],
        banner: { quote: '“A School for Learning, Leadership and Service to Society.”', badge: 'EXCEL TO LEAD', image: M('banner-campus-art') },
        sidebar: sidebar(false),
      },
    },
    {
      slug: 'about/our-impact',
      template: 'our-impact',
      section: 'about',
      title: 'Our Impact',
      subtitle: 'Nurturing individuals, transforming lives and contributing positively to Pakistan and society.',
      content: {
        hero: hero('ABOUT SST'),
        intro: {
          eyebrow: 'ABOUT SST',
          heading: 'Our Impact',
          text: 'For decades, SST Rashidabad has been creating a lasting impact by developing responsible, confident and capable young leaders who contribute to their communities, Pakistan and beyond.',
        },
        keyAreas: {
          icon: 'Target',
          heading: 'Key Areas of Impact',
          items: ['Academic Achievement', 'Character & Leadership', 'Access & Opportunity (Scholarships)', 'Community Service', 'National Contribution', 'Alumni Success'],
        },
        stories: { icon: 'Star', heading: 'Student Success Stories', ctaLabel: 'View All Stories', ctaHref: '/alumni' },
        alumni: {
          icon: 'Users',
          heading: 'Alumni Impact',
          text: 'Our alumni are serving with distinction in diverse fields, contributing to national development and public service.',
          sectors: [
            { icon: 'Briefcase', label: 'Civil Service & Governance' },
            { icon: 'Stethoscope', label: 'Medicine & Healthcare' },
            { icon: 'Settings', label: 'Engineering & Technology' },
            { icon: 'BookOpen', label: 'Education & Research' },
            { icon: 'Shield', label: 'Armed Forces & National Service' },
            { icon: 'Handshake', label: 'Business & Social Entrepreneurship' },
          ],
          image: M('impact-alumni-monument'),
        },
        banner: { quote: 'A Lasting Impact on Individuals, Communities and the Nation', badge: 'EXCEL TO LEAD', image: M('banner-campus-art') },
        sidebar: sidebar(false),
      },
    },
    {
      slug: 'about/leadership-governance/profile',
      template: 'person-profile',
      section: 'about',
      title: 'Profile page labels',
      content: {
        backPrefix: 'Back to',
        downloadLabel: 'Download Profile (PDF)',
        printLabel: 'Print',
        tabs: { profile: 'Profile', responsibilities: 'Role & Responsibilities', affiliations: 'Affiliations', messages: 'Messages', gallery: 'Gallery' },
        aboutHeading: 'About',
        keyInfoHeading: 'Key Information',
        focusHeading: 'Focus Areas at SST',
        sidebar: sidebar(false),
      },
    },
  ];

  // Sections that do not have an approved design yet use the "standard" template.
  const standard: [string, string, string, string][] = [
    ['about/campus-location', 'about', 'Campus & Location', 'ABOUT SST'],
    ['academics', 'academics', 'Academics', 'ACADEMICS'],
    ['admissions', 'admissions', 'Admissions', 'ADMISSIONS'],
    ['campus-life', 'campus-life', 'Campus Life', 'CAMPUS LIFE'],
    ['facilities', 'facilities', 'Facilities', 'FACILITIES'],
    ['news-events', 'news-events', 'News & Events', 'NEWS & EVENTS'],
    ['contact', 'contact', 'Contact Us', 'CONTACT'],
    ['alumni', 'alumni', 'Alumni', 'ALUMNI'],
    ['careers', 'careers', 'Careers', 'CAREERS'],
    ['downloads', 'downloads', 'Downloads', 'DOWNLOADS'],
    ['privacy-policy', 'legal', 'Privacy Policy', 'LEGAL'],
    ['terms-of-use', 'legal', 'Terms of Use', 'LEGAL'],
  ];
  for (const [slug, section, title, eyebrow] of standard) {
    pages.push({
      slug,
      template: 'standard',
      section,
      title,
      content: { hero: hero(eyebrow), intro: { eyebrow, heading: title, text: '' }, body: '' },
    });
  }

  let order = 0;
  for (const p of pages) {
    const row = await prisma.page.create({
      data: { slug: p.slug, template: p.template, section: p.section, title: p.title, subtitle: p.subtitle, content: p.content, sortOrder: ++order },
    });
    await publishRow(pagesConfig, row.id);
  }
}

async function main() {
  await seedAccess();
  if (RESET) {
    console.log('Resetting website content…');
    const tables = ['website_media_usage', 'website_gallery_images', 'website_galleries', 'website_documents', 'website_committee_members', 'website_committees', 'website_messages', 'website_people', 'website_news', 'website_events', 'website_testimonials', 'website_statistics', 'website_navigation', 'website_settings', 'website_pages', 'website_revisions', 'website_publication_logs', 'website_media', 'website_categories', 'website_faculty', 'website_exam_results', 'website_vacancies', 'website_faqs'];
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE`);
  }
  if (RESET || (await prisma.page.count()) === 0) {
    await seedMedia();
    await seedSettings();
    await seedNavigation();
    await seedLeadership();
    const docs = await seedLibrary();
    await seedPages(docs);
    console.log('Base content seeded.');
  }
  if (!process.env.SEED_SKIP_UPGRADES) await runUpgrades();
  console.log('Seed complete.');
}

/** Versioned, additive content upgrades for existing databases. */
async function runUpgrades() {
  const row = await prisma.setting.findUnique({ where: { key: '_seedVersion' } });
  const version = Number((row?.value as any)?.version ?? 1);
  if (version < 2) {
    console.log('Applying content seed v2 (academics, admissions, campus life, facilities, news & events, careers, alumni, downloads, contact)…');
    await seedV2(prisma, imagesDir(), placeholderPdf);
    await seedNavigationV2(prisma);
    await prisma.setting.upsert({ where: { key: '_seedVersion' }, update: { value: { version: 2 } }, create: { key: '_seedVersion', value: { version: 2 } } });
  }
}
const imagesDir = () => process.env.SEED_ASSETS_DIR ?? [join(here, 'seed-assets/images'), join(here, '../prisma/seed-assets/images')].find((d) => existsSync(d))!;

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Keep type import used (Prisma namespace is needed for JSON typing in some editors)
export type _ = Prisma.JsonValue;
