import { B, R, layoutFields, type PageLayout } from './blocks';
import { text, link } from './fields';
import type { PageTemplate } from './templates';

/**
 * Composed page templates. Layouts follow the approved designs; templates marked
 * "SST-designed" were designed by the development team in the same visual language
 * because no approved design was supplied yet.
 */
const T = (key: string, name: string, layout: PageLayout, notes?: string, extraFields = [] as PageTemplate['fields']): PageTemplate => ({
  key,
  name,
  notes,
  layout,
  fields: [...layoutFields(layout), ...extraFields],
});
const W2 = '1fr 1fr';
const W3 = '1fr 1fr 1fr';

export const COMPOSED_TEMPLATES: PageTemplate[] = [
  // ───────────── Academics ─────────────
  T('academics-overview', 'Academics overview', {
    sidebar: true,
    introAside: B('photo', 'image', 'Intro photo'),
    main: [B('strip', 'strip', 'Feature strip'), R('1fr 1.1fr', B('image', 'image', 'Photo'), B('approach', 'checklist', 'Our academic approach')), B('programmes', 'cards', 'Academic programmes', 'programme'), B('highlights', 'benefits', 'Academic highlights', 'inline')],
  }),
  T('academic-programmes', 'Academic programmes', {
    sidebar: true,
    introAside: B('photo', 'image', 'Intro photo'),
    main: [B('strip', 'strip', 'Feature strip'), B('programmes', 'cards', 'Programme cards', 'programme'), B('cta', 'cta', 'Call to action')],
  }),
  T('programme-detail', 'Programme details', {
    sidebar: true,
    introAside: B('photo', 'image', 'Intro photo'),
    main: [B('glance', 'strip', 'At a glance'), R(W2, B('objectives', 'checklist', 'Programme objectives'), B('subjects', 'table', 'Curriculum & subjects')), B('cta', 'cta', 'Call to action')],
    aside: [B('facts', 'keyValues', 'Key information'), B('downloads', 'downloads', 'Downloads')],
    asideWidth: '320px',
  }),
  T('curriculum', 'Curriculum', {
    sidebar: true,
    introAside: B('photo', 'image', 'Intro photo'),
    main: [B('strip', 'strip', 'Curriculum approach'), R('1.3fr 1fr', B('stages', 'table', 'Curriculum by stage'), B('framework', 'checklist', 'Subject framework'))],
    aside: [B('downloads', 'downloads', 'Curriculum documents')],
    asideWidth: '320px',
  }),
  T('teaching-learning', 'Teaching & learning', {
    sidebar: true,
    main: [B('strip', 'strip', 'Feature strip'), R('1fr 1.1fr', B('image', 'image', 'Photo'), B('methodology', 'checklist', 'Teaching methodology')), B('gallery', 'imageCards', 'Learning in action')],
    aside: [B('focus', 'checklist', 'Key focus areas'), B('resources', 'iconGrid', 'Learning resources')],
    asideWidth: '340px',
  }),
  T('academic-calendar', 'Academic calendar', {
    sidebar: true,
    introAside: B('photo', 'image', 'Intro photo'),
    main: [B('strip', 'strip', 'Year at a glance'), B('terms', 'table', 'Term-wise schedule')],
    aside: [B('dates', 'keyValues', 'Key academic dates')],
    asideWidth: '420px',
    full: [R('1fr 280px', B('events', 'steps', 'Important events', 'inline'), B('downloads', 'downloads', 'Download calendar', 'button'))],
  }),
  T('assessment-reporting', 'Assessment & reporting', {
    sidebar: true,
    introAside: B('photo', 'image', 'Intro photo'),
    main: [B('strip', 'strip', 'Feature strip'), R(W2, B('framework', 'detailList', 'Assessment framework'), B('reporting', 'checklist', 'Reporting to parents')), R('1.2fr 1fr', B('schedule', 'table', 'Assessment schedule'), B('downloads', 'downloads', 'Policies & resources'))],
    aside: [B('grading', 'table', 'Grading system')],
    asideWidth: '250px',
  }),
  T('academic-support', 'Academic support / libraries', {
    sidebar: true,
    main: [B('strip', 'strip', 'Feature strip'), R('1fr 1fr', B('image', 'image', 'Photo'), B('approach', 'checklist', 'Approach')), B('programmes', 'imageCards', 'Programme cards')],
    aside: [B('services', 'checklist', 'Key services'), B('downloads', 'downloads', 'Documents & links')],
    asideWidth: '370px',
  }),
  T('faculty-overview', 'Faculty', {
    sidebar: true,
    main: [B('strip', 'strip', 'Feature strip'), R('1fr 1fr', B('image', 'image', 'Photo'), B('team', 'checklist', 'Our teaching team'))],
    aside: [B('glance', 'stats', 'Faculty at a glance'), B('development', 'checklist', 'Professional development')],
    asideWidth: '360px',
    dynamic: 'faculty-featured',
  }, 'Featured teachers come from Academics → Faculty (items marked Featured).'),
  T('faculty-directory', 'Faculty directory', { sidebar: true, main: [], dynamic: 'faculty-directory' }, 'The directory lists all published faculty members.'),
  T('academic-achievements', 'Academic achievements', {
    sidebar: true,
    main: [B('strip', 'strip', 'Feature strip'), R('1fr 1fr', B('image', 'image', 'Photo'), B('journey', 'checklist', 'Our achievement journey'))],
    aside: [B('glance', 'stats', 'At a glance')],
    asideWidth: '360px',
    dynamic: 'results-summary',
  }, 'The results strip and high achievers come from Academics → Examination Results (latest published).'),
  T('results-detailed', 'Detailed results', { sidebar: true, main: [], dynamic: 'results-detailed' }, 'Data comes from Academics → Examination Results.'),
  T('results-achievers', 'High achievers', { sidebar: true, main: [], dynamic: 'results-achievers' }, 'Data comes from Academics → Examination Results.'),
  T('results-board', 'Board results (SST-designed)', { sidebar: true, main: [B('strip', 'strip', 'Feature strip')], dynamic: 'results-list' }, 'Lists every published examination result.'),
  T('achievement-category', 'Achievements by category (SST-designed)', { sidebar: true, main: [B('strip', 'strip', 'Feature strip')], dynamic: 'achievement-list' }, 'Lists achievements (News & Events → Achievements) in the category below.', [text('achievementCategory', 'Achievement category', { help: 'Category name, e.g. Academic' })]),
  T('subject-excellence', 'Subject excellence (SST-designed)', {
    sidebar: true,
    main: [B('strip', 'strip', 'Feature strip'), B('subjects', 'iconGrid', 'Subject distinctions'), B('table', 'table', 'Distinctions by year')],
    aside: [B('glance', 'stats', 'At a glance')],
    asideWidth: '320px',
  }),
  T('year-highlights', 'Year-wise highlights (SST-designed)', { sidebar: true, main: [B('timeline', 'steps', 'Highlights by year', 'timeline')], aside: [B('glance', 'stats', 'At a glance')], asideWidth: '320px' }),

  // ───────────── Admissions ─────────────
  T('admissions-overview', 'Admissions overview', {
    sidebar: true,
    introAside: B('photo', 'image', 'Intro photo'),
    main: [B('strip', 'strip', 'Feature strip')],
    full: [B('journey', 'steps', 'The admission journey', 'circles'), R(W3, B('eligibility', 'keyValues', 'Eligibility summary'), B('dates', 'keyValues', 'Important dates summary'), B('documents', 'checklist', 'Required documents summary', 'cta'))],
  }),
  T('eligibility', 'Eligibility criteria', {
    sidebar: true,
    main: [B('strip', 'strip', 'Requirement strip'), R('1.55fr 1fr', B('grades', 'table', 'Grade-wise eligibility'), B('conditions', 'checklist', 'General conditions')), R(W3, B('assessment', 'checklist', 'Assessment details'), B('considerations', 'checklist', 'Admission considerations'), B('note', 'note', 'Important note'))],
  }),
  T('admission-process', 'Admission process', {
    sidebar: true,
    main: [B('steps', 'steps', 'Process steps', 'numbered'), R('1.25fr 1fr', B('details', 'detailList', 'Step-by-step details', 'numbered'), [B('timeline', 'keyValues', 'Process timeline'), B('notes', 'note', 'Important notes')]), B('actions', 'links', 'Action buttons')],
  }),
  T('grade-levels', 'Grade levels', {
    sidebar: true,
    introAside: B('art', 'illustration', 'Illustration'),
    main: [B('levels', 'gradeCards', 'Grade level cards'), R('1.55fr 1fr', B('details', 'table', 'Grade-wise details'), [B('progression', 'progression', 'Academic progression'), B('benefits', 'checklist', 'Key benefits')]), B('cta', 'cta', 'Ready to begin')],
  }),
  T('important-dates', 'Important dates', {
    sidebar: true,
    introAside: B('art', 'illustration', 'Illustration'),
    main: [B('timeline', 'steps', 'Date timeline', 'dates'), R('1.6fr 1fr', B('schedule', 'table', 'Detailed schedule'), [B('notes', 'note', 'Important notes'), B('downloads', 'downloads', 'Downloads')])],
  }, 'The "Add to my calendar" button is generated automatically from the schedule table.'),
  T('required-documents', 'Required documents', {
    sidebar: true,
    introAside: B('art', 'illustration', 'Illustration'),
    main: [B('strip', 'strip', 'Document types'), R('1.5fr 1fr', B('checklist', 'table', 'Document checklist'), B('grades', 'table', 'Grade-wise requirements', 'grouped')), R('2fr 1fr', B('notes', 'note', 'Important notes', 'inline'), B('downloads', 'downloads', 'Downloads'))],
  }),
  T('fees', 'Fees & scholarships', {
    sidebar: true,
    main: [B('strip', 'strip', 'Feature strip'), R('1.05fr 1fr', B('fees', 'table', 'Fee structure'), B('scholarships', 'detailList', 'Scholarships & financial support')), R('1.2fr 1fr 0.8fr', B('payment', 'detailList', 'Payment & other details'), B('notes', 'note', 'Important notes'), B('downloads', 'downloads', 'Downloads'))],
  }),
  T('faqs', 'FAQs', { sidebar: true, main: [], dynamic: 'faqs' }, 'Questions are managed under Admissions → FAQs.', [text('contactHeading', '"Still have a question?" heading'), text('contactText', 'Text'), link('visitHref', '"Schedule a call / visit" link')]),

  // ───────────── Campus life ─────────────
  T('campus-overview', 'Campus life overview', {
    sidebar: true,
    main: [B('cards', 'cards', 'Campus life cards', 'campus'), B('band', 'strip', 'Values band', 'band')],
    full: [B('cta', 'cta', 'Discover banner', 'wide')],
  }),
  T('residential-life', 'Residential life', {
    sidebar: true,
    main: [R('1.5fr 1.1fr 1fr', B('image', 'image', 'Photo'), B('home', 'checklist', 'A home away from home'), B('image2', 'image', 'Second photo')), R('1fr 1.2fr', B('facilities', 'iconGrid', 'Residential facilities', 'tiles'), B('routine', 'routine', 'Daily routine')), B('benefits', 'benefits', 'Key benefits')],
  }),
  T('house-system', 'House system', {
    sidebar: true,
    main: [B('houses', 'houses', 'Houses'), R('1fr 1.1fr 1fr', B('image', 'image', 'Photo'), B('works', 'checklist', 'How the house system works'), B('leadership', 'iconGrid', 'Leadership & opportunities', 'compact')), B('benefits', 'benefits', 'Key benefits', 'inline')],
  }),
  T('sports-activities', 'Sports & activities', {
    sidebar: true,
    main: [R('1.15fr 1.2fr 0.9fr', B('image', 'image', 'Photo'), B('facilities', 'iconGrid', 'Sports facilities', 'compact'), B('programmes', 'checklist', 'Activities & programmes')), B('sports', 'imageCards', 'Major sports', 'overlay'), B('benefits', 'benefits', 'Key benefits', 'inline')],
  }),
  T('student-welfare', 'Student welfare', {
    sidebar: true,
    main: [R('1.3fr 1.1fr 0.95fr', B('image', 'image', 'Photo'), B('approach', 'checklist', 'Welfare approach'), B('image2', 'image', 'Second photo')), B('services', 'iconGrid', 'Welfare services', 'columns'), B('focus', 'benefits', 'Key focus areas', 'inline')],
  }),
  T('clubs', 'Clubs & societies', {
    sidebar: true,
    main: [R('1fr 1.5fr', B('image', 'image', 'Photo'), B('categories', 'iconGrid', 'Club categories', 'compact')), B('featured', 'imageCards', 'Featured clubs', 'overlay'), B('benefits', 'benefits', 'Key benefits', 'inline')],
  }),

  // ───────────── About ─────────────
  T('campus-location', 'Campus & location', {
    sidebar: true,
    main: [B('strip', 'strip', 'Feature strip'), B('gallery', 'imageCards', 'Campus photos', 'gallery'), R('1fr 1fr', B('location', 'keyValues', 'Location & distances'), B('highlights', 'checklist', 'Campus highlights'))],
    dynamic: 'map',
  }, 'The map uses the map link from Contact Information.'),

  // ───────────── Facilities (SST-designed) ─────────────
  T('facilities-overview', 'Facilities overview (SST-designed)', {
    sidebar: true,
    main: [B('strip', 'strip', 'Feature strip'), B('cards', 'cards', 'Facility cards', 'campus'), B('band', 'strip', 'Values band', 'band')],
  }),
  T('facility', 'Facility page (SST-designed)', {
    sidebar: true,
    main: [B('strip', 'strip', 'Feature strip'), R('1.2fr 1fr', B('image', 'image', 'Photo'), B('about', 'checklist', 'About this facility')), B('features', 'iconGrid', 'Features', 'tiles'), B('gallery', 'imageCards', 'Photos'), B('benefits', 'benefits', 'Key benefits', 'inline')],
  }),

  // ───────────── News, careers, alumni, downloads, contact ─────────────
  T('news-list', 'Latest news', { sidebar: true, main: [], dynamic: 'news' }, 'Lists published News items. Categories are managed in Website Content → Categories.'),
  T('events-list', 'Events', { sidebar: true, main: [], dynamic: 'events' }),
  T('announcements-list', 'Announcements', { sidebar: true, main: [], dynamic: 'announcements' }),
  T('achievements-list', 'Achievements', { sidebar: true, main: [], dynamic: 'achievements' }, undefined, [text('journeyValue', '"Proud journey" figure', { help: 'e.g. 500+' }), text('journeyLabel', '"Proud journey" label')]),
  T('gallery-list', 'Gallery', { sidebar: true, main: [], dynamic: 'gallery' }),
  T('downloads-list', 'Downloads', { sidebar: false, main: [], dynamic: 'downloads' }, 'Lists published documents; the category menu follows document categories.'),
  T('careers', 'Careers', {
    sidebar: false,
    main: [B('strip', 'strip', 'Values strip'), B('why', 'benefits', 'Why work at SST?', 'tiles')],
    aside: [B('join', 'cards', 'Join our team card', 'feature'), B('process', 'steps', 'Application process', 'vertical')],
    asideWidth: '390px',
    dynamic: 'vacancies',
  }, 'Vacancies are managed under Careers → Vacancies.'),
  T('alumni', 'Alumni (SST-designed)', {
    sidebar: false,
    main: [B('strip', 'strip', 'Feature strip'), R('1fr 1fr', B('image', 'image', 'Photo'), B('network', 'textPanel', 'The alumni network')), B('sectors', 'iconGrid', 'Where our alumni serve', 'compact')],
    aside: [B('glance', 'stats', 'Alumni at a glance')],
    asideWidth: '340px',
    dynamic: 'alumni',
  }, 'Stories come from Content → Alumni Stories. Registrations arrive in Submissions.'),
  T('contact', 'Contact', { sidebar: false, main: [], dynamic: 'contact' }, 'Address, phone, email and office hours come from Contact Information.', [
    { type: 'list', name: 'quickLinks', label: 'Quick links', itemLabel: 'Link', max: 6, fields: [{ type: 'icon', name: 'icon', label: 'Icon' }, text('label', 'Label', { required: true }), link('href', 'Link', { required: true })] },
    { type: 'list', name: 'enquiries', label: 'Enquiry types strip', itemLabel: 'Type', max: 4, fields: [{ type: 'icon', name: 'icon', label: 'Icon' }, text('title', 'Title', { required: true }), text('text', 'Text')] },
    { type: 'stringList', name: 'inquiryTypes', label: 'Inquiry type options (form)', itemLabel: 'Option' },
  ]),
];
