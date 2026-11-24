/**
 * Content seed v2 — Academics, Admissions, Campus Life, Facilities, News & Events, Careers,
 * Alumni, Downloads and Contact. Runs once (tracked by the "_seedVersion" setting) and is
 * additive: existing records are kept; pages still on the generic "standard" template are
 * converted to their designed templates.
 *
 * ALL names, figures, dates and text are transcribed from the approved designs, or written by
 * the development team for SST-designed pages, and are PLACEHOLDER content until verified.
 */
import type { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { storeFile } from '../src/modules/media/storage';
import { pagesConfig, postsConfig, eventsConfig, facultyConfig, resultsConfig, vacanciesConfig } from '../src/modules/content/entities';
import { writeRevision, type ContentConfig } from '../src/modules/content/content-factory';
import { syncMediaUsage } from '../src/lib/media-refs';
import { slugify } from '../src/lib/query';

type Item = Record<string, unknown>;
const t3 = (rows: (string | undefined)[][], keys: string[]) => rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));

export async function seedV2(prisma: PrismaClient, imagesDir: string, placeholderPdf: (t: string) => Buffer) {
  // ───────── media ─────────
  const media: Record<string, string> = Object.fromEntries((await prisma.media.findMany({ select: { id: true, originalName: true } })).map((m) => [m.originalName.replace(/\.jpg$/, ''), m.id]));
  for (const file of readdirSync(imagesDir).filter((f) => f.endsWith('.jpg'))) {
    const name = file.replace(/\.jpg$/, '');
    if (media[name]) continue;
    const id = crypto.randomUUID();
    const stored = await storeFile(id, readFileSync(join(imagesDir, file)));
    const category = /^(faculty|achiever|portrait)/.test(name) ? 'people' : /^(news|event|achv|album|video)/.test(name) ? 'news-events' : /^(art|crest)/.test(name) ? 'artwork' : 'campus';
    await prisma.media.create({ data: { id, originalName: file, ...stored, alt: name.replace(/-/g, ' '), caption: 'PLACEHOLDER — cropped from the design mock-up; replace with the official photograph', category } });
    media[name] = id;
  }
  const M = (n: string) => {
    if (!media[n]) throw new Error(`Missing seed image ${n}`);
    return media[n]!;
  };

  const publish = async (cfg: ContentConfig, id: string) => {
    const row = await cfg.delegate().findUnique({ where: { id }, include: cfg.include });
    const snapshot = await cfg.serialize(row);
    const updated = await cfg.delegate().update({ where: { id }, data: { status: 'PUBLISHED', publishedData: snapshot, publishedAt: new Date() } });
    await writeRevision(cfg, updated, 'PUBLISH', undefined, 'Seed content v2');
    await syncMediaUsage(cfg.type, id, updated, cfg.titleOf(updated));
  };

  // ───────── categories ─────────
  const CATS: Record<string, [string, string][]> = {
    news: [['Academics', 'BookOpen'], ['Campus Life', 'School'], ['Sports', 'Trophy'], ['Co-Curricular', 'Award'], ['Competitions', 'Medal'], ['Visits & Talks', 'Mic'], ['General', 'Megaphone'], ['Achievements', 'Star'], ['Lectures', 'Presentation']],
    events: [['Academics', 'BookOpen'], ['Sports', 'Footprints'], ['Co-Curricular', 'Award'], ['Cultural', 'Drama'], ['Competitions', 'Trophy'], ['Special', 'Star']],
    announcements: [['Academic', 'BookOpen'], ['Examinations', 'GraduationCap'], ['Admissions', 'UsersRound'], ['General', 'Bell'], ['Circulars', 'FileText']],
    achievements: [['Academic', 'GraduationCap'], ['Sports', 'Footprints'], ['Co-Curricular', 'UsersRound'], ['Competitions', 'Star'], ['Institutional', 'Award']],
    gallery: [['Academic', 'GraduationCap'], ['Sports', 'Footprints'], ['Co-Curricular', 'UsersRound'], ['Cultural', 'Music'], ['Events', 'CalendarDays'], ['Campus Life', 'Building2']],
    documents: [['Forms & Applications', 'FileText'], ['School Circulars', 'Megaphone'], ['Academic Resources', 'BookOpen'], ['Calendars & Schedules', 'CalendarDays'], ['Policies & Guidelines', 'ShieldCheck'], ['Prospectus & Brochures', 'BookMarked'], ['Reports & Publications', 'ChartColumn']],
    faq: [['Application Process', 'FileText'], ['Eligibility & Age Criteria', 'GraduationCap'], ['Required Documents', 'ClipboardList'], ['Fees & Payments', 'Coins'], ['Scholarships & Financial Support', 'Award'], ['General / Other', 'Settings']],
    departments: [['Academic Department', 'BookOpen'], ['Administration Department', 'Building2']],
    'job-types': [['Full-Time', 'Briefcase'], ['Part-Time', 'Clock'], ['Contract', 'FileText']],
  };
  const SLUG_OVERRIDE: Record<string, string> = { 'Application Process': 'application', 'Eligibility & Age Criteria': 'eligibility', 'Required Documents': 'documents', 'Fees & Payments': 'fees', 'Scholarships & Financial Support': 'scholarships', 'General / Other': 'other' };
  for (const [scope, list] of Object.entries(CATS)) {
    let i = 0;
    for (const [name, icon] of list) {
      const slug = scope === 'faq' ? SLUG_OVERRIDE[name]! : slugify(name);
      await prisma.category.upsert({ where: { scope_slug: { scope, slug } }, update: {}, create: { scope, name, slug, icon, sortOrder: ++i } });
    }
  }
  await prisma.document.updateMany({ where: { category: 'governance-policy' }, data: { category: 'policies-guidelines' } });
  await prisma.gallery.updateMany({ where: { category: 'campus' }, data: { category: 'campus-life' } });

  // ───────── documents ─────────
  const docIds: Record<string, string> = Object.fromEntries((await prisma.document.findMany({ select: { id: true, slug: true } })).map((d) => [d.slug, d.id]));
  let docOrder = 10;
  const D = async (title: string, category: string, date?: string) => {
    const slug = slugify(title);
    if (docIds[slug]) return docIds[slug]!;
    const id = crypto.randomUUID();
    const stored = await storeFile(id, placeholderPdf(title));
    await prisma.media.create({ data: { id, originalName: `${slug}.pdf`, ...stored, title, category: 'documents', caption: 'PLACEHOLDER document' } });
    const d = await prisma.document.create({ data: { slug, title, description: 'PLACEHOLDER — official document to be uploaded.', category, fileId: id, isPublished: true, sortOrder: ++docOrder, publishedDate: date ? new Date(date) : null } });
    docIds[slug] = d.id;
    return d.id;
  };
  const docs = {
    admissionForm: await D('Student Admission Form – 2027–28', 'forms-applications', '2026-11-12'),
    winterVacation: await D('Winter Vacation Schedule 2026', 'school-circulars', '2026-11-10'),
    calendar: await D('Academic Calendar 2026–27', 'calendars-schedules', '2026-11-05'),
    uniform: await D('School Uniform Guidelines', 'policies-guidelines', '2026-11-02'),
    consent: await D('Parent Consent Form – Educational Visits', 'forms-applications', '2026-10-30'),
    supportPolicy: await D('Academic Support Policy', 'policies-guidelines'),
    counselling: await D('Student Counselling Guidelines', 'policies-guidelines'),
    learningSupport: await D('Learning Support Framework', 'academic-resources'),
    parentGuidance: await D('Parent Guidance – Academic Support', 'academic-resources'),
    libraryPolicy: await D('Library Policy', 'policies-guidelines'),
    libraryRules: await D('Library Rules & Guidelines', 'policies-guidelines'),
    readingFramework: await D('Reading Programme Framework', 'academic-resources'),
    eResources: await D('E-Resources User Guide', 'academic-resources'),
    assessmentPolicy: await D('Assessment Policy', 'policies-guidelines'),
    reportingGuidelines: await D('Reporting Guidelines', 'academic-resources'),
    progressSample: await D('Student Progress Report (Sample)', 'academic-resources'),
    admissionsCalendar: await D('Admissions Calendar 2026–27', 'calendars-schedules'),
    docChecklist: await D('Document Checklist', 'forms-applications'),
    feeStructure: await D('Fee Structure 2026–27', 'forms-applications'),
    scholarshipPolicy: await D('Scholarship Policy', 'policies-guidelines'),
    admissionGuide: await D('Admission Guide', 'prospectus-brochures'),
    prospectus: await D('SST Prospectus 2026–27', 'prospectus-brochures'),
    curriculumGuide: await D('Curriculum Guide 2026–27', 'academic-resources'),
    middleSyllabus: await D('Middle School Syllabus Overview', 'academic-resources'),
    secondarySyllabus: await D('Secondary School Syllabus Overview', 'academic-resources'),
    higherSyllabus: await D('Higher Secondary Syllabus Overview', 'academic-resources'),
    annualReport: await D('Annual Report 2025', 'reports-publications'),
    resultsComplete: await D('Matric (SSC) 2025 – Complete Result', 'reports-publications'),
    resultsSummary: await D('Matric (SSC) 2025 – Result Summary', 'reports-publications'),
    subjectAnalysis: await D('Matric (SSC) 2025 – Subject Analysis', 'reports-publications'),
    topAchievers: await D('Matric (SSC) 2025 – Top Achievers', 'reports-publications'),
  };

  // ───────── block helpers ─────────
  const strip = (...items: [string, string, string?][]) => ({ items: items.map(([icon, title, subtitle]) => ({ icon, title, subtitle: subtitle ?? '' })) });
  const check = (icon: string, heading: string, text: string, items: string[]) => ({ icon, heading, text, items });
  const img = (n: string, caption = '') => ({ image: M(n), caption });
  const art = (n: string) => ({ image: M(n) });
  const imgCards = (icon: string, heading: string, items: [string, string, string?][]) => ({ icon, heading, items: items.map(([image, label, href]) => ({ image: M(image), label, href: href ?? '' })) });
  const grid = (icon: string, heading: string, items: [string, string, string?][]) => ({ icon, heading, items: items.map(([i, label, text]) => ({ icon: i, label, text: text ?? '' })) });
  const stats = (icon: string, heading: string, items: [string, string, string][]) => ({ icon, heading, items: items.map(([i, label, value]) => ({ icon: i, label, value })) });
  const table = (icon: string, heading: string, columns: string[], rows: string[][], note = '', text = '') => ({ icon, heading, text, columns, rows: rows.map((cells) => ({ cells })), note });
  const steps = (icon: string, heading: string, items: [string, string, string?, string?][]) => ({ icon, heading, items: items.map(([i, title, text, badge]) => ({ icon: i, title, text: text ?? '', badge: badge ?? '' })) });
  const kv = (icon: string, heading: string, items: [string, string, string][], ctaLabel = '', ctaHref = '') => ({ icon, heading, items: items.map(([i, label, value]) => ({ icon: i, label, value })), ctaLabel, ctaHref });
  const benefits = (icon: string, heading: string, items: [string, string, string?][], text = '') => ({ icon, heading, text, items: items.map(([i, title, t]) => ({ icon: i, title, text: t ?? '' })) });
  const note = (icon: string, heading: string, text: string, items: string[] = []) => ({ icon, heading, text, items });
  const cta = (icon: string, heading: string, text: string, primaryLabel: string, primaryHref: string, secondaryLabel = '', secondaryHref = '') => ({ icon, heading, text, primaryLabel, primaryHref, secondaryLabel, secondaryHref });
  const details = (icon: string, heading: string, items: [string, string, string][], text = '') => ({ icon, heading, text, items: items.map(([i, title, t]) => ({ icon: i, title, text: t })) });
  const downloads = (icon: string, heading: string, documents: string[], text = '') => ({ icon, heading, text, documents });
  const cards = (icon: string, heading: string, items: { image?: string; icon?: string; title: string; text?: string; badge?: string; href?: string }[]) => ({ icon, heading, items: items.map((c) => ({ image: c.image ? M(c.image) : null, icon: c.icon ?? null, title: c.title, text: c.text ?? '', badge: c.badge ?? '', href: c.href ?? '' })) });
  const banner = (quote: string, line1 = '', line2 = '', icon = '', ctaLabel = '', ctaHref = '') => ({ quote, line1, line2, icon: icon || null, ctaLabel, ctaHref });
  const scard = (icon: string, heading: string, text: string, ctaLabel: string, ctaHref: string) => ({ icon, heading, text, ctaLabel, ctaHref });
  const help = (text: string) => scard('Headset', 'Need Assistance?', text, 'Contact Admissions', '/contact');
  const admBanner = (quote: string, line1 = 'Admissions Open', ctaLabel = 'Apply for Admission') => banner(quote, line1, '2026 – 2027', 'BookOpen', ctaLabel, '/admissions/apply-online');

  const A = '/academics';
  const AD = '/admissions';
  const CL = '/campus-life';
  const NE = '/news-events';
  const F = '/facilities';

  interface P { slug: string; template: string; section: string; title: string; subtitle?: string; eyebrow: string; intro: [string, string, string]; hero?: string; c?: Item }
  const pages: P[] = [
    // ───────── Academics ─────────
    {
      slug: 'academics', template: 'academics-overview', section: 'academics', title: 'Academics', eyebrow: 'ACADEMICS',
      subtitle: 'A rigorous, balanced and values-based academic programme that prepares students to excel and lead.',
      intro: ['ACADEMICS', 'Academic Excellence at SST', 'SST offers a structured and progressive academic programme that combines conceptual learning, critical thinking and strong values to prepare students for higher education and leadership.'],
      c: {
        photo: img('students-studying'),
        strip: strip(['GraduationCap', 'Qualified Faculty'], ['BookOpen', 'Balanced Curriculum'], ['Lightbulb', 'Conceptual Learning'], ['ChartColumn', 'Continuous Assessment'], ['Trophy', 'Proven Results']),
        image: img('library-reading'),
        approach: check('Target', 'Our Academic Approach', 'Teaching and learning at SST are designed to build understanding, curiosity and independence.', ['Concept-based teaching in small classes', 'Regular assessment and individual feedback', 'Supervised evening study (prep) for boarders', 'Academic mentoring and remedial support', 'Preparation for board and Cambridge examinations']),
        programmes: cards('Layers', 'Academic Programmes', [
          { icon: 'BookOpen', title: 'Middle School', badge: 'Grades VI – VIII', text: 'Building strong foundations, conceptual clarity and good study habits.', href: `${A}/programmes/middle-school` },
          { icon: 'Layers', title: 'Secondary School', badge: 'Grades IX – X', text: 'Subject specialisation and preparation for board examinations.', href: `${A}/programmes/secondary-school` },
          { icon: 'Award', title: 'Higher Secondary', badge: 'Grades XI – XII', text: 'Advanced study and preparation for university and professional pathways.', href: `${A}/programmes/higher-secondary` },
        ]),
        highlights: benefits('Star', 'Academic Highlights', [['Trophy', '92% A & A+', 'Board results 2025'], ['Award', '18', 'Subject distinctions'], ['Medal', 'Top 5', 'District position'], ['Users', '86', 'Faculty members']]),
        sidebarCard: scard('GraduationCap', 'Explore Our Programmes', 'Find the right programme for your child.', 'View Programmes', `${A}/programmes`),
        banner: banner('“Learning Today, Leading Tomorrow”'),
      },
    },
    {
      slug: 'academics/programmes', template: 'academic-programmes', section: 'academics', title: 'Academic Programmes', eyebrow: 'ACADEMICS',
      subtitle: 'Progressive programmes from Middle School to Higher Secondary, designed for academic excellence and personal growth.',
      intro: ['ACADEMICS', 'Academic Programmes', 'Each programme builds on the previous stage, combining a strong curriculum with character development, co-curricular activities and residential life.'],
      c: {
        photo: img('faculty-team'),
        strip: strip(['BookOpen', 'Structured Curriculum'], ['Users', 'Small Classes'], ['UserCheck', 'Personal Mentoring'], ['ClipboardCheck', 'Regular Assessment'], ['Trophy', 'Board Preparation']),
        programmes: cards('Layers', 'Our Programmes', [
          { icon: 'BookOpen', title: 'Middle School', badge: 'Grades VI – VIII', text: 'Strong foundations in core subjects, conceptual understanding and study skills.', href: `${A}/programmes/middle-school` },
          { icon: 'Layers', title: 'Secondary School', badge: 'Grades IX – X', text: 'Subject specialisation, analytical skills and focused preparation for Matric (SSC).', href: `${A}/programmes/secondary-school` },
          { icon: 'Award', title: 'Higher Secondary', badge: 'Grades XI – XII', text: 'Advanced study in science and humanities streams, preparing students for university.', href: `${A}/programmes/higher-secondary` },
        ]),
        cta: cta('GraduationCap', 'Find the Right Programme', 'Review eligibility and grade levels, then start your application.', 'Apply Online', `${AD}/apply-online`, 'View Grade Levels', `${AD}/grade-levels`),
        sidebarCard: scard('BookOpen', 'Curriculum', 'Learn how the curriculum progresses across stages.', 'View Curriculum', `${A}/curriculum`),
        banner: banner('“A Clear Pathway from Foundations to Future Success”'),
      },
    },
    ...(
      [
        ['middle-school', 'Middle School Programme', 'Grades VI – VIII', '11 – 13 years', 'Building strong foundations, curiosity and good study habits.', docs.middleSyllabus, [['English', 'Language skills, reading and writing'], ['Urdu', 'Language and literature'], ['Mathematics', 'Number, algebra and geometry'], ['General Science', 'Physics, chemistry and biology foundations'], ['Social Studies', 'History, geography and civics'], ['Islamiyat', 'Islamic studies and values'], ['Computer Science', 'Digital literacy and coding basics']]],
        ['secondary-school', 'Secondary School Programme', 'Grades IX – X', '14 – 16 years', 'Subject specialisation and focused preparation for Matric (SSC).', docs.secondarySyllabus, [['English', 'Compulsory'], ['Urdu', 'Compulsory'], ['Mathematics', 'Compulsory'], ['Physics', 'Science group'], ['Chemistry', 'Science group'], ['Biology / Computer Science', 'Science group elective'], ['Islamiyat & Pakistan Studies', 'Compulsory']]],
        ['higher-secondary', 'Higher Secondary Programme', 'Grades XI – XII', '16 – 18 years', 'Advanced study preparing students for university and professional pathways.', docs.higherSyllabus, [['English', 'Compulsory'], ['Urdu', 'Compulsory'], ['Physics', 'Pre-Engineering / Pre-Medical'], ['Chemistry', 'Pre-Engineering / Pre-Medical'], ['Mathematics', 'Pre-Engineering'], ['Biology', 'Pre-Medical'], ['Computer Science', 'ICS']]],
      ] as const
    ).map(([slug, title, grades, ages, lead, syllabus, subjects]) => ({
      slug: `academics/programmes/${slug}`, template: 'programme-detail', section: 'academics', title, eyebrow: 'ACADEMIC PROGRAMMES',
      subtitle: lead,
      intro: ['ACADEMIC PROGRAMMES', title, `${lead} The programme combines a balanced curriculum with mentoring, co-curricular activities and residential life.`] as [string, string, string],
      c: {
        photo: img(slug === 'middle-school' ? 'students-studying' : slug === 'secondary-school' ? 'assessment-exam' : 'library-reading'),
        glance: strip(['GraduationCap', grades, 'Grade levels'], ['Users', ages, 'Age group'], ['Calendar', slug === 'middle-school' ? '3 Years' : '2 Years', 'Duration'], ['BookOpen', '7 Subjects', 'Core curriculum'], ['ClipboardCheck', 'Termly', 'Assessment']),
        objectives: check('Target', 'Programme Objectives', '', ['Develop strong conceptual understanding', 'Build reading, writing and numeracy skills', 'Encourage curiosity and independent learning', 'Develop discipline, confidence and good character', 'Prepare students for the next academic stage']),
        subjects: table('BookOpen', 'Curriculum & Subjects', ['Subject', 'Focus'], subjects.map((s) => [...s])),
        cta: cta('GraduationCap', 'Interested in this programme?', 'Check eligibility and important dates, then apply online.', 'Apply Online', `${AD}/apply-online`, 'Eligibility Criteria', `${AD}/eligibility-criteria`),
        facts: kv('Info', 'Key Information', [['GraduationCap', 'Grades', grades], ['Users', 'Age group', ages], ['BookOpen', 'Curriculum', 'National / Cambridge-aligned'], ['BedDouble', 'Boarding', 'Residential'], ['ClipboardCheck', 'Assessment', 'Continuous & termly']]),
        downloads: downloads('Download', 'Downloads', [syllabus, docs.prospectus]),
        sidebarCard: scard('GraduationCap', 'All Programmes', 'Compare our academic programmes.', 'View Programmes', `${A}/programmes`),
        banner: banner('“Every Stage a Step Towards Excellence”'),
      },
    })),
    {
      slug: 'academics/curriculum', template: 'curriculum', section: 'academics', title: 'Curriculum', eyebrow: 'ACADEMICS',
      subtitle: 'A balanced, progressive curriculum that develops knowledge, skills and values.',
      intro: ['ACADEMICS', 'Our Curriculum', 'The SST curriculum follows the national framework enriched with Cambridge-aligned practices, focusing on conceptual understanding, critical thinking and the application of knowledge.'],
      c: {
        photo: img('library-reading'),
        strip: strip(['BookOpen', 'Concept-Based'], ['Lightbulb', 'Critical Thinking'], ['Layers', 'Progressive'], ['Globe', 'Globally Aligned'], ['Heart', 'Values-Based']),
        stages: table('Layers', 'Curriculum by Stage', ['Stage', 'Grades', 'Focus'], [['Middle School', 'VI – VIII', 'Foundations, core skills and study habits'], ['Secondary', 'IX – X', 'Subject specialisation and board preparation'], ['Higher Secondary', 'XI – XII', 'Advanced study and university preparation']]),
        framework: check('BookOpen', 'Subject Framework', '', ['Languages: English and Urdu', 'Mathematics', 'Sciences: Physics, Chemistry, Biology', 'Computer Science', 'Social Studies, Islamiyat and Pakistan Studies', 'Art, Physical Education and co-curricular programmes']),
        downloads: downloads('Download', 'Curriculum Documents', [docs.curriculumGuide, docs.middleSyllabus, docs.secondarySyllabus, docs.higherSyllabus]),
        sidebarCard: scard('BookOpen', 'Teaching & Learning', 'See how our teachers bring the curriculum to life.', 'Learn More', `${A}/teaching-learning`),
        banner: banner('“Knowledge, Skills and Values for Life”'),
      },
    },
    {
      slug: 'academics/teaching-learning', template: 'teaching-learning', section: 'academics', title: 'Teaching & Learning', eyebrow: 'ACADEMICS',
      subtitle: 'Engaging, student-centred teaching that inspires curiosity and independent learning.',
      intro: ['ACADEMICS', 'Teaching & Learning', 'Our teachers use a range of methods — discussion, inquiry, practical work and technology — to make learning meaningful and help every student achieve their potential.'],
      c: {
        strip: strip(['Users', 'Interactive Classes'], ['FlaskConical', 'Practical Learning'], ['Laptop', 'Technology Integration'], ['Lightbulb', 'Inquiry-Based'], ['UserCheck', 'Personal Attention']),
        image: img('faculty-team'),
        methodology: check('Presentation', 'Teaching Methodology', 'A student-centred approach that combines direct teaching with active learning.', ['Concept explanation with real-life examples', 'Group work, discussion and presentations', 'Laboratory and hands-on practical work', 'Projects and research assignments', 'Regular feedback and reflection']),
        gallery: imgCards('Camera', 'Learning in Action', [['support-remedial', 'Classroom Learning'], ['library-research', 'Research & Projects'], ['support-enrichment', 'Practical Work'], ['library-digital', 'Digital Learning'], ['support-mentoring', 'Mentoring']]),
        focus: check('Target', 'Key Focus Areas', '', ['Conceptual understanding', 'Critical and creative thinking', 'Communication skills', 'Collaboration and teamwork', 'Independent study habits']),
        resources: grid('Library', 'Learning Resources', [['Library', 'Library'], ['FlaskConical', 'Science Labs'], ['Laptop', 'Computer Lab'], ['MonitorPlay', 'Smart Classrooms']]),
        sidebarCard: scard('Users', 'Meet Our Faculty', 'Qualified and caring educators.', 'View Faculty', `${A}/faculty`),
        banner: banner('“Inspiring Curiosity, Building Understanding”'),
      },
    },
    {
      slug: 'academics/academic-calendar', template: 'academic-calendar', section: 'academics', title: 'Academic Calendar', eyebrow: 'ACADEMICS',
      subtitle: 'Plan, prepare and stay informed with the SST academic calendar, including terms, examinations, holidays and key school events.',
      intro: ['ACADEMICS', 'Academic Calendar', 'The academic calendar provides a comprehensive schedule of the academic year, including term dates, examinations, holidays and important school events.'],
      c: {
        photo: img('calendar-desk'),
        strip: strip(['CalendarDays', 'Academic Year', '2026 – 2027'], ['Layers', 'Total Terms', '3 Terms'], ['GraduationCap', 'Classes', 'Grades VI – XII'], ['CalendarDays', 'Working Days', '≈ 190 Days']),
        terms: table('CalendarDays', 'Term-wise Academic Schedule', ['Term', 'Term Duration', 'Mid-Term Assessment', 'Term Examinations', 'Result & Progress Reports'], [['Term I (Apr – Jul)', '01 April – 10 July 2026', '19 – 23 May 2026', '02 – 10 July 2026', '17 July 2026'], ['Term II (Aug – Nov)', '03 August – 20 November 2026', '21 – 25 September 2026', '09 – 17 November 2026', '27 November 2026'], ['Term III (Dec – Mar)', '01 December 2026 – 26 March 2027', '18 – 22 January 2027', '01 – 12 March 2027', '26 March 2027']], '', 'The first term focuses on the initiation of the academic year, coverage of key syllabus areas and formative assessments.'),
        dates: kv('CalendarDays', 'Key Academic Dates', [['CalendarDays', 'Commencement of Academic Year', '01 April 2026'], ['CalendarDays', 'Term I Examinations', '02 – 10 July 2026'], ['CalendarDays', 'Term II Examinations', '09 – 17 November 2026'], ['CalendarDays', 'Term III (Annual) Examinations', '01 – 12 March 2027'], ['Trophy', 'Annual Results & Closing', '26 March 2027']]),
        events: steps('Bell', 'Important Events', [['Award', 'Investiture Ceremony', '', '15 April 2026'], ['Footprints', 'Annual Sports Meet', '', '20 – 22 October 2026'], ['Users', "Founders' Day", '', '05 December 2026'], ['GraduationCap', 'Annual Prize Distribution', '', '25 March 2027']]),
        downloads: downloads('Download', 'Download Calendar', [docs.calendar]),
        sidebarCard: scard('CalendarDays', 'Important Dates', 'Admission dates for 2026 – 2027.', 'View Dates', `${AD}/important-dates`),
        banner: banner('“A Well-Planned Academic Journey for Continuous Growth and Excellence”'),
      },
    },
    {
      slug: 'academics/assessment-reporting', template: 'assessment-reporting', section: 'academics', title: 'Assessment & Reporting', eyebrow: 'ACADEMICS',
      subtitle: 'A fair, comprehensive and continuous assessment system that measures learning, supports improvement and keeps parents informed.',
      intro: ['ACADEMICS', 'Assessment & Reporting', 'SST follows a continuous and comprehensive assessment framework that evaluates academic progress, encourages deeper learning and provides clear, timely reporting to students and parents.'],
      c: {
        photo: img('assessment-exam'),
        strip: strip(['CalendarCheck', 'Continuous Assessment'], ['ChartColumn', 'Periodic Examinations'], ['Target', 'Skill & Competency Development'], ['UsersRound', 'Constructive Feedback'], ['FileText', 'Transparent Reporting']),
        framework: details('Layers', 'Assessment Framework', [['FileText', 'Formative Assessment', 'Ongoing, classroom-based assessments such as assignments, quizzes, projects and oral work that provide regular feedback and guide improvement.'], ['FilePen', 'Summative Assessment', 'Term-wise examinations that evaluate overall achievement and mastery of key learning outcomes.']], 'A balanced combination of formative and summative assessments to measure understanding, application and overall learning progress.'),
        reporting: check('Target', 'Reporting to Parents', 'A clear and comprehensive reporting system that keeps parents informed about their child’s academic progress, strengths and areas for improvement.', ['Term reports with detailed subject-wise performance', 'Assessment results and academic grades', 'Teacher comments and learning indicators', 'Attendance record and overall progress', 'Parent-teacher meetings for individual feedback']),
        schedule: table('CalendarDays', 'Assessment Schedule (Term-wise)', ['Term', 'Assessment Period', 'Key Assessments'], [['Term I', 'Apr – Jul', 'Quizzes, Assignments, Projects, Term Examination'], ['Term II', 'Aug – Nov', 'Class Tests, Projects, Mid-Term & Term Examination'], ['Term III', 'Dec – Mar', 'Assignments, Practical Work, Annual Examination']]),
        downloads: downloads('Download', 'Policies & Resources', [docs.assessmentPolicy, docs.reportingGuidelines, docs.progressSample]),
        grading: table('ChartColumn', 'Grading System', ['Grade', 'Marks Range'], [['A+', '90 – 100'], ['A', '80 – 89'], ['B+', '70 – 79'], ['B', '60 – 69'], ['C', '50 – 59'], ['D', '40 – 49'], ['E', 'Below 40']], '', 'A standardized and transparent grading system to reflect student achievement.'),
        sidebarCard: scard('Trophy', 'Academic Achievements', 'Our students’ results and distinctions.', 'View Achievements', `${A}/academic-achievements`),
        banner: banner('“Meaningful Assessment for Continuous Learning and Growth”'),
      },
    },
    {
      slug: 'academics/academic-support', template: 'academic-support', section: 'academics', title: 'Academic Support', eyebrow: 'ACADEMICS',
      subtitle: 'A comprehensive support system that helps every student learn effectively, overcome challenges and reach their full potential.',
      intro: ['ACADEMICS', 'Academic Support', 'SST provides a caring and structured support system to address diverse learning needs, build confidence, and ensure the academic, personal and emotional well-being of every student.'],
      c: {
        strip: strip(['BookOpen', 'Remedial Learning'], ['UsersRound', 'Academic Mentoring'], ['Brain', 'Counselling & Well-being'], ['Settings', 'Individual Learning Support'], ['Star', 'Enrichment Programmes']),
        image: img('support-mentoring'),
        approach: check('Layers', 'Our Support Approach', 'A proactive and inclusive approach that identifies learning needs early and provides timely, targeted support for continued progress.', ['Identify and address individual learning needs.', 'Provide academic guidance and study strategies.', 'Support social and emotional well-being.', 'Work closely with teachers and parents.', 'Foster confidence, resilience and a growth mindset.']),
        programmes: imgCards('UsersRound', 'Key Support Programmes', [['support-remedial', 'Remedial Learning'], ['support-mentoring', 'Academic Mentoring'], ['support-counselling', 'Counselling & Well-being'], ['support-individual', 'Individual Learning Support'], ['support-enrichment', 'Enrichment Programmes']]),
        services: check('Target', 'Key Support Services', '', ['Remedial and Reinforcement Classes', 'Academic Mentoring and Guidance', 'Student Counselling and Well-being', 'Individual Learning Plans (ILPs)', 'Exam Preparation and Study Skills', 'Enrichment and Extension Programmes']),
        downloads: downloads('Download', 'Policies & Resources', [docs.supportPolicy, docs.counselling, docs.learningSupport, docs.parentGuidance]),
        sidebarCard: scard('HeartHandshake', 'Student Welfare', 'Care for every student’s well-being.', 'Learn More', `${CL}/student-welfare`),
        banner: banner('“Every Learner Supported, Every Potential Nurtured”'),
      },
    },
    {
      slug: 'academics/libraries-resources', template: 'academic-support', section: 'academics', title: 'Libraries & Resources', eyebrow: 'ACADEMICS',
      subtitle: 'Rich learning resources, modern library facilities and digital tools that encourage reading, research and lifelong learning.',
      intro: ['ACADEMICS', 'Libraries & Resources', 'SST offers well-equipped library facilities and a wide range of learning resources—both print and digital—to develop a love for reading, support academic learning and build strong research skills.'],
      c: {
        strip: strip(['BookOpen', 'Rich Collections'], ['Laptop', 'Digital Resources'], ['Search', 'Research Support'], ['UsersRound', 'Reading Programmes'], ['Layers', 'Modern Facilities']),
        image: img('library-reading'),
        approach: check('Layers', 'Our Library', 'A vibrant learning space that provides access to a diverse collection of books, reference materials and digital resources to support classroom learning, research and personal enrichment.', ['A growing collection of print and digital resources.', 'A quiet and conducive learning environment.', 'Support for research, projects and assignments.', 'Guidance from qualified library staff.', 'Facilities for individual and group study.']),
        programmes: imgCards('UsersRound', 'Library Services', [['library-lending', 'Book Lending & Circulation'], ['library-digital', 'Digital Library Access'], ['library-research', 'Research & Reference Support'], ['library-reading', 'Reading Programmes'], ['library-study', 'Study & Learning Spaces']]),
        services: check('Target', 'Key Resources', '', ['Books, reference and subject resources', 'E-books and digital library access', 'Research databases and online journals', 'Multimedia and audio-visual resources', 'Educational magazines and periodicals', 'Curriculum-aligned learning materials']),
        downloads: downloads('Download', 'Library Documents & Links', [docs.libraryPolicy, docs.libraryRules, docs.readingFramework, docs.eResources]),
        sidebarCard: scard('BookOpen', 'Academic Support', 'Support for every learner.', 'Learn More', `${A}/academic-support`),
        banner: banner('“Reading, Research and Resources for Lifelong Learning”'),
      },
    },
    {
      slug: 'academics/faculty', template: 'faculty-overview', section: 'academics', title: 'Faculty', eyebrow: 'ACADEMICS',
      subtitle: 'A team of qualified, experienced and dedicated educators committed to academic excellence and the holistic development of students.',
      intro: ['ACADEMICS', 'Our Faculty', 'SST is proud of its team of highly qualified, experienced and passionate educators who create an engaging learning environment, nurture talent and guide students towards academic and personal excellence.'],
      c: {
        strip: strip(['GraduationCap', 'Qualified Educators'], ['UsersRound', 'Experienced Team'], ['Star', 'Subject Experts'], ['Sprout', 'Student-Centred Approach'], ['BookOpen', 'Continuous Professional Growth']),
        image: img('faculty-team'),
        team: check('Layers', 'Our Teaching Team', 'Our faculty brings together academic expertise, practical experience and a strong commitment to the SST vision and values. They are mentors, role models and partners in every student’s learning journey.', ['Subject specialists across all programmes.', 'Supportive and student-focused mentors.', 'Regular professional development and training.', 'Committed to academic and character development.']),
        glance: stats('UsersRound', 'Faculty at a Glance', [['CalendarDays', 'Total Faculty', '86'], ['GraduationCap', 'Master’s & Above', '78%'], ['Award', 'Average Experience', '9+ Years'], ['UsersRound', 'Annual Training Hours', '40+']]),
        development: check('ChartColumn', 'Professional Development', '', ['Ongoing teacher training and workshops', 'Curriculum and pedagogy enhancement', 'Subject and assessment development', 'Leadership and mentoring programmes']),
        sidebarCard: scard('UsersRound', 'Faculty Directory', 'Browse all faculty members by department and programme.', 'View Directory', `${A}/faculty/directory`),
        banner: banner('“Dedicated Educators, Inspired Learners, A Stronger Future”'),
      },
    },
    {
      slug: 'academics/faculty/directory', template: 'faculty-directory', section: 'academics', title: 'Faculty Directory', eyebrow: 'ACADEMICS',
      subtitle: 'Browse our team of qualified and experienced educators by department, programme or subject.',
      intro: ['ACADEMICS', 'Faculty Directory', 'Meet our team of dedicated educators who bring expertise, experience and a passion for learning to SST.'],
      c: { sidebarCard: scard('UsersRound', 'Join Our Faculty', 'Explore teaching careers at SST.', 'View Careers', '/careers'), banner: banner('“Dedicated Educators, Inspired Learners”') },
    },
    {
      slug: 'academics/academic-achievements', template: 'academic-achievements', section: 'academics', title: 'Academic Achievements', eyebrow: 'ACADEMICS',
      subtitle: 'A proud record of academic excellence, high performance and consistent success across national and international platforms.',
      intro: ['ACADEMICS', 'Academic Achievements', 'SST takes pride in the outstanding academic performance of its students. Our learners consistently excel in board examinations, national competitions and international academic contests.'],
      c: {
        strip: strip(['GraduationCap', 'Outstanding Board Results'], ['Award', 'National Recognitions'], ['Trophy', 'International Awards'], ['Star', 'Subject Excellence'], ['BookOpen', 'Consistent High Performance']),
        image: img('achievements-trophy'),
        journey: check('Star', 'Our Achievement Journey', 'Through a strong academic programme, dedicated faculty and a culture of hard work, our students continue to achieve remarkable results and bring honour to SST.', ['Consistently high board examination results.', 'Top positions in district and provincial competitions.', 'Recognition in national and international contests.', 'Excellence across a wide range of subjects.', 'A growing record of student awards and distinctions.']),
        glance: stats('ChartColumn', 'At a Glance', [['GraduationCap', 'Board Result (A & A+)', '92%'], ['Award', 'School Position (District)', 'Top 5'], ['Trophy', 'National Awards (Last 5 Years)', '18+'], ['Globe', 'International Achievements', '6+'], ['UsersRound', 'Subject Distinctions', '120+']]),
        sidebarCard: scard('Trophy', 'High Achievers', 'Meet our top performing students.', 'View Achievers', `${A}/academic-achievements/high-achievers`),
        banner: banner('“A Tradition of Academic Excellence”'),
      },
    },
    {
      slug: 'academics/academic-achievements/board-results', template: 'results-board', section: 'academics', title: 'Board Results', eyebrow: 'ACADEMICS',
      subtitle: 'Year-by-year board examination results of SST students.', intro: ['ACADEMICS', 'Board Results', 'A consistent record of excellent board examination results. Select a result to view the detailed analysis.'],
      c: { strip: strip(['GraduationCap', '92% A & A+', 'Matric 2025'], ['UsersRound', '120 Students', 'Appeared'], ['Award', '18', 'Subject distinctions'], ['Trophy', 'Top 5', 'District position']), sidebarCard: scard('ChartColumn', 'Detailed Results', 'Class-wise and subject-wise analysis.', 'View Details', `${A}/academic-achievements/detailed-results`), banner: banner('“Consistent Excellence in Academics”') },
    },
    {
      slug: 'academics/academic-achievements/detailed-results', template: 'results-detailed', section: 'academics', title: 'Detailed Results', eyebrow: 'ACADEMICS',
      subtitle: 'Comprehensive board examination results, class-wise performance and subject analysis of our students.',
      intro: ['ACADEMICS', 'Detailed Results', 'A comprehensive view of our students’ performance in board examinations, including overall results, subject-wise analysis and year-wise trends.'],
      c: { sidebarCard: scard('Trophy', 'High Achievers', 'Celebrating our top students.', 'View Achievers', `${A}/academic-achievements/high-achievers`), banner: banner('“Consistent Excellence in Academics”') },
    },
    {
      slug: 'academics/academic-achievements/high-achievers', template: 'results-achievers', section: 'academics', title: 'High Achievers', eyebrow: 'ACADEMICS',
      subtitle: 'Celebrating the outstanding performance, dedication and perseverance of our students.',
      intro: ['ACADEMICS', 'High Achievers', 'Our proud high achievers who have demonstrated exceptional academic excellence in board examinations.'],
      c: { sidebarCard: scard('ChartColumn', 'Detailed Results', 'Full result analysis.', 'View Results', `${A}/academic-achievements/detailed-results`), banner: banner('“Celebrating Excellence, Inspiring Greater Heights”') },
    },
    ...(['National', 'International'] as const).map((k) => ({
      slug: `academics/academic-achievements/${k.toLowerCase()}-achievements`, template: 'achievement-category', section: 'academics', title: `${k} Achievements`, eyebrow: 'ACADEMICS',
      subtitle: `Recognition earned by SST students in ${k.toLowerCase()} competitions and contests.`,
      intro: ['ACADEMICS', `${k} Achievements`, `Our students regularly compete and excel at the ${k.toLowerCase()} level in academic olympiads, competitions and contests.`] as [string, string, string],
      c: {
        strip: strip(['Trophy', k === 'National' ? '18+' : '6+', 'Awards (last 5 years)'], ['Medal', 'Olympiads', 'Science & Mathematics'], ['Award', 'Competitions', 'Debates & quizzes'], ['Star', 'Recognition', 'Students & teams']),
        achievementCategory: 'Academic',
        sidebarCard: scard('Award', 'All Achievements', 'Academic, sports and co-curricular honours.', 'View All', `${NE}/achievements`),
        banner: banner('“Excellence Recognised Beyond Our Campus”'),
      },
    })),
    {
      slug: 'academics/academic-achievements/subject-excellence', template: 'subject-excellence', section: 'academics', title: 'Subject Excellence', eyebrow: 'ACADEMICS',
      subtitle: 'Distinctions earned by SST students in individual subjects.', intro: ['ACADEMICS', 'Subject Excellence', 'Subject-wise distinctions reflect the strength of our teaching and the dedication of our students across languages, sciences and humanities.'],
      c: {
        strip: strip(['BookOpen', 'Languages'], ['Calculator', 'Mathematics'], ['FlaskConical', 'Sciences'], ['Globe', 'Humanities']),
        subjects: grid('Star', 'Subject Distinctions (Matric 2025)', [['BookOpen', 'English', '6 Distinctions'], ['Calculator', 'Mathematics', '5 Distinctions'], ['FlaskConical', 'Chemistry', '3 Distinctions'], ['Atom', 'Physics', '4 Distinctions']]),
        table: table('ChartColumn', 'Distinctions by Year', ['Subject', '2023', '2024', '2025'], [['English', '4', '5', '6'], ['Mathematics', '4', '4', '5'], ['Physics', '3', '3', '4'], ['Chemistry', '2', '3', '3']], 'Figures are placeholders until confirmed by the Examinations Office.'),
        glance: stats('ChartColumn', 'At a Glance', [['Award', 'Subject Distinctions (2025)', '18'], ['UsersRound', 'Subject Distinctions (all time)', '120+'], ['Trophy', 'Strongest Subject', 'Islamiat 96%']]),
        sidebarCard: scard('ChartColumn', 'Detailed Results', 'Subject-wise analysis.', 'View Results', `${A}/academic-achievements/detailed-results`),
        banner: banner('“Mastery in Every Subject”'),
      },
    },
    {
      slug: 'academics/academic-achievements/year-wise-highlights', template: 'year-highlights', section: 'academics', title: 'Year-wise Highlights', eyebrow: 'ACADEMICS',
      subtitle: 'Key academic milestones and highlights over the years.', intro: ['ACADEMICS', 'Year-wise Highlights', 'A year-by-year record of SST’s most notable academic achievements.'],
      c: {
        timeline: steps('CalendarDays', 'Highlights by Year', [['Trophy', '2025', 'Matric (SSC): 92% A & A+ grades, Top 5 in the district.'], ['Medal', '2024', 'National Science Olympiad medals and record subject distinctions.'], ['Award', '2023', 'Inter-school mathematics and debating championships.'], ['GraduationCap', '2022', 'Expansion of science and computer laboratories.']]),
        glance: stats('ChartColumn', 'At a Glance', [['Trophy', 'National Awards (Last 5 Years)', '18+'], ['Globe', 'International Achievements', '6+'], ['UsersRound', 'Subject Distinctions', '120+']]),
        sidebarCard: scard('Trophy', 'Board Results', 'Year-by-year results.', 'View Results', `${A}/academic-achievements/board-results`),
        banner: banner('“Building on a Tradition of Excellence”'),
      },
    },
    // ───────── Admissions ─────────
    {
      slug: 'admissions', template: 'admissions-overview', section: 'admissions', title: 'Admissions', eyebrow: 'ADMISSIONS',
      subtitle: 'Join SST and be part of a nurturing learning environment that builds character, knowledge and leadership.',
      intro: ['ADMISSIONS', 'Admissions Overview', 'SST offers a holistic and value-based education that empowers students to excel academically, grow personally and contribute positively to society.'],
      c: {
        photo: img('admissions-students'),
        strip: strip(['GraduationCap', 'Quality Education'], ['UsersRound', 'Safe & Supportive Environment'], ['Sprout', 'Character Building'], ['BookOpen', 'Holistic Development'], ['Trophy', 'Leadership & Service']),
        journey: steps('ChartColumn', 'The Admission Journey', [['ClipboardList', 'Check Eligibility'], ['Laptop', 'Apply Online'], ['FileText', 'Submit Documents'], ['UsersRound', 'Assessment / Interview'], ['BadgeCheck', 'Admission Decision'], ['UserCheck', 'Enrollment & Orientation']]),
        eligibility: kv('UsersRound', 'Eligibility Criteria', [['CircleCheck', 'Pre-Primary (KG)', '3 – 5 years'], ['CircleCheck', 'Primary (I – V)', '6 – 10 years'], ['CircleCheck', 'Middle (VI – VIII)', '11 – 13 years'], ['CircleCheck', 'Secondary (IX – X)', '14 – 16 years']], 'View Detailed Criteria', `${AD}/eligibility-criteria`),
        dates: kv('CalendarDays', 'Important Dates (Academic Year 2026–27)', [['CalendarDays', 'Applications Open', '01 February 2026'], ['CalendarDays', 'Last Date to Apply', '28 February 2026'], ['CalendarDays', 'Entrance Assessment / Interview', '05 – 10 March 2026'], ['CalendarDays', 'Admission Decisions', '15 March 2026'], ['CalendarDays', 'Enrollment & Fee Submission', '20 – 27 March 2026']], 'View Full Admission Calendar', `${AD}/important-dates`),
        documents: { ...check('FileText', 'Required Documents', '', ['Completed admission application form (online)', 'Birth certificate / B-Form (copy)', 'Previous school report / result card', 'Two recent passport-size photographs', 'Copy of parent / guardian CNIC', 'Other documents (if required)']), ctaLabel: 'View Checklist', ctaHref: `${AD}/required-documents` },
        sidebarCard: scard('FilePen', 'Ready to Apply?', 'Start your admission application online.', 'Apply Now', `${AD}/apply-online`),
        banner: banner('“A Place to Learn, Grow and Lead”', 'Enrollment for', '2026 – 2027', 'BookOpen', 'Apply for Admission', `${AD}/apply-online`),
      },
    },
    {
      slug: 'admissions/eligibility-criteria', template: 'eligibility', section: 'admissions', title: 'Eligibility Criteria', eyebrow: 'ADMISSIONS',
      subtitle: 'Grade-wise age, academic and assessment requirements for admission to SST.',
      intro: ['ADMISSIONS', 'Eligibility Criteria', 'The following age, academic and assessment requirements apply for admission to different grade levels at SST.'],
      c: {
        strip: strip(['Users', 'Age Requirement', 'Grade-wise age limits'], ['Layers', 'Academic Requirement', 'Previous class performance'], ['ClipboardList', 'Assessment', 'Entrance test / interview'], ['UsersRound', 'Seat Availability', 'Subject to capacity'], ['ShieldCheck', 'General Conditions', 'Applicable to all grades']),
        grades: table('GraduationCap', 'Grade-wise Eligibility', ['Grade Level', 'Age Requirement (as on 31 March 2026)', 'Previous Academic Requirement', 'Assessment / Selection'], [['Pre-Primary (KG)', '3 – 5 years', 'Age appropriate readiness', 'Interaction & observation'], ['Primary (I – V)', '6 – 10 years', 'Successful completion of previous grade', 'Basic assessment & interview'], ['Middle (VI – VIII)', '11 – 13 years', 'Successful completion of previous grade', 'Written assessment & interview'], ['Secondary (IX – X)', '14 – 16 years', 'Completion of Middle (VIII)', 'Written assessment & interview']]),
        conditions: check('ClipboardCheck', 'General Eligibility Conditions', '', ['Applicants must meet the age criteria for the grade applied for.', 'Satisfactory academic record from the previous school.', 'Successful performance in the admission assessment (as applicable).', 'Interview (student and parent/guardian) is mandatory.', 'Admission is subject to seat availability.', 'Submission of all required documents within the given timeline.']),
        assessment: check('BookOpen', 'Assessment Details', '', ['Age-appropriate assessment for Pre-Primary.', 'Subject-based written test (English, Math, Urdu, Science) for Grade VI and above.', 'Interview with student and parent/guardian.']),
        considerations: check('Award', 'Admission Considerations', '', ['Overall academic performance.', 'Readiness and learning potential.', 'Co-curricular interests and participation.', 'Alignment with SST’s values and conduct.']),
        note: note('Info', 'Important Note', 'Meeting the eligibility criteria and assessment requirements does not automatically guarantee admission. Final admission is at the discretion of the school management.'),
        sidebarCard: help('Our admissions team is here to help you.'),
        banner: admBanner('“Join SST – A Nurturing Learning Community”', 'Apply for Admission', 'Apply Now'),
      },
    },
    {
      slug: 'admissions/admission-process', template: 'admission-process', section: 'admissions', title: 'Admission Process', eyebrow: 'ADMISSIONS',
      subtitle: 'A simple, transparent and structured process to help you apply for admission to SST.',
      intro: ['ADMISSIONS', 'Admission Process', 'Follow these simple steps to apply, get assessed and secure admission for your child at SST.'],
      c: {
        steps: steps('', '', [['Laptop', 'Apply Online', 'Complete the admission application form.'], ['FileText', 'Submit Documents', 'Upload the required documents as per the checklist.'], ['ClipboardList', 'Assessment', 'Attend the written assessment (as applicable).'], ['UsersRound', 'Interview', 'Interaction with the student and parent/guardian.'], ['BadgeCheck', 'Admission Decision', 'Receive the admission status via email or SMS.'], ['UserPlus', 'Enrollment', 'Complete fee submission and formal enrollment to start classes.']]),
        details: details('FileText', 'Step-by-Step Details', [['', 'Apply Online', 'Visit the SST website and fill out the online admission form with accurate information.'], ['', 'Submit Documents', 'Upload / submit the required documents within the given timeline.'], ['', 'Assessment', 'Students (Grade I and above) are required to take a written assessment to evaluate their learning level.'], ['', 'Interview', 'A brief interaction with the student and parent/guardian to understand the student’s interests and learning needs.'], ['', 'Admission Decision', 'The admission decision is communicated via email or SMS within the announced timeframe.'], ['', 'Enrollment', 'Upon selection, complete the fee submission and enrollment formalities to confirm the admission.']]),
        timeline: kv('CalendarDays', 'Process Timeline (Academic Year 2026–27)', [['Laptop', 'Applications Open', '01 February 2026'], ['FileText', 'Last Date to Apply', '28 February 2026'], ['FilePen', 'Assessments', '05 – 10 March 2026'], ['UsersRound', 'Interviews', '10 – 14 March 2026'], ['CircleCheck', 'Admission Decisions', '15 March 2026'], ['UserPlus', 'Enrollment & Fee Submission', '20 – 27 March 2026']]),
        notes: note('Info', 'Important Notes', '', ['Ensure that the application is complete and submitted before the deadline.', 'Assessment and interview details will be shared via email/SMS.', 'Admission is subject to meeting the eligibility criteria and seat availability.', 'Submission of accurate and verifiable documents is mandatory.']),
        actions: { items: [{ icon: 'FileText', label: 'Download Admission Guide (PDF)', href: '/downloads?category=prospectus-brochures' }, { icon: 'ClipboardList', label: 'View Required Documents', href: `${AD}/required-documents` }, { icon: 'CalendarDays', label: 'Check Important Dates', href: `${AD}/important-dates` }, { icon: 'CircleHelp', label: 'Admission FAQs', href: `${AD}/faqs` }] },
        sidebarCard: help('Our admissions team is here to guide you through the process.'),
        banner: admBanner('“A Fair, Transparent and Child-centric Admission Process”', 'Apply for Admission', 'Apply Now'),
      },
    },
    {
      slug: 'admissions/grade-levels', template: 'grade-levels', section: 'admissions', title: 'Grade Levels', eyebrow: 'ADMISSIONS',
      subtitle: 'Explore our grade levels, age groups and academic progression to find the right entry point for your child at SST.',
      intro: ['ADMISSIONS', 'Grade Levels', 'A structured academic journey from Pre-Primary to Secondary, designed for age-appropriate learning, academic excellence and holistic development.'],
      c: {
        art: art('art-grades'),
        levels: { items: [{ icon: 'Sprout', title: 'Pre-Primary', badge: 'KG', text: 'A strong and joyful beginning to formal education.' }, { icon: 'BookOpen', title: 'Primary', badge: 'Grade I – V', text: 'Building core concepts, confidence and good habits.' }, { icon: 'Layers', title: 'Middle', badge: 'Grade VI – VIII', text: 'Developing deeper understanding, critical thinking and life skills.' }, { icon: 'Trophy', title: 'Secondary', badge: 'Grade IX – X', text: 'Academic rigour, character and preparation for future pathways.' }] },
        details: table('ChartColumn', 'Grade-wise Details', ['Level', 'Grades', 'Age Range (at the time of admission)', 'Key Focus'], [['Pre-Primary', 'KG', '3 – 5 years', 'Early learning, social development, creativity and school readiness.'], ['Primary', 'Grade I – V', '6 – 10 years', 'Foundational learning in core subjects, reading, writing and numeracy.'], ['Middle', 'Grade VI – VIII', '11 – 13 years', 'Conceptual learning, application of knowledge and development of analytical skills.'], ['Secondary', 'Grade IX – X', '14 – 16 years', 'Subject specialization, academic excellence and preparation for higher studies.']]),
        progression: { icon: 'ChartColumn', heading: 'Academic Progression', items: [{ title: 'KG', text: '(Pre-Primary)' }, { title: 'I – V', text: '(Primary)' }, { title: 'VI – VIII', text: '(Middle)' }, { title: 'IX – X', text: '(Secondary)' }] },
        benefits: check('Award', 'Key Benefits at Each Level', '', ['Age-appropriate and stage-wise curriculum.', 'Focus on academic excellence and character building.', 'Co-curricular and extracurricular opportunities.', 'Smooth and structured progression from KG to Grade X.']),
        cta: cta('CalendarDays', 'Ready to Begin?', 'Check the eligibility criteria and start your child’s admission journey today.', 'Apply Online', `${AD}/apply-online`, 'View Eligibility Criteria', `${AD}/eligibility-criteria`),
        sidebarCard: help('Our admissions team is here to help you choose the right grade level.'),
        banner: admBanner('“A Complete Learning Journey from Early Years to Secondary”'),
      },
    },
    {
      slug: 'admissions/important-dates', template: 'important-dates', section: 'admissions', title: 'Important Dates', eyebrow: 'ADMISSIONS',
      subtitle: 'Stay updated with key dates for the admissions cycle for Academic Year 2026 – 2027.',
      intro: ['ADMISSIONS', 'Important Dates', 'Key dates and deadlines for the admission process for Academic Year 2026 – 2027.'],
      c: {
        art: art('art-calendar'),
        timeline: steps('', '', [['FileText', 'Applications Open', '', '01 Feb 2026'], ['CalendarDays', 'Last Date to Apply', '', '28 Feb 2026'], ['ClipboardList', 'Assessments', '', '05 – 10 Mar 2026'], ['UsersRound', 'Interviews', '', '10 – 14 Mar 2026'], ['BadgeCheck', 'Admission Decisions', '', '15 Mar 2026'], ['GraduationCap', 'Enrollment & Fee Submission', '', '20 – 27 Mar 2026']]),
        schedule: table('CalendarDays', 'Detailed Schedule (Academic Year 2026 – 2027)', ['#', 'Activity', 'Date / Duration', 'Details'], [['01', 'Applications Open', '01 February 2026', 'Online admission application starts.'], ['02', 'Last Date to Apply', '28 February 2026', 'Final date for online application submission.'], ['03', 'Entrance Assessments', '05 – 10 March 2026', 'Grade-appropriate written assessment (as applicable).'], ['04', 'Interviews', '10 – 14 March 2026', 'Interaction with student and parent/guardian.'], ['05', 'Admission Decisions', '15 March 2026', 'Admission status communicated via email or SMS.'], ['06', 'Fee Submission & Enrollment', '20 – 27 March 2026', 'Submission of admission fee and completion of enrollment formalities.'], ['07', 'Classes Begin', '06 April 2026', 'Commencement of the new academic session (2026 – 2027).']]),
        notes: note('Info', 'Important Notes', '', ['All dates are for the Academic Year 2026 – 2027.', 'Applications must be submitted by the deadline.', 'Assessment and interview schedules will be shared via email/SMS.', 'Admission is subject to meeting the eligibility criteria and seat availability.', 'The school reserves the right to amend the dates, if required, with prior notice on the website.']),
        downloads: downloads('Download', 'Download', [docs.admissionsCalendar]),
        sidebarCard: help('Our admissions team is here to help with dates, deadlines and next steps.'),
        banner: admBanner('“Plan Ahead, Apply on Time, and Secure Your Child’s Seat”'),
      },
    },
    {
      slug: 'admissions/required-documents', template: 'required-documents', section: 'admissions', title: 'Required Documents', eyebrow: 'ADMISSIONS',
      subtitle: 'A complete list of documents needed to apply for admission to SST for Academic Year 2026 – 2027.',
      intro: ['ADMISSIONS', 'Required Documents', 'Prepare and submit the following documents with your admission application. Ensure that all documents are clear, valid and meet the specified requirements.'],
      c: {
        art: art('art-documents'),
        strip: strip(['ClipboardCheck', 'Complete Application Form'], ['IdCard', 'Identity & Age Proof'], ['GraduationCap', 'Previous Academic Record'], ['UserRound', 'Recent Photographs'], ['FileText', 'Guardian Identification'], ['ShieldCheck', 'Additional (If Applicable)']),
        checklist: table('FileText', 'Document Checklist (General)', ['#', 'Required Document', 'Details / Specification'], [['01', 'Admission Application Form', 'Complete the online form or download (PDF), fill and submit.'], ['02', 'Birth Certificate / B-Form', 'Government issued (NADRA) copy of the student.'], ['03', 'Previous School Report / Result Card', 'Report card of the last completed class (attested copy).'], ['04', 'Transfer Certificate (if applicable)', 'From the previous school (for Grade I and above).'], ['05', 'Photographs', '2 recent passport-size photographs (blue background).'], ['06', 'Parent / Guardian CNIC', 'Copy of father, mother or guardian CNIC.'], ['07', 'Medical Certificate (if required)', 'Health / fitness certificate (as per school requirement).']]),
        grades: table('UsersRound', 'Grade-wise Requirements', ['Level', 'Documents'], [['Pre-Primary (KG)', 'Birth Certificate / B-Form; 2 Passport-size Photographs'], ['Primary (Grade I – V)', 'Birth Certificate / B-Form; Previous Class Report Card (if applicable); 2 Passport-size Photographs'], ['Middle (Grade VI – VIII)', 'Previous School Report Card; Transfer Certificate (if joining from another school); 2 Passport-size Photographs'], ['Secondary (Grade IX – X)', 'Previous School Report Card; Transfer Certificate; 2 Passport-size Photographs']]),
        notes: note('Info', 'Important Notes', '', ['All documents must be clear, valid and attested (where applicable).', 'Original documents may be required at the time of verification.', 'Incomplete or incorrect documents may delay the admission process.', 'Additional documents may be requested, if required, based on the applicant’s profile.']),
        downloads: downloads('Download', 'Download', [docs.docChecklist]),
        sidebarCard: help('Our admissions team is here to guide you on document requirements.'),
        banner: admBanner('“Keep Your Documents Ready for a Smooth Admission Process”', 'Apply for Admission', 'Apply Online'),
      },
    },
    {
      slug: 'admissions/fees-scholarships', template: 'fees', section: 'admissions', title: 'Fees & Scholarships', eyebrow: 'ADMISSIONS',
      subtitle: 'A transparent fee structure with merit-based scholarships and financial support to make quality education accessible.',
      intro: ['ADMISSIONS', 'Fees & Scholarships', 'Explore our fee structure, payment schedule, available scholarships and financial assistance programs for Academic Year 2026 – 2027.'],
      c: {
        strip: strip(['Coins', 'Transparent Fee Structure'], ['GraduationCap', 'Merit-Based Scholarships'], ['UsersRound', 'Need-Based Financial Support'], ['CalendarDays', 'Flexible Payment Options'], ['Percent', 'Sibling Concession'], ['HandHeart', 'Support for Deserving Students']),
        fees: table('Coins', 'Fee Structure (Academic Year 2026 – 2027)', ['Grade Level', 'Admission Fee (One-time)', 'Tuition Fee (Per Month)', 'Annual Charges (Per Year)', 'Total (First Year) (Approx.)'], [['Pre-Primary (KG)', 'Rs. 20,000', 'Rs. 6,000', 'Rs. 8,000', 'Rs. 100,000'], ['Primary (I – V)', 'Rs. 20,000', 'Rs. 6,500', 'Rs. 9,000', 'Rs. 107,000'], ['Middle (VI – VIII)', 'Rs. 25,000', 'Rs. 7,500', 'Rs. 10,000', 'Rs. 125,000'], ['Secondary (IX – X)', 'Rs. 25,000', 'Rs. 8,500', 'Rs. 12,000', 'Rs. 139,000']], 'The above fee structure is indicative and may be revised by the school management. All fees are payable in Pakistani Rupees (PKR).'),
        scholarships: details('Award', 'Scholarships & Financial Support', [['Trophy', 'Merit Scholarship', 'Awarded to high-achieving students based on academic performance in the admission assessment or previous results.'], ['UsersRound', 'Need-Based Support', 'Partial fee support for students from financially challenging backgrounds.'], ['Award', 'Talent Scholarship', 'For outstanding performance in academics, sports, or co-curricular activities.'], ['Users', 'Sibling Concession', 'Tuition fee concession for two or more siblings enrolled at SST.']]),
        payment: details('CreditCard', 'Payment & Other Details', [['CalendarDays', 'Payment Schedule', 'Tuition fee is payable monthly, quarterly, or annually (as per school policy).'], ['CreditCard', 'Payment Modes', 'Online bank transfer, cash deposit at designated bank branches, or through the school office.'], ['Percent', 'Late Payment', 'A late payment charge may apply, as per the school’s policy.'], ['RefreshCw', 'Fee Revision', 'Fees are reviewed periodically and may be revised for the next academic year.']]),
        notes: note('Info', 'Important Notes', '', ['The admission fee is a one-time, non-refundable and non-transferable fee.', 'Scholarships are granted after due evaluation and are subject to annual review.', 'Sibling concessions are applicable on tuition fee only.', 'All fee-related policies are governed by the SST administration.']),
        downloads: downloads('Download', 'Downloads', [docs.feeStructure, docs.scholarshipPolicy]),
        sidebarCard: help('Our admissions team is here to answer your questions about fees, scholarships and payments.'),
        banner: admBanner('“Quality Education with Accessible and Inclusive Opportunities”'),
      },
    },
    {
      slug: 'admissions/faqs', template: 'faqs', section: 'admissions', title: 'Admissions FAQs', eyebrow: 'ADMISSIONS',
      subtitle: 'Find answers to the most common questions about our admission process, eligibility, documents, fees and scholarships.',
      intro: ['ADMISSIONS', 'Frequently Asked Questions', 'Find quick answers to the most common questions about admissions at SST.'],
      c: { contactHeading: 'Still Have a Question?', contactText: 'If you can’t find the answer you’re looking for, our admissions team is happy to help.', visitHref: '/contact', sidebarCard: help('Our admissions team is here to answer your questions and guide you through the process.'), banner: admBanner('“Get Your Questions Answered and Apply with Confidence”', 'Apply for Admission') },
    },
    // ───────── Campus life ─────────
    {
      slug: 'campus-life', template: 'campus-overview', section: 'campus-life', title: 'Campus Life', eyebrow: 'CAMPUS LIFE',
      subtitle: 'A vibrant, inclusive and enriching campus experience that nurtures character, leadership, wellbeing and lifelong skills.',
      intro: ['CAMPUS LIFE', 'A Holistic Boarding School Experience', 'Campus Life at SST goes beyond academics, offering a safe, supportive and engaging environment where students live, learn, grow and lead together.'],
      c: {
        cards: cards('', '', [
          { image: 'campus-card-residential', icon: 'BedDouble', title: 'Residential Life', text: 'A safe, disciplined and home-like boarding environment.', href: `${CL}/residential-life` },
          { image: 'campus-card-house', icon: 'Shield', title: 'House System', text: 'A vibrant house structure that builds leadership, teamwork and healthy competition.', href: `${CL}/house-system` },
          { image: 'campus-card-sports', icon: 'Trophy', title: 'Sports & Activities', text: 'Diverse sports and co-curricular activities for physical fitness, confidence and teamwork.', href: `${CL}/sports-activities` },
          { image: 'campus-card-welfare', icon: 'HandHeart', title: 'Student Welfare', text: 'Comprehensive support for students’ wellbeing, health and personal development.', href: `${CL}/student-welfare` },
          { image: 'campus-card-clubs', icon: 'UsersRound', title: 'Clubs & Societies', text: 'A platform to explore interests, develop talents and take on leadership roles.', href: `${CL}/clubs-societies` },
        ]),
        band: strip(['GraduationCap', 'Balanced Development', 'Academics, character and life skills'], ['UsersRound', 'Vibrant Community', 'Belonging, teamwork and friendship'], ['Sprout', 'Safe & Supportive', 'A secure and caring campus'], ['Medal', 'Leadership & Values', 'Responsibility, service and citizenship']),
        cta: cta('GraduationCap', 'Discover the SST Campus Experience', 'Explore our residential life, house system, sports, student welfare and clubs & societies in detail.', 'Explore Campus Life', `${CL}/residential-life`),
        sidebarCard: scard('School', 'Life at SST', 'A home, a community and a learning environment beyond the classroom.', 'Explore Our Campus', '/about/campus-location'),
        banner: banner('“A Home, A Community, A Place to Grow”'),
      },
    },
    {
      slug: 'campus-life/residential-life', template: 'residential-life', section: 'campus-life', title: 'Residential Life', eyebrow: 'CAMPUS LIFE', hero: 'hero-residential',
      subtitle: 'A safe, disciplined and home-like boarding environment that nurtures independence, character and lifelong values.',
      intro: ['CAMPUS LIFE', 'Residential Life at SST', 'SST offers a well-structured residential programme that provides a secure, caring and purposeful environment, helping students develop discipline, responsibility and independence.'],
      c: {
        image: img('residential-room'),
        home: check('School', 'A Home Away from Home', 'Our boarding life fosters a sense of belonging, encourages self-reliance and builds strong character through a balanced routine, guidance and a supportive residential team.', ['Safe and secure campus', '24/7 pastoral care and supervision', 'Structured daily routine', 'Focus on character and life skills']),
        image2: img('residential-students'),
        facilities: grid('BedDouble', 'Residential Facilities', [['BedDouble', 'Comfortable Dormitories'], ['Utensils', 'Nutritious Dining'], ['BookOpen', 'Study Areas'], ['Stethoscope', 'Medical Support'], ['UsersRound', 'House Mentors'], ['ShieldCheck', '24/7 Security']]),
        routine: { icon: 'CalendarDays', heading: 'Daily Routine (Illustrative)', items: [{ icon: 'Sunrise', title: '06:00 AM', text: 'Wake-up & Physical Activity' }, { icon: 'BookOpen', title: '07:00 AM', text: 'Morning Routine & Breakfast' }, { icon: 'GraduationCap', title: '08:00 AM – 03:00 PM', text: 'Academic Programme' }, { icon: 'Volleyball', title: '04:00 PM', text: 'Sports & Activities' }, { icon: 'BookOpen', title: '07:00 PM', text: 'Study Hour (Prep)' }, { icon: 'Moon', title: '10:00 PM', text: 'Lights Out' }] },
        benefits: benefits('UsersRound', 'Key Benefits', [['ChartColumn', 'Independence', 'Builds self-discipline and life skills.'], ['Sprout', 'Character Development', 'Instils responsibility, respect and integrity.'], ['UsersRound', 'Community Living', 'Fosters teamwork, friendship and belonging.'], ['Star', 'Holistic Growth', 'A balanced mix of academics, activities and personal development.']]),
        sidebarCard: scard('School', 'Life at SST', 'A home, a community and a learning environment beyond the classroom.', 'Explore Campus Life', CL),
        banner: banner('“A Supportive Boarding Experience for Lifelong Success”', 'Discover Residential Life at SST', '', 'BedDouble', 'Apply for Admission', `${AD}/apply-online`),
      },
    },
    {
      slug: 'campus-life/house-system', template: 'house-system', section: 'campus-life', title: 'House System', eyebrow: 'CAMPUS LIFE', hero: 'hero-houses',
      subtitle: 'A vibrant house structure that cultivates leadership, teamwork, discipline and healthy competition.',
      intro: ['CAMPUS LIFE', 'The House System at SST', 'The House System is an integral part of life at SST, creating smaller, supportive communities within the school. It instils a spirit of belonging, builds leadership and encourages healthy, constructive competition.'],
      c: {
        houses: { items: [{ image: M('crest-lions'), title: 'Lions House', text: 'Courage • Leadership • Service', color: '#c8312c' }, { image: M('crest-eagles'), title: 'Eagles House', text: 'Discipline • Excellence • Integrity', color: '#2563c9' }, { image: M('crest-stags'), title: 'Stags House', text: 'Perseverance • Teamwork • Resilience', color: '#1f8a4c' }, { image: M('crest-sailors'), title: 'Sailors House', text: 'Exploration • Responsibility • Unity', color: '#d9a21b' }] },
        image: img('house-students'),
        works: check('Settings', 'How the House System Works', '', ['All students are placed in one of four houses.', 'Students earn house points through academics, sports, co-curriculars and conduct.', 'House Councils, led by House Captains and Vice-Captains, organise activities and represent their house.', 'Inter-house events are held throughout the year, with an annual House Champion Award.']),
        leadership: grid('UsersRound', 'Leadership & Opportunities', [['Star', 'House Captain & Vice-Captain'], ['UsersRound', 'Student Leadership'], ['CalendarDays', 'Event Organisation'], ['Mic', 'Public Speaking'], ['Users', 'Team Management'], ['HandHeart', 'Community Service']]),
        benefits: benefits('Trophy', 'Key Benefits', [['UsersRound', 'Develop Leadership Skills'], ['Handshake', 'Build Teamwork & Unity'], ['ShieldCheck', 'Show Sportsmanship'], ['Target', 'Stay Motivated'], ['Star', 'Take Ownership'], ['Sprout', 'Grow in Character']], 'The House System helps students to:'),
        sidebarCard: scard('Trophy', 'Inter-House Competitions', 'A year-round platform for student participation, team spirit and excellence.', 'View Competitions', `${NE}/events`),
        banner: banner('“Competition with Respect, Participation with Purpose”', 'Inter-House Spirit at SST', '', 'Trophy', 'Explore House Activities', `${NE}/events`),
      },
    },
    {
      slug: 'campus-life/sports-activities', template: 'sports-activities', section: 'campus-life', title: 'Sports & Activities', eyebrow: 'CAMPUS LIFE', hero: 'hero-sports',
      subtitle: 'A rich and balanced programme of sports and co-curricular activities that builds fitness, teamwork, confidence and leadership.',
      intro: ['CAMPUS LIFE', 'Sports & Activities at SST', 'SST provides excellent sports facilities and a diverse range of co-curricular activities that promote physical fitness, teamwork, creativity, discipline and overall wellbeing.'],
      c: {
        image: img('sports-ground'),
        facilities: grid('Trophy', 'Our Sports Facilities', [['Volleyball', 'Football Ground'], ['Trophy', 'Cricket Ground'], ['Volleyball', 'Basketball Court'], ['Activity', 'Hockey Field'], ['Volleyball', 'Volleyball Court'], ['Footprints', 'Athletics Track'], ['Dumbbell', 'Fitness Gym'], ['Waves', 'Swimming Pool']]),
        programmes: check('UsersRound', 'Activities & Programmes', '', ['Intra- & Inter-House Competitions', 'Inter-School Tournaments', 'Regular Sports Training & Coaching', 'Physical Education Programme', 'Recreational & Outdoor Activities', 'Annual Sports Week']),
        sports: imgCards('Volleyball', 'Major Sports at SST', [['sport-football', 'Football'], ['sport-cricket', 'Cricket'], ['sport-basketball', 'Basketball'], ['sport-hockey', 'Hockey'], ['sport-athletics', 'Athletics'], ['sport-swimming', 'Swimming']]),
        benefits: benefits('Trophy', 'Key Benefits', [['HeartPulse', 'Physical Fitness & Wellbeing'], ['UsersRound', 'Teamwork & Collaboration'], ['Star', 'Discipline & Resilience'], ['ChartColumn', 'Confidence & Leadership'], ['Sprout', 'Balanced Personal Development']]),
        sidebarCard: scard('Footprints', 'Active, Healthy & Confident Learners', 'A wide range of sports and co-curricular activities for the holistic development of every student.', 'Explore Activities', `${CL}/clubs-societies`),
        banner: banner('“Play, Compete, Create and Grow at SST”', 'Get Involved in Sports & Activities', '', 'Trophy', 'View Activities Calendar', `${NE}/events`),
      },
    },
    {
      slug: 'campus-life/student-welfare', template: 'student-welfare', section: 'campus-life', title: 'Student Welfare', eyebrow: 'CAMPUS LIFE',
      subtitle: 'A comprehensive support system that ensures the health, safety, wellbeing and personal development of every student at SST.',
      intro: ['CAMPUS LIFE', 'Student Welfare at SST', 'SST is committed to the overall wellbeing of its students, providing holistic support for their physical health, emotional wellbeing, safety, personal growth and academic success.'],
      c: {
        image: img('welfare-counselling'),
        approach: check('HeartHandshake', 'Our Welfare Approach', 'A proactive and caring framework that nurtures students’ health, safety, emotional wellbeing and personal development.', ['Student-centred and inclusive support', 'Early identification and intervention', 'Professional and confidential services', 'Collaboration with parents and houses']),
        image2: img('welfare-health-centre'),
        services: grid('Layers', 'Student Welfare Services', [['HeartPulse', 'Healthcare', 'On-campus medical care, first aid and health monitoring.'], ['UsersRound', 'Counselling & Wellbeing', 'Professional guidance and emotional support for students.'], ['ShieldCheck', 'Safeguarding & Safety', 'A safe and secure environment with clear child protection measures.'], ['Sprout', 'Personal Development', 'Life skills, character building and responsible citizenship.'], ['BookOpen', 'Academic Support', 'Guidance, mentoring and support for learning needs.'], ['UsersRound', 'Pastoral Care', 'Dedicated house mentors and a caring residential team.']]),
        focus: benefits('Target', 'Key Focus Areas', [['Apple', 'Health & Hygiene'], ['Flower2', 'Mental Wellbeing'], ['UsersRound', 'Safety & Protection'], ['ChartColumn', 'Character & Values'], ['Handshake', 'Inclusion & Respect']]),
        sidebarCard: scard('HandHeart', 'Our Commitment', 'A safe, caring and supportive environment where every student can thrive.', 'Contact Student Welfare', '/contact'),
        banner: banner('“Caring for the Whole Student – Mind, Body and Character”', 'A Supportive School Community', '', 'UsersRound', 'Learn More About Student Support', `${A}/academic-support`),
      },
    },
    {
      slug: 'campus-life/clubs-societies', template: 'clubs', section: 'campus-life', title: 'Clubs & Societies', eyebrow: 'CAMPUS LIFE', hero: 'hero-clubs',
      subtitle: 'A vibrant range of clubs and societies that help students explore interests, develop talents and take on leadership roles.',
      intro: ['CAMPUS LIFE', 'Clubs & Societies at SST', 'SST offers a diverse range of clubs and societies that encourage creativity, critical thinking, collaboration and leadership, helping students discover their passions and realise their potential.'],
      c: {
        image: img('clubs-robotics'),
        categories: grid('UsersRound', 'Our Club Categories', [['Atom', 'STEM & Innovation'], ['Palette', 'Arts & Culture'], ['BookOpen', 'Literary & Debating'], ['UsersRound', 'Leadership & Service'], ['Leaf', 'Environment & Sustainability'], ['Footprints', 'Sports Clubs'], ['Camera', 'Media & Communication'], ['Music', 'Music & Performing Arts'], ['HandHeart', 'Community Service'], ['Globe', 'Global Awareness']]),
        featured: imgCards('Star', 'Featured Clubs & Societies', [['club-robotics', 'Robotics Club'], ['club-debating', 'Debating Society'], ['club-drama', 'Drama Club'], ['club-music', 'Music Club'], ['club-art', 'Art & Design Club'], ['club-environment', 'Environment Club']]),
        benefits: benefits('Trophy', 'Key Benefits', [['Lightbulb', 'Discover New Interests'], ['UsersRound', 'Build Leadership Skills'], ['Handshake', 'Work in Teams'], ['ChartColumn', 'Enhance Creativity'], ['Star', 'Develop Confidence'], ['Leaf', 'Make a Positive Impact']]),
        sidebarCard: scard('UsersRound', 'Beyond the Classroom', 'A platform to explore interests, build new skills and make a positive impact in the school community.', 'Explore Clubs', `${CL}/clubs-societies`),
        banner: banner('“Explore • Create • Lead • Serve”', 'Join a Club or Society at SST', '', 'UsersRound', 'View All Clubs & Societies', `${CL}/clubs-societies`),
      },
    },
    // ───────── About ─────────
    {
      slug: 'about/campus-location', template: 'campus-location', section: 'about', title: 'Campus & Location', eyebrow: 'ABOUT SST',
      subtitle: 'A spacious, green and secure residential campus in Rashidabad, Tando Allahyar, Sindh.',
      intro: ['ABOUT SST', 'Campus & Location', 'Set in a peaceful rural environment, the SST campus offers purpose-built academic, residential and sports facilities in a safe and inspiring setting.'],
      c: {
        strip: strip(['Landmark', '100+ Acres', 'Green campus'], ['School', 'Academic Blocks', 'Classrooms & labs'], ['BedDouble', 'Boarding Houses', 'Residential life'], ['Trophy', 'Sports Grounds', 'Fields & courts'], ['ShieldCheck', 'Secure Campus', '24/7 security']),
        gallery: imgCards('Camera', 'Around the Campus', [['home-hero-campus', 'Main Building'], ['years-gate', 'Campus Gate'], ['sports-ground', 'Sports Grounds'], ['residential-students', 'Boarding Houses'], ['library-reading', 'Library']]),
        location: kv('MapPin', 'Location & Distances', [['MapPin', 'Address', 'Rashidabad, Tando Allahyar, Sindh, Pakistan'], ['Car', 'Hyderabad', 'Approx. 45 km'], ['Plane', 'Karachi Airport', 'Approx. 200 km'], ['Building2', 'Tando Allahyar', 'Approx. 10 km']]),
        highlights: check('Star', 'Campus Highlights', '', ['Purpose-built academic and residential facilities', 'Extensive sports grounds and courts', 'Health centre with on-campus medical care', 'Green, peaceful and secure environment']),
        sidebarCard: scard('Video', 'Virtual Campus Tour', 'Explore our campus, facilities and residential life.', 'Watch Tour', '/news-events/gallery'),
        banner: banner('“A Campus Designed for Learning, Living and Leading”'),
      },
    },
    // ───────── Facilities (SST-designed) ─────────
    {
      slug: 'facilities', template: 'facilities-overview', section: 'facilities', title: 'Facilities', eyebrow: 'FACILITIES',
      subtitle: 'Modern academic, residential, sports and support facilities that enable learning and growth.',
      intro: ['FACILITIES', 'World-Class Facilities', 'SST provides purpose-built facilities across a secure, green campus — supporting academic excellence, residential life, sports, health and wellbeing.'],
      c: {
        strip: strip(['School', 'Academic Blocks'], ['FlaskConical', 'Science & IT Labs'], ['Library', 'Library'], ['Trophy', 'Sports Complex'], ['BedDouble', 'Boarding Houses'], ['Stethoscope', 'Health Centre']),
        cards: cards('', '', [
          { image: 'years-campus', icon: 'School', title: 'Academic Blocks & Labs', text: 'Spacious classrooms and well-equipped science and computer laboratories.', href: `${F}/academic-blocks-labs` },
          { image: 'library-study', icon: 'Library', title: 'Library & ICT', text: 'A rich library collection, digital resources and ICT facilities.', href: `${F}/library-ict` },
          { image: 'sports-ground', icon: 'Trophy', title: 'Sports Complex', text: 'Grounds, courts, a gym and a swimming pool for an active campus.', href: `${F}/sports-complex` },
          { image: 'residential-room', icon: 'BedDouble', title: 'Boarding & Dining', text: 'Comfortable dormitories and a dining hall serving nutritious meals.', href: `${F}/boarding-dining` },
          { image: 'welfare-health-centre', icon: 'Stethoscope', title: 'Health Centre', text: 'On-campus medical care, first aid and health monitoring.', href: `${F}/health-centre` },
        ]),
        band: strip(['ShieldCheck', 'Safe & Secure', '24/7 security and supervision'], ['Sprout', 'Green Campus', 'A peaceful natural setting'], ['Settings', 'Well-Maintained', 'Dedicated facilities team'], ['Users', 'Student-Centred', 'Designed around student needs']),
        sidebarCard: scard('MapPin', 'Visit Our Campus', 'See our facilities in person.', 'Contact Us', '/contact'),
        banner: banner('“Facilities that Inspire Learning and Growth”'),
      },
    },
    ...(
      [
        ['academic-blocks-labs', 'Academic Blocks & Labs', 'School', 'years-campus', 'assessment-exam', [['School', 'Classrooms'], ['FlaskConical', 'Science Labs'], ['Atom', 'Physics Lab'], ['Microscope', 'Biology Lab'], ['Laptop', 'Computer Lab'], ['MonitorPlay', 'Multimedia Rooms']], ['support-remedial', 'support-enrichment', 'library-digital']],
        ['library-ict', 'Library & ICT', 'Library', 'library-study', 'library-reading', [['BookOpen', 'Book Collection'], ['Laptop', 'Digital Library'], ['Wifi', 'Campus Wi-Fi'], ['MonitorPlay', 'Smart Classrooms'], ['Search', 'Research Corner'], ['Users', 'Group Study Rooms']], ['library-lending', 'library-research', 'library-digital']],
        ['sports-complex', 'Sports Complex', 'Trophy', 'sports-ground', 'sport-football', [['Volleyball', 'Football Ground'], ['Trophy', 'Cricket Ground'], ['Volleyball', 'Basketball Court'], ['Footprints', 'Athletics Track'], ['Dumbbell', 'Fitness Gym'], ['Waves', 'Swimming Pool']], ['sport-hockey', 'sport-athletics', 'sport-swimming']],
        ['boarding-dining', 'Boarding & Dining', 'BedDouble', 'residential-room', 'residential-students', [['BedDouble', 'Dormitories'], ['Utensils', 'Dining Hall'], ['BookOpen', 'Study Areas'], ['Shirt', 'Laundry'], ['UsersRound', 'House Mentors'], ['ShieldCheck', '24/7 Security']], ['residential-students', 'house-students', 'campus-card-residential']],
        ['health-centre', 'Health Centre', 'Stethoscope', 'welfare-health-centre', 'welfare-counselling', [['Stethoscope', 'Medical Officer'], ['HeartPulse', 'First Aid'], ['BedDouble', 'Sick Bay'], ['Hospital', 'Hospital Referral'], ['Apple', 'Nutrition Guidance'], ['Brain', 'Counselling']], ['welfare-counselling', 'support-counselling', 'campus-card-welfare']],
      ] as const
    ).map(([slug, title, icon, image, image2, features, gallery]) => ({
      slug: `facilities/${slug}`, template: 'facility', section: 'facilities', title, eyebrow: 'FACILITIES',
      subtitle: `${title} at SST — designed to support learning, wellbeing and growth.`,
      intro: ['FACILITIES', title, `Our ${title.toLowerCase()} provide students with a safe, modern and well-maintained environment. (PLACEHOLDER — facility details to be confirmed by SST.)`] as [string, string, string],
      c: {
        strip: strip([icon, 'Purpose-Built'], ['ShieldCheck', 'Safe & Secure'], ['Settings', 'Well-Maintained'], ['Users', 'Student-Centred']),
        image: img(image),
        about: check(icon, `About the ${title}`, '', ['Designed for student learning and wellbeing', 'Supervised by qualified staff', 'Regularly maintained and upgraded', 'Accessible to all students']),
        features: grid('LayoutGrid', 'Features', features.map(([i, l]) => [i, l] as [string, string])),
        gallery: imgCards('Camera', 'Photos', [[image2, title], ...gallery.map((g, i) => [g, `${title} (${i + 2})`] as [string, string])]),
        benefits: benefits('Star', 'Key Benefits', [['GraduationCap', 'Better Learning'], ['HeartPulse', 'Health & Wellbeing'], ['UsersRound', 'Community'], ['Star', 'Confidence']]),
        sidebarCard: scard('MapPin', 'Visit Our Campus', 'See our facilities in person.', 'Contact Us', '/contact'),
        banner: banner('“Facilities that Inspire Learning and Growth”'),
      },
      hero: undefined,
    })),
    // ───────── News & Events ─────────
    { slug: 'news-events', template: 'news-list', section: 'news-events', title: 'Latest News', eyebrow: 'NEWS & EVENTS', subtitle: 'Stay updated with the latest happenings, activities and important highlights from the SST campus.', intro: ['NEWS & EVENTS', 'Latest News', ''], hero: 'hero-campus-2', c: { sidebarCard: scard('Mail', 'Subscribe for Updates', 'Get the latest news and announcements from SST directly in your inbox.', 'Subscribe', '#subscribe'), banner: banner('“Campus News, Student Stories, Events and Achievements”', 'More from SST', '', 'Newspaper', 'View All News', NE) } },
    { slug: 'news-events/events', template: 'events-list', section: 'news-events', title: 'Events', eyebrow: 'NEWS & EVENTS', subtitle: 'Explore upcoming and past events, school celebrations, competitions and special activities at SST.', intro: ['NEWS & EVENTS', 'Events at SST', ''], hero: 'hero-campus-2', c: { sidebarCard: scard('CalendarDays', 'Stay Informed', 'Never miss an event! Subscribe to receive updates on SST events and activities.', 'Subscribe', '#subscribe'), banner: banner('“Learning, Leading and Celebrating Together at SST”', 'Discover More Events', '', 'CalendarDays', 'View Events Calendar', `${NE}/events?tab=calendar`) } },
    { slug: 'news-events/announcements', template: 'announcements-list', section: 'news-events', title: 'Announcements', eyebrow: 'NEWS & EVENTS', subtitle: 'Official notices, circulars and important updates for students, parents and the SST community.', intro: ['NEWS & EVENTS', 'Announcements', ''], hero: 'hero-campus-2', c: { sidebarCard: scard('Download', 'Quick Downloads', '', 'All Downloads', '/downloads'), banner: banner('“Notices, Circulars and Key Information for Our School Community”', 'Important Updates from SST', '', 'Megaphone', 'View All Announcements', `${NE}/announcements`) } },
    { slug: 'news-events/achievements', template: 'achievements-list', section: 'news-events', title: 'Achievements', eyebrow: 'NEWS & EVENTS', subtitle: 'Celebrating the accomplishments, distinctions and milestones of our students, staff and the SST community.', intro: ['NEWS & EVENTS', 'Achievements at SST', ''], hero: 'hero-campus-2', c: { journeyValue: '500+', journeyLabel: 'Achievements to Date', sidebarCard: scard('Trophy', 'Our Proud Journey', 'A legacy of excellence in academics, sports, co-curricular and character development.', '', ''), banner: banner('“Recognizing Talent, Hard Work and Character”', 'Celebrating Excellence at SST', '', 'Trophy', 'View All Achievements', `${NE}/achievements`) } },
    { slug: 'news-events/gallery', template: 'gallery-list', section: 'news-events', title: 'Gallery', eyebrow: 'NEWS & EVENTS', subtitle: 'A visual journey through campus life at SST — events, activities, celebrations and memorable moments.', intro: ['NEWS & EVENTS', 'Gallery', ''], hero: 'hero-campus-2', c: { sidebarCard: scard('Download', 'Quick Access', '', '', ''), banner: banner('“Moments that Reflect Learning, Leadership and Life at SST”', 'Explore Our Campus Life', '', 'Image', 'View All Albums', `${NE}/gallery`) } },
    // ───────── Standalone ─────────
    {
      slug: 'careers', template: 'careers', section: 'careers', title: 'Careers at SST', eyebrow: 'CAREERS', hero: 'hero-campus-2',
      subtitle: 'Be a part of a purpose-driven educational community committed to excellence, character and holistic student development.',
      intro: ['CAREERS', 'Build a Meaningful Career at SST', 'At Sargodhan Spirit Trust Public School (SST), we believe that exceptional educators and professionals create exceptional learning environments. Join our team to inspire, mentor and make a lasting impact on the lives of our students.'],
      c: {
        strip: strip(['UsersRound', 'Purpose-Driven Work'], ['Sprout', 'Professional Growth'], ['GraduationCap', 'Collaborative Culture'], ['Award', 'Meaningful Impact']),
        why: benefits('', 'Why Work at SST?', [['ShieldCheck', 'Competitive Compensation'], ['HeartPulse', 'Healthcare Support'], ['Library', 'Training & Development'], ['CalendarDays', 'Work–Life Balance'], ['UsersRound', 'Supportive Community'], ['Sprout', 'Values-Based Environment']]),
        join: cards('', '', [{ image: 'careers-team', title: 'Join Our Team', text: 'Be part of a dedicated and values-driven educational institution.', badge: 'Apply Now', href: '/careers#vacancies' }]),
        process: steps('CalendarDays', 'Application Process', [['', 'Explore Openings', 'Browse current vacancies and role details.'], ['', 'Apply Online', 'Submit your application and required documents.'], ['', 'Shortlisting & Assessment', 'Applications are reviewed and shortlisted.'], ['', 'Interview', 'Selected candidates are invited for an interview.'], ['', 'Offer & Onboarding', 'Successful candidates receive an offer and join SST.']]),
        banner: banner('“Nurturing Talent, Building Character, Shaping Futures.”', 'A Rewarding Career in Education', '', 'UsersRound', 'Explore Opportunities', '/careers#vacancies'),
      },
    },
    {
      slug: 'alumni', template: 'alumni', section: 'alumni', title: 'Alumni', eyebrow: 'ALUMNI', hero: 'hero-campus-2',
      subtitle: 'A lifelong community of SST graduates serving Pakistan and the world.',
      intro: ['ALUMNI', 'The SST Alumni Network', 'Our alumni carry the SST spirit into every field — from civil service and medicine to engineering, education and business. Stay connected, share your story and inspire the next generation. (SST-designed page.)'],
      c: {
        strip: strip(['UsersRound', 'Lifelong Community'], ['Briefcase', 'Career Networking'], ['HandHeart', 'Giving Back'], ['CalendarDays', 'Reunions & Events'], ['MessageSquare', 'Mentoring Students']),
        image: img('impact-alumni-monument'),
        network: { icon: 'Users', heading: 'Stay Connected', text: 'Register with the alumni network to receive news, event invitations and opportunities to mentor current students.', items: ['Annual alumni reunion', 'Career talks and mentoring', 'Alumni stories and updates'], ctaLabel: 'Register Now', ctaHref: '/alumni#register' },
        sectors: grid('Briefcase', 'Where Our Alumni Serve', [['Briefcase', 'Civil Service & Governance'], ['Stethoscope', 'Medicine & Healthcare'], ['Settings', 'Engineering & Technology'], ['BookOpen', 'Education & Research'], ['Shield', 'Armed Forces & National Service'], ['Handshake', 'Business & Social Entrepreneurship']]),
        glance: stats('ChartColumn', 'Alumni at a Glance', [['GraduationCap', 'Graduates', '3,500+'], ['Globe', 'Countries', '15+'], ['Users', 'Chapters', '5']]),
        banner: banner('“Once an SSTian, Always an SSTian”', 'Stay Connected', '', 'UsersRound', 'Register as Alumni', '/alumni#register'),
      },
    },
    { slug: 'downloads', template: 'downloads-list', section: 'downloads', title: 'Downloads', eyebrow: 'DOWNLOADS', hero: 'hero-campus-2', subtitle: 'Access important documents, forms, circulars and resources for students, parents and the SST community.', intro: ['DOWNLOADS', 'Downloads', ''], c: { sidebarCard: scard('Headset', 'Need Help?', 'Can’t find the document you’re looking for? Contact us for assistance.', 'Contact Us', '/contact'), banner: banner('“Forms, Circulars, Schedules and More – All in One Place.”', 'Essential Resources at Your Fingertips', '', 'FolderOpen', 'Browse All Downloads', '/downloads') } },
    {
      slug: 'contact', template: 'contact', section: 'contact', title: 'Contact Us', eyebrow: 'CONTACT', hero: 'hero-campus-2',
      subtitle: 'Get in touch with SST for admissions, general inquiries and other information. We are here to help.',
      intro: ['CONTACT', 'Get in Touch', 'We would be happy to hear from you. Please use the details below or send us a message using the contact form.'],
      c: {
        quickLinks: [{ icon: 'Mail', label: 'Admissions Inquiry', href: '/admissions' }, { icon: 'Mail', label: 'General Inquiry', href: '/contact#message' }, { icon: 'Users', label: 'Alumni Relations', href: '/alumni' }, { icon: 'Briefcase', label: 'Careers at SST', href: '/careers' }, { icon: 'UsersRound', label: 'Media & Collaboration', href: '/contact#message' }],
        enquiries: [{ icon: 'Headset', title: 'Admissions Support', text: 'Get guidance on admission process and requirements.' }, { icon: 'UsersRound', title: 'General Enquiries', text: 'Ask about academic, campus life and school services.' }, { icon: 'Handshake', title: 'Partnerships', text: 'For collaborations, visits or institutional partnerships.' }, { icon: 'Info', title: 'Other Requests', text: 'We are here to assist with any additional information.' }],
        inquiryTypes: ['Admissions', 'General', 'Academics', 'Careers', 'Alumni', 'Media & Collaboration', 'Other'],
        banner: banner('“Reach Out, Connect and Be a Part of the SST Community”', 'We’re Here to Help', '', 'MessageSquare', 'Admissions Inquiry', '/admissions'),
      },
    },
  ];

  // Create or convert pages
  let order = 100;
  const heroDefault = null;
  for (const p of pages) {
    const content = { hero: { eyebrow: p.eyebrow }, intro: { eyebrow: p.intro[0], heading: p.intro[1], text: p.intro[2] }, ...(p.c ?? {}) };
    const existing = await prisma.page.findUnique({ where: { slug: p.slug } });
    if (existing && existing.template !== 'standard') continue;
    const data = { template: p.template, section: p.section, title: p.title, subtitle: p.subtitle ?? null, heroImageId: p.hero ? M(p.hero) : heroDefault, content: content as object, sortOrder: ++order };
    const row = existing ? await prisma.page.update({ where: { id: existing.id }, data }) : await prisma.page.create({ data: { slug: p.slug, ...data } });
    await publish(pagesConfig, row.id);
  }

  // ───────── Faculty ─────────
  if ((await prisma.faculty.count()) === 0) {
    const F: [string, string, string, string, string, string][] = [
      ['Ms. Ayesha Khurram', 'Senior Teacher', 'English', 'Languages', '10+ Years', 'faculty-ayesha-khurram-large'],
      ['Dr. Muhammad Farhan', 'Head of Academics', 'Physics', 'Sciences', '15+ Years', 'faculty-muhammad-farhan'],
      ['Ms. Sana Muneer', 'Senior Teacher', 'Mathematics', 'Mathematics', '9+ Years', 'faculty-sana-muneer'],
      ['Mr. Imran Ali', 'Head of Sciences', 'Chemistry', 'Sciences', '14+ Years', 'faculty-imran-ali'],
      ['Mr. Bilal Ahmed', 'Senior Teacher', 'Computer Science', 'Computer Science', '8+ Years', 'faculty-bilal-ahmed'],
      ['Ms. Zara Shah', 'Teacher', 'Biology', 'Sciences', '6+ Years', 'faculty-zara-shah'],
      ['Mr. Faisal Kamran', 'Senior Teacher', 'Islamiyat', 'Humanities', '12+ Years', 'faculty-faisal-kamran'],
      ['Ms. Hina Iqbal', 'Teacher', 'Urdu', 'Languages', '7+ Years', 'faculty-hina-iqbal'],
      ['Mr. Usman Raza', 'Teacher', 'Pakistan Studies', 'Humanities', '5+ Years', 'faculty-usman-raza'],
      ['Ms. Nadia Khan', 'Teacher', 'Art & Design', 'Arts', '6+ Years', 'faculty-nadia-khan'],
      ['Mr. Rehan Siddiqui', 'Senior Teacher', 'Economics', 'Humanities', '11+ Years', 'faculty-rehan-siddiqui'],
      ['Ms. Mahnoor Ali', 'Teacher', 'Physical Education', 'Physical Education', '5+ Years', 'faculty-mahnoor-ali'],
    ];
    let i = 0;
    for (const [fullName, designation, subject, department, experience, photo] of F) {
      const ayesha = i === 0;
      const row = await prisma.faculty.create({
        data: {
          slug: slugify(fullName.replace(/^(Mr|Ms|Mrs|Dr)\.\s*/, '')),
          fullName, designation, subject, department, experience, photoId: M(photo), sortOrder: ++i,
          programmes: ['English', 'Mathematics', 'Chemistry', 'Physics', 'Biology'].includes(subject) ? 'Secondary (IX–X)' : 'Middle (VI–VIII)',
          isFeatured: i <= 5,
          qualification: ayesha ? 'M.A. English (Literature)' : null,
          joinedDate: ayesha ? new Date('2016-08-01') : null,
          about: ayesha ? 'Ms. Ayesha Khurram is a passionate educator with over a decade of experience in teaching English. She is committed to developing strong language skills, critical thinking and a love for literature among her students. Her classroom is known for its engaging, inclusive and student-centred learning environment.' : null,
          qualifications: ayesha ? ['M.A. in English (Literature) – University of Karachi', 'B.Ed. – Allama Iqbal Open University', 'B.A. (Hons.) English – University of Karachi'] : [],
          teachingAreas: ayesha ? ['English Language', 'English Literature', 'Creative Writing', 'Communication Skills'] : [subject],
          interests: ayesha ? ['Literature & Reading', 'Creative Writing', 'Language Pedagogy', 'Student Engagement'] : [],
          development: ayesha ? ['Advanced Pedagogy for English Language Teaching', 'Assessment and Feedback in Language Learning', 'Integrating Technology in English Classrooms', 'Creative Writing and Student Publishing'] : [],
          achievements: ayesha ? ['Led the school Reading Programme for Secondary Section', 'Coordinated the Annual Literary Festival', 'Prepared students for inter-school English competitions', 'Mentored the school magazine editorial team'] : [],
          quote: ayesha ? '“Inspiring Young Minds through the Power of Language”' : null,
        },
      });
      await publish(facultyConfig, row.id);
    }
  }

  // ───────── Examination results ─────────
  if ((await prisma.examResult.count()) === 0) {
    const ach = [['Ayesha Khan', 'achiever-ayesha-khan', 1070, '97.27%'], ['Ali Raza', 'achiever-ali-raza', 1064, '96.73%'], ['Usman Ali', 'achiever-usman-ali', 1060, '96.36%'], ['Zara Siddiqui', 'achiever-zara-siddiqui', 1055, '95.91%'], ['Hina Iqbal', 'achiever-hina-iqbal', 1052, '95.64%'], ['Muhammad Bilal', null, 1048, '95.27%'], ['Fatima Noor', null, 1045, '95.00%'], ['Abdul Rehman', null, 1042, '94.73%'], ['Areeba Fatima', null, 1040, '94.55%'], ['Hamza Mustafa', null, 1038, '94.36%']] as const;
    const r = await prisma.examResult.create({
      data: {
        slug: 'matric-ssc-2025', examination: 'Matric (SSC)', year: 2025, isFeatured: true,
        summary: { aRate: '92%', totalStudents: '120', distinctions: '18', position: 'Top 5', passRate: '100%', topHolders: '5' },
        grades: [{ label: 'A+', range: '85% – 100%', count: 42, percent: '35%' }, { label: 'A', range: '70% – 84%', count: 68, percent: '57%' }, { label: 'B', range: '60% – 69%', count: 8, percent: '7%' }, { label: 'Below B', range: '< 60%', count: 0, percent: '0%' }],
        subjects: [['English', 95, 6, 'BookOpen'], ['Urdu', 93, 0, 'Languages'], ['Mathematics', 90, 5, 'Calculator'], ['Physics', 92, 4, 'Atom'], ['Chemistry', 91, 3, 'FlaskConical'], ['Biology', 94, 0, 'Microscope'], ['Islamiat', 96, 0, 'BookOpen']].map(([name, rate, distinctions, icon]) => ({ name, rate, distinctions, icon })),
        classes: [['X – A', 30, '28 (93%)', '2 (7%)', '0', '100%'], ['X – B', 30, '27 (90%)', '3 (10%)', '0', '100%'], ['X – C', 30, '28 (93%)', '2 (7%)', '0', '100%'], ['X – D', 30, '27 (90%)', '3 (10%)', '0', '100%']].map(([name, total, aPlus, b, belowB, passRate]) => ({ name, total, aPlus, b, belowB, passRate })),
        achievers: ach.map(([name, photo, marks, percentage]) => ({ name, photoId: photo ? M(photo) : null, marks, total: 1100, percentage, grade: 'A+' })),
        documents: [docs.resultsComplete, docs.resultsSummary, docs.subjectAnalysis, docs.topAchievers],
      },
    });
    await publish(resultsConfig, r.id);
  }

  // ───────── Posts ─────────
  const postSeed: { kind: 'NEWS' | 'ANNOUNCEMENT' | 'ACHIEVEMENT'; title: string; date: string; category: string; image?: string; excerpt: string; featured?: boolean; badge?: string; documentId?: string }[] = [
    { kind: 'NEWS', title: 'SST Team Wins Inter-School Science Championship', date: '2026-11-14', category: 'Competitions', image: 'news-trophy', featured: true, excerpt: 'Our students secured the first position at the Inter-School Science Championship, showcasing exceptional innovation, teamwork and problem-solving skills.' },
    { kind: 'NEWS', title: 'Intra-House Football Tournament Kicks Off', date: '2026-11-10', category: 'Sports', image: 'news-football-2', excerpt: 'The annual intra-house football tournament began with spirited matches between all four houses.' },
    { kind: 'NEWS', title: 'Students Excel in National Olympiad', date: '2026-11-08', category: 'Academics', image: 'news-olympiad', excerpt: 'SST students earned top honours at the National Olympiad, competing with schools from across Pakistan.' },
    { kind: 'NEWS', title: 'Guest Lecture on Leadership and Character', date: '2026-11-05', category: 'Visits & Talks', image: 'news-lecture', excerpt: 'A distinguished guest speaker addressed students on leadership, integrity and service.' },
    { kind: 'NEWS', title: 'Tree Plantation Drive for a Greener Campus', date: '2026-11-01', category: 'Campus Life', image: 'news-plantation', excerpt: 'Students and staff planted hundreds of saplings as part of the campus greening initiative.' },
    { kind: 'NEWS', title: 'Science Week Showcases Student Innovation', date: '2026-10-28', category: 'Academics', image: 'news-science-week', excerpt: 'Projects, experiments and models filled the science block during the annual Science Week.' },
    { kind: 'NEWS', title: 'Cultural Evening Celebrates SST’s Heritage and Talent', date: '2026-10-24', category: 'Co-Curricular', image: 'news-cultural', excerpt: 'An evening of music, drama and regional performances celebrated the diversity of the SST community.' },
    { kind: 'ANNOUNCEMENT', title: 'Winter Vacation Schedule 2026', date: '2026-11-18', category: 'General', featured: true, documentId: docs.winterVacation, excerpt: 'The school will remain closed for winter vacation from 22 December 2026 to 04 January 2027. Classes will resume on 05 January 2027.' },
    { kind: 'ANNOUNCEMENT', title: 'Final Examination Schedule – Term I', date: '2026-11-15', category: 'Examinations', excerpt: 'The detailed date sheet for Final Examinations (Term I) has been issued. Students are advised to check the schedule and instructions.' },
    { kind: 'ANNOUNCEMENT', title: 'Admissions for Session 2027–28', date: '2026-11-12', category: 'Admissions', documentId: docs.admissionForm, excerpt: 'Admissions are now open for new students. Apply online or visit the Admissions Office for details on eligibility and process.' },
    { kind: 'ANNOUNCEMENT', title: 'Parent–Teacher Meeting (PTM)', date: '2026-11-10', category: 'Academic', excerpt: 'A Parent–Teacher Meeting will be held on Saturday, 29 November 2026, from 9:00 a.m. to 1:00 p.m. in respective houses.' },
    { kind: 'ANNOUNCEMENT', title: 'School Uniform – Important Notice', date: '2026-11-08', category: 'Circulars', documentId: docs.uniform, excerpt: 'All students are reminded to wear the prescribed school uniform from Monday, 24 November 2026.' },
    { kind: 'ACHIEVEMENT', title: 'SST Team Wins National Science Olympiad 2026', date: '2026-11-08', category: 'Academic', image: 'achv-olympiad', featured: true, badge: '1st Position', excerpt: 'Our students secured 1st Position at the National Science Olympiad, competing with top schools across Pakistan.' },
    { kind: 'ACHIEVEMENT', title: 'Gold Medal in National Maths Competition', date: '2026-11-05', category: 'Academic', image: 'achv-maths', excerpt: 'An SST student won the gold medal at the National Mathematics Competition.' },
    { kind: 'ACHIEVEMENT', title: 'Inter-School Football Tournament – Champions', date: '2026-11-02', category: 'Sports', image: 'achv-football', excerpt: 'The SST football team lifted the inter-school championship trophy.' },
    { kind: 'ACHIEVEMENT', title: 'Best Debating Team Award', date: '2026-10-28', category: 'Co-Curricular', image: 'achv-debating', excerpt: 'Our debaters were named the best team at the inter-school debating championship.' },
    { kind: 'ACHIEVEMENT', title: '1st Position in Inter-School Cultural Festival', date: '2026-10-24', category: 'Competitions', image: 'achv-cultural', excerpt: 'SST performers won first position at the inter-school cultural festival.' },
    { kind: 'ACHIEVEMENT', title: 'Innovation Award at Science Fair', date: '2026-10-20', category: 'Academic', image: 'achv-innovation', excerpt: 'A student project received the innovation award at the regional science fair.' },
    { kind: 'ACHIEVEMENT', title: 'Best Cadet Unit – Annual Cadet Competition', date: '2026-10-15', category: 'Institutional', image: 'achv-cadet', excerpt: 'SST was declared the best cadet unit at the annual cadet competition.' },
    { kind: 'ACHIEVEMENT', title: 'Excellence in Arts Competition', date: '2026-10-10', category: 'Co-Curricular', image: 'achv-arts', excerpt: 'SST artists were recognised for excellence at the inter-school arts competition.' },
    { kind: 'ACHIEVEMENT', title: 'Gold Medal in Inter-School Swimming Championship', date: '2026-10-06', category: 'Sports', image: 'achv-swimming', excerpt: 'An SST swimmer won gold at the inter-school swimming championship.' },
  ];
  for (const p of postSeed) {
    const slug = slugify(p.title);
    if (await prisma.post.findUnique({ where: { slug } })) continue;
    const row = await prisma.post.create({
      data: { kind: p.kind, slug, title: p.title, category: p.category, excerpt: p.excerpt, body: `<p>${p.excerpt}</p><p>(PLACEHOLDER — full article to be added.)</p>`, featuredImageId: p.image ? M(p.image) : null, publicationDate: new Date(`${p.date}T09:00:00+05:00`), isFeatured: !!p.featured, badge: p.badge ?? null, documentId: p.documentId ?? null },
    });
    await publish(postsConfig, row.id);
  }
  // categorise the v1 news items
  await prisma.post.updateMany({ where: { category: 'Achievements', kind: 'NEWS' }, data: { category: 'Competitions' } });

  // ───────── Events ─────────
  const eventSeed: [string, string, string | null, string, string, string, boolean?][] = [
    ['Annual Sports Week 2026', '2026-11-28', '2026-12-02', 'SST Main Campus', 'Sports', 'event-sports-week', true],
    ['Inter-House Debate Final', '2026-11-22', null, 'Auditorium', 'Co-Curricular', 'event-debate'],
    ['Science Exhibition', '2026-12-05', null, 'Science Block', 'Academics', 'event-exhibition'],
    ["Founders' Day Celebration", '2026-12-10', null, 'School Grounds', 'Special', 'event-founders'],
    ['Cultural Evening', '2026-12-24', null, 'Auditorium', 'Cultural', 'event-cultural'],
    ['Intra-House Football Tournament', '2026-11-10', null, 'Football Ground', 'Sports', 'event-football'],
    ['National Olympiad Award Ceremony', '2026-11-08', null, 'Auditorium', 'Competitions', 'event-olympiad'],
    ['Tree Plantation Drive', '2026-11-01', null, 'School Campus', 'Special', 'event-plantation'],
    ['Leadership & Character Talk', '2026-11-05', null, 'Auditorium', 'Academics', 'event-talk'],
  ];
  for (const [title, start, end, location, category, image, featured] of eventSeed) {
    const slug = slugify(title);
    if (await prisma.event.findUnique({ where: { slug } })) continue;
    const excerpt = title === 'Annual Sports Week 2026' ? 'A week-long celebration of sportsmanship, fitness and teamwork, featuring inter-house competitions across multiple sports.' : `${title} at ${location}.`;
    const row = await prisma.event.create({ data: { slug, title, category, location, excerpt, body: `<p>${excerpt}</p><p>(PLACEHOLDER — event programme to be added.)</p>`, featuredImageId: M(image), startDate: new Date(`${start}T09:00:00+05:00`), endDate: end ? new Date(`${end}T17:00:00+05:00`) : null, isFeatured: !!featured } });
    await publish(eventsConfig, row.id);
  }

  // ───────── Galleries ─────────
  const albums: [string, string, string, string[], boolean?][] = [
    ['Annual Sports Week 2026', 'sports', '2026-11-24', ['album-featured', 'event-sports-week', 'sport-athletics', 'sport-football', 'sport-hockey'], true],
    ['Science Exhibition 2026', 'academic', '2026-12-05', ['album-science', 'news-science-week']],
    ['Inter-House Football Tournament', 'sports', '2026-11-10', ['album-football', 'news-football-2']],
    ['Cultural Evening 2026', 'cultural', '2026-10-24', ['album-cultural', 'news-cultural']],
    ['Leadership & Character Talk', 'events', '2026-10-28', ['album-lecture', 'news-lecture']],
    ['Tree Plantation Drive', 'campus-life', '2026-11-01', ['album-plantation', 'news-plantation']],
    ['National Olympiad Award Ceremony', 'academic', '2026-11-08', ['album-olympiad', 'news-olympiad']],
    ['Guest Lecture Series', 'events', '2026-11-05', ['album-guest']],
    ['Cadet Unit – Annual Competition', 'co-curricular', '2026-10-15', ['album-cadet', 'achv-cadet']],
  ];
  let go = 10;
  for (const [title, category, date, images, featured] of albums) {
    const slug = slugify(title);
    if (await prisma.gallery.findUnique({ where: { slug } })) continue;
    await prisma.gallery.create({
      data: {
        slug, title, category, eventDate: new Date(date), isPublished: true, isFeatured: !!featured, sortOrder: ++go, coverImageId: M(images[0]!),
        description: featured ? 'Highlights from SST’s Annual Sports Week, featuring intra-house competitions, team events and the closing ceremony.' : 'PLACEHOLDER album — official photographs to be added.',
        videos: featured ? [{ title: 'SST Campus Life – A Glimpse', url: '', thumbnailId: M('video-campus'), duration: '03:42' }] : [],
        images: { create: images.map((n, i) => ({ mediaId: M(n), sortOrder: i })) },
      },
    });
  }

  // ───────── Vacancies ─────────
  if ((await prisma.vacancy.count()) === 0) {
    for (const [title, department, closing] of [['Middle School Science Teacher', 'Academic Department', '2026-12-05'], ['ICT Coordinator', 'Academic Department', '2026-12-08'], ['Senior Admin Officer', 'Administration Department', '2026-12-10']]) {
      const row = await prisma.vacancy.create({
        data: { slug: slugify(title), title: title!, department, location: 'Rashidabad', jobType: 'Full-Time', closingDate: new Date(closing!), summary: `SST is seeking a ${title} to join our team. (PLACEHOLDER vacancy.)`, body: '<h3>Responsibilities</h3><ul><li>To be confirmed by HR</li></ul><h3>Requirements</h3><ul><li>To be confirmed by HR</li></ul>' },
      });
      await publish(vacanciesConfig, row.id);
    }
  }

  // ───────── FAQs ─────────
  if ((await prisma.faq.count()) === 0) {
    const faqs: [string, string, string][] = [
      ['application', 'How can I apply for admission at SST?', 'You can apply online through the SST website by completing the admission application form. After submission, please upload the required documents and follow the next steps, including assessment and interview (as applicable).'],
      ['application', 'When do admissions open?', 'Applications for Academic Year 2026 – 2027 open on 01 February 2026. See Important Dates for the full schedule.'],
      ['application', 'Can I apply after the deadline?', 'Late applications may be considered subject to seat availability. Please contact the Admissions Office.'],
      ['application', 'When will the admission decision be communicated?', 'Admission decisions are communicated via email or SMS on 15 March 2026.'],
      ['eligibility', 'What are the age requirements for each grade?', 'Pre-Primary (KG): 3 – 5 years; Primary (I – V): 6 – 10 years; Middle (VI – VIII): 11 – 13 years; Secondary (IX – X): 14 – 16 years (as on 31 March 2026).'],
      ['eligibility', 'Is there an entrance assessment for admission?', 'Yes. Students applying for Grade I and above take a written assessment, and an interview is held with the student and parent/guardian.'],
      ['eligibility', 'Which subjects are covered in the assessment?', 'The written test covers English, Mathematics, Urdu and Science for Grade VI and above.'],
      ['eligibility', 'Does meeting the criteria guarantee admission?', 'No. Admission is subject to assessment performance and seat availability, and is at the discretion of the school management.'],
      ['documents', 'What documents are required for the application?', 'The application form, birth certificate / B-Form, previous school report, transfer certificate (if applicable), two photographs and a copy of the parent/guardian CNIC.'],
      ['documents', 'Do documents need to be attested?', 'Yes, where applicable. Original documents may be required at the time of verification.'],
      ['documents', 'Is a medical certificate required?', 'A health / fitness certificate may be required as per school requirements.'],
      ['fees', 'What is the fee structure for the academic year 2026 – 2027?', 'Please see the Fees & Scholarships page for the indicative fee structure by grade level.'],
      ['fees', 'How can fees be paid?', 'By online bank transfer, cash deposit at designated bank branches, or through the school office.'],
      ['fees', 'Is the admission fee refundable?', 'No. The admission fee is a one-time, non-refundable and non-transferable fee.'],
      ['fees', 'Are there sibling concessions?', 'Yes. A tuition fee concession is available for two or more siblings enrolled at SST.'],
      ['scholarships', 'Are scholarships available at SST?', 'Yes. SST offers merit scholarships, need-based support, talent scholarships and sibling concessions.'],
      ['scholarships', 'How are scholarships awarded?', 'Scholarships are granted after due evaluation and are subject to annual review.'],
      ['scholarships', 'How do I apply for financial support?', 'Indicate your interest in the application form; the Admissions Office will share the scholarship policy and process.'],
      ['other', 'Is SST a boarding school?', 'Yes. SST is a residential school offering a structured and supportive boarding programme.'],
      ['other', 'Can parents visit the campus?', 'Yes. Please contact the school to schedule a visit.'],
      ['other', 'What co-curricular activities are offered?', 'Sports, clubs and societies, the house system, cultural events and community service.'],
      ['other', 'Is transport provided?', 'Please contact the Admissions Office for information about travel arrangements.'],
      ['other', 'What is the medium of instruction?', 'English is the medium of instruction, with Urdu taught as a subject.'],
      ['other', 'How can I contact the Admissions Office?', 'Email info@sst.edu.pk or call +92-22-3890061-4.'],
    ];
    await prisma.faq.createMany({ data: faqs.map(([category, question, answer], i) => ({ category, question, answer, sortOrder: i + 1 })) });
  }
}

/** Main menu tree (three levels). Each section's children also form its sidebar. */
export async function seedNavigationV2(prisma: PrismaClient) {
  type N = { label: string; href: string; icon?: string; soon?: boolean; children?: N[] };
  const LG = '/about/leadership-governance';
  const A = '/academics';
  const AA = `${A}/academic-achievements`;
  const main: N[] = [
    { label: 'Home', href: '/' },
    {
      label: 'About', href: '/about', children: [
        { label: 'About the School', href: '/about', icon: 'Landmark' },
        { label: 'History & Heritage', href: '/about/history-heritage', icon: 'BookOpen' },
        { label: 'Vision, Mission & Values', href: '/about/vision-mission-values', icon: 'Target' },
        { label: 'Leadership & Governance', href: LG, icon: 'Users', children: [
          { label: "Chairman's Message", href: `${LG}/chairmans-message` },
          { label: "Principal's Message", href: `${LG}/principals-message` },
          { label: 'Board of Trustees', href: `${LG}/board-of-trustees` },
          { label: 'Executive Committee', href: `${LG}/executive-committee` },
          { label: 'School Administration', href: `${LG}/school-administration` },
          { label: 'Governance Framework', href: `${LG}/governance-framework` },
        ] },
        { label: 'Why Choose SST', href: '/about/why-choose-sst', icon: 'Award' },
        { label: 'Our Impact', href: '/about/our-impact', icon: 'HandHeart' },
        { label: 'Campus & Location', href: '/about/campus-location', icon: 'MapPin' },
      ],
    },
    {
      label: 'Academics', href: A, children: [
        { label: 'Academics Overview', href: A, icon: 'GraduationCap' },
        { label: 'Academic Programmes', href: `${A}/programmes`, icon: 'BookOpen', children: [
          { label: 'Middle School', href: `${A}/programmes/middle-school` },
          { label: 'Secondary School', href: `${A}/programmes/secondary-school` },
          { label: 'Higher Secondary', href: `${A}/programmes/higher-secondary` },
        ] },
        { label: 'Curriculum', href: `${A}/curriculum`, icon: 'ChartColumn' },
        { label: 'Teaching & Learning', href: `${A}/teaching-learning`, icon: 'Presentation' },
        { label: 'Academic Calendar', href: `${A}/academic-calendar`, icon: 'CalendarCheck' },
        { label: 'Assessment & Reporting', href: `${A}/assessment-reporting`, icon: 'School' },
        { label: 'Academic Support', href: `${A}/academic-support`, icon: 'Award' },
        { label: 'Libraries & Resources', href: `${A}/libraries-resources`, icon: 'Library' },
        { label: 'Faculty', href: `${A}/faculty`, icon: 'UsersRound', children: [{ label: 'Faculty Directory', href: `${A}/faculty/directory` }] },
        { label: 'Academic Achievements', href: AA, icon: 'Trophy', children: [
          { label: 'Overview', href: AA },
          { label: 'Board Results', href: `${AA}/board-results` },
          { label: 'Detailed Results', href: `${AA}/detailed-results` },
          { label: 'National Achievements', href: `${AA}/national-achievements` },
          { label: 'International Achievements', href: `${AA}/international-achievements` },
          { label: 'Subject Excellence', href: `${AA}/subject-excellence` },
          { label: 'High Achievers', href: `${AA}/high-achievers` },
          { label: 'Year-wise Highlights', href: `${AA}/year-wise-highlights` },
        ] },
      ],
    },
    {
      label: 'Admissions', href: '/admissions', children: [
        { label: 'Admissions Overview', href: '/admissions', icon: 'GraduationCap' },
        { label: 'Eligibility Criteria', href: '/admissions/eligibility-criteria', icon: 'BookOpen' },
        { label: 'Admission Process', href: '/admissions/admission-process', icon: 'FilePen' },
        { label: 'Grade Levels', href: '/admissions/grade-levels', icon: 'GraduationCap' },
        { label: 'Important Dates', href: '/admissions/important-dates', icon: 'CalendarCheck' },
        { label: 'Required Documents', href: '/admissions/required-documents', icon: 'Award' },
        { label: 'Fees & Scholarships', href: '/admissions/fees-scholarships', icon: 'FileText' },
        { label: 'FAQs', href: '/admissions/faqs', icon: 'CircleHelp' },
        { label: 'Apply Online', href: '/admissions/apply-online', icon: 'FilePen', soon: true },
      ],
    },
    {
      label: 'Campus Life', href: '/campus-life', icon: 'Landmark', children: [
        { label: 'Overview', href: '/campus-life', icon: 'BedDouble' },
        { label: 'Residential Life', href: '/campus-life/residential-life', icon: 'BedDouble' },
        { label: 'House System', href: '/campus-life/house-system', icon: 'Shield' },
        { label: 'Sports & Activities', href: '/campus-life/sports-activities', icon: 'Trophy' },
        { label: 'Student Welfare', href: '/campus-life/student-welfare', icon: 'HandHeart' },
        { label: 'Clubs & Societies', href: '/campus-life/clubs-societies', icon: 'UsersRound' },
      ],
    },
    {
      label: 'Facilities', href: '/facilities', icon: 'Building2', children: [
        { label: 'Overview', href: '/facilities', icon: 'Building2' },
        { label: 'Academic Blocks & Labs', href: '/facilities/academic-blocks-labs', icon: 'FlaskConical' },
        { label: 'Library & ICT', href: '/facilities/library-ict', icon: 'Library' },
        { label: 'Sports Complex', href: '/facilities/sports-complex', icon: 'Trophy' },
        { label: 'Boarding & Dining', href: '/facilities/boarding-dining', icon: 'BedDouble' },
        { label: 'Health Centre', href: '/facilities/health-centre', icon: 'Stethoscope' },
      ],
    },
    {
      label: 'News & Events', href: '/news-events', icon: 'CalendarDays', children: [
        { label: 'Latest News', href: '/news-events', icon: 'Newspaper' },
        { label: 'Events', href: '/news-events/events', icon: 'CalendarDays' },
        { label: 'Announcements', href: '/news-events/announcements', icon: 'Megaphone' },
        { label: 'Achievements', href: '/news-events/achievements', icon: 'Trophy' },
        { label: 'Gallery', href: '/news-events/gallery', icon: 'Image' },
      ],
    },
    { label: 'Contact', href: '/contact' },
  ];
  await prisma.navigationItem.deleteMany({ where: { menu: { in: ['MAIN', 'ABOUT_SIDEBAR'] } } });
  const create = async (items: N[], parentId: string | null) => {
    let order = 0;
    for (const n of items) {
      const row = await prisma.navigationItem.create({ data: { menu: 'MAIN', label: n.label, href: n.href, icon: n.icon, isComingSoon: !!n.soon, sortOrder: ++order, parentId } });
      if (n.children) await create(n.children, row.id);
    }
  };
  await create(main, null);
}

export const _unused = { existsSync, t3 };
