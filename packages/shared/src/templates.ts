import {
  type Field,
  group,
  icon,
  image,
  link,
  list,
  rich,
  strings,
  text,
  textarea,
  objectSchema,
} from './fields';
import type { PageLayout } from './blocks';
import { COMPOSED_TEMPLATES } from './composed';

/**
 * Predefined page templates. Each one corresponds to a fixed, developer-controlled layout on
 * the public website (see frontend/public-website/src/templates). Administrators can change
 * the values of these fields only — never the structure, order or styling of the page.
 */
export interface PageTemplate {
  key: string;
  name: string;
  /** Short note shown in the admin form explaining which other modules feed this page. */
  notes?: string;
  fields: Field[];
  /** Fixed block layout (composed templates only). */
  layout?: PageLayout;
}

const heroEyebrow = group('hero', 'Hero banner', [text('eyebrow', 'Eyebrow label', { help: 'Small gold label above the page title, e.g. "ABOUT SST"' })], 'The hero title, subtitle and background image are set in the Page details panel.');
const intro = (help?: string) =>
  group('intro', 'Introduction', [
    text('eyebrow', 'Eyebrow label'),
    text('heading', 'Heading', { required: true }),
    textarea('text', 'Introduction text', { rows: 4 }),
  ], help);
const sidebar = group('sidebar', 'Sidebar', [{ type: 'boolean', name: 'showVirtualTour', label: 'Show "Virtual Campus Tour" card' }]);
const cta = (prefix = 'cta') => [text(`${prefix}Label`, 'Button label'), link(`${prefix}Href`, 'Button link')];
const iconLabel = (name: string, label: string, itemLabel: string, max?: number) =>
  list(name, label, itemLabel, [icon(), text('label', 'Label', { required: true })], { max });
const banner = group('banner', 'Closing banner', [
  textarea('quote', 'Quotation', { rows: 2 }),
  text('badge', 'Badge text', { help: 'e.g. EXCEL TO LEAD' }),
  image('image', 'Background artwork'),
]);

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    key: 'home',
    name: 'Homepage',
    notes: 'Featured news comes from News (items marked "Featured", newest first).',
    fields: [
      list('slides', 'Hero slider', 'Slide', [
        text('eyebrow', 'Eyebrow label'),
        text('headline', 'Headline', { required: true }),
        textarea('text', 'Description', { rows: 3 }),
        image('image', 'Slide image', { required: true }),
        ...cta('primary'),
        ...cta('secondary'),
      ], { min: 1, max: 6 }),
      list('highlights', 'Institutional highlights', 'Highlight', [icon(), text('title', 'Title', { required: true }), text('text', 'Text')], { max: 4 }),
      group('about', 'About section', [
        text('eyebrow', 'Eyebrow label'),
        text('heading', 'Heading'),
        textarea('text', 'Text', { rows: 4 }),
        image('image', 'Image'),
        ...cta(),
      ]),
      group('academics', 'Academic programmes', [
        text('eyebrow', 'Eyebrow label'),
        text('heading', 'Heading'),
        textarea('text', 'Introduction', { rows: 2 }),
        list('programmes', 'Featured programmes', 'Programme', [
          icon(),
          text('title', 'Title', { required: true }),
          text('grades', 'Grades'),
          textarea('text', 'Description', { rows: 2 }),
          link('href', 'Link'),
        ], { max: 3 }),
      ]),
      group('admissions', 'Admissions banner', [
        text('heading', 'Heading'),
        text('text', 'Sub-heading'),
        iconLabel('features', 'Features', 'Feature', 3),
        ...cta(),
      ]),
      group('campusLife', 'Campus life', [
        text('eyebrow', 'Eyebrow label'),
        text('heading', 'Heading'),
        textarea('text', 'Introduction', { rows: 2 }),
        list('tiles', 'Campus images', 'Tile', [icon(), text('label', 'Label', { required: true }), image('image', 'Image'), link('href', 'Link')], { max: 5 }),
      ]),
      group('news', 'News & events', [text('heading', 'Heading'), textarea('text', 'Text', { rows: 2 }), ...cta(), { type: 'number', name: 'count', label: 'Number of news items to show' }]),
    ],
  },
  {
    key: 'about-school',
    name: 'About the School',
    fields: [
      heroEyebrow,
      intro(),
      iconLabel('features', 'Key features', 'Feature', 4),
      group('philosophy', 'Educational philosophy', [text('heading', 'Heading'), textarea('text', 'Text', { rows: 4 }), image('image', 'Image'), strings('points', 'Key points', 'Point', 6)]),
      list('facts', 'Facts strip', 'Fact', [
        icon(),
        text('line1', 'First line'),
        text('line2', 'Second line'),
        { type: 'select', name: 'emphasis', label: 'Emphasised line', options: [{ value: 'line1', label: 'First line' }, { value: 'line2', label: 'Second line' }] },
      ], { max: 4 }),
      group('explore', 'Explore more', [
        text('heading', 'Heading'),
        list('cards', 'Cards', 'Card', [image('image', 'Image'), icon(), text('title', 'Title', { required: true }), link('href', 'Link', { required: true })], { max: 6 }),
      ]),
      sidebar,
    ],
  },
  {
    key: 'history',
    name: 'History & Heritage',
    fields: [
      heroEyebrow,
      intro(),
      group('legacy', 'The legacy', [text('heading', 'Heading'), textarea('text', 'Text', { rows: 5 }), image('image', 'Image')]),
      group('milestones', 'Key milestones', [
        text('heading', 'Heading'),
        list('items', 'Milestones', 'Milestone', [icon(), text('year', 'Year', { required: true }), textarea('text', 'Text', { rows: 2 })], { max: 10 }),
      ]),
      group('founders', 'Founders & heritage', [text('heading', 'Heading'), textarea('text', 'Text', { rows: 4 }), ...cta()]),
      group('gallery', 'Through the years', [text('heading', 'Heading'), list('images', 'Images', 'Image', [image('image', 'Image', { required: true }), text('caption', 'Caption')], { max: 6 })]),
      sidebar,
    ],
  },
  {
    key: 'vision-mission',
    name: 'Vision, Mission & Values',
    fields: [
      heroEyebrow,
      intro(),
      group('vision', 'Vision', [icon(), text('title', 'Title'), text('tagline', 'Tagline'), textarea('text', 'Text', { rows: 3 })]),
      group('mission', 'Mission', [icon(), text('title', 'Title'), textarea('text', 'Text', { rows: 3 })]),
      group('values', 'Core values', [
        text('heading', 'Heading'),
        text('text', 'Introduction'),
        list('items', 'Values', 'Value', [icon(), text('title', 'Title', { required: true }), textarea('text', 'Text', { rows: 2 })], { max: 8 }),
        image('image', 'Side image'),
      ]),
      group('motto', 'Motto banner', [text('eyebrow', 'Eyebrow label'), text('text', 'Motto')]),
      sidebar,
    ],
  },
  {
    key: 'leadership-overview',
    name: 'Leadership & Governance',
    notes: "Message cards come from Leadership Messages; trustees come from Board of Trustees.",
    fields: [
      heroEyebrow,
      intro(),
      group('messages', 'Message cards', [text('ctaLabel', 'Button label', { help: 'e.g. Read Message' })]),
      list('quickLinks', 'Quick links strip', 'Link', [icon(), text('label', 'Label', { required: true }), link('href', 'Link', { required: true })], { max: 4 }),
      group('trustees', 'Board of trustees section', [text('heading', 'Heading'), text('ctaLabel', 'View-all label'), { type: 'number', name: 'count', label: 'Number of trustees shown' }]),
      group('executive', 'Executive committee section', [text('heading', 'Heading'), text('ctaLabel', 'View-all label'), textarea('text', 'Text', { rows: 3 }), image('image', 'Image')]),
      group('administration', 'School administration section', [text('heading', 'Heading'), list('items', 'Roles', 'Role', [icon(), text('label', 'Label', { required: true }), link('href', 'Link')], { max: 5 })]),
      group('governance', 'Governance banner', [text('heading', 'Heading'), link('href', 'Link'), strings('points', 'Points', 'Point', 3)]),
      sidebar,
    ],
  },
  {
    key: 'leadership-message',
    name: 'Leadership message page',
    notes: 'The message itself, portrait, quote and signature are managed under Institutional Management → Leadership Messages.',
    fields: [heroEyebrow, sidebar],
  },
  {
    key: 'committee-directory',
    name: 'Committee directory',
    notes: 'Members are listed automatically from role assignments in Leadership → People.',
    fields: [heroEyebrow, intro(), sidebar],
  },
  {
    key: 'executive-committee',
    name: 'Executive Committee',
    notes: 'Members are listed automatically from role assignments in Leadership → People.',
    fields: [
      heroEyebrow,
      intro(),
      text('membersHeading', 'Members heading'),
      group('mandate', 'Committee mandate', [icon(), text('heading', 'Heading'), textarea('text', 'Text', { rows: 3 })]),
      group('responsibilities', 'Key responsibilities', [icon(), text('heading', 'Heading'), strings('items', 'Responsibilities', 'Responsibility', 10)]),
      sidebar,
    ],
  },
  {
    key: 'school-administration',
    name: 'School Administration',
    notes: "The Principal card uses the Principal's message; the team is listed from role assignments.",
    fields: [
      heroEyebrow,
      intro(),
      group('principal', "Principal's message card", [text('heading', 'Heading'), text('ctaLabel', 'Button label')]),
      group('focus', 'Key focus areas', [icon(), text('heading', 'Heading'), strings('items', 'Focus areas', 'Area', 8)]),
      group('structure', 'Organization structure', [icon(), text('heading', 'Heading'), textarea('text', 'Text', { rows: 3 }), ...cta()]),
      text('teamHeading', 'Leadership team heading'),
      group('departments', 'Administrative departments', [text('heading', 'Heading'), iconLabel('items', 'Departments', 'Department', 12)]),
      sidebar,
    ],
  },
  {
    key: 'governance-framework',
    name: 'Governance Framework',
    fields: [
      heroEyebrow,
      intro(),
      group('overview', 'Framework overview', [icon(), text('heading', 'Heading'), textarea('text', 'Text', { rows: 4 })]),
      group('model', 'Governance model', [
        icon(),
        text('heading', 'Heading'),
        list('tiers', 'Tiers (top to bottom)', 'Tier', [icon(), text('title', 'Title', { required: true }), text('subtitle', 'Subtitle'), text('note', 'Side note')], { max: 3 }),
      ]),
      group('principles', 'Key governance principles', [icon(), text('heading', 'Heading'), strings('items', 'Principles', 'Principle', 8)]),
      group('structure', 'Organizational structure', [icon(), text('heading', 'Heading'), textarea('text', 'Text', { rows: 3 }), ...cta()]),
      group('decision', 'Decision-making framework', [
        icon(),
        text('heading', 'Heading'),
        list('steps', 'Steps', 'Step', [icon(), text('title', 'Title', { required: true }), text('subtitle', 'Subtitle')], { max: 5 }),
      ]),
      group('policies', 'Policies & key documents', [icon(), text('heading', 'Heading'), textarea('text', 'Text', { rows: 2 }), { type: 'documents', name: 'documents', label: 'Documents' }]),
      sidebar,
    ],
  },
  {
    key: 'why-choose',
    name: 'Why Choose SST',
    fields: [
      heroEyebrow,
      intro(),
      list('features', 'Reasons', 'Reason', [icon(), text('title', 'Title', { required: true }), textarea('text', 'Text', { rows: 3 })], { max: 8 }),
      image('image', 'Feature image'),
      list('strip', 'Highlights strip', 'Highlight', [icon(), text('value', 'Value (optional)', { help: 'e.g. "20+ Years"' }), text('label', 'Label', { required: true })], { max: 6 }),
      banner,
      sidebar,
    ],
  },
  {
    key: 'our-impact',
    name: 'Our Impact',
    notes: 'The statistics strip shows Statistics in the "impact" group; stories come from Student Success Stories / Alumni Stories marked Featured.',
    fields: [
      heroEyebrow,
      intro(),
      group('keyAreas', 'Key areas of impact', [icon(), text('heading', 'Heading'), strings('items', 'Areas', 'Area', 8)]),
      group('stories', 'Student success stories', [icon(), text('heading', 'Heading'), text('ctaLabel', 'View-all label'), link('ctaHref', 'View-all link')]),
      group('alumni', 'Alumni impact', [icon(), text('heading', 'Heading'), textarea('text', 'Text', { rows: 3 }), iconLabel('sectors', 'Sectors', 'Sector', 8), image('image', 'Image')]),
      banner,
      sidebar,
    ],
  },
  {
    key: 'person-profile',
    name: 'Profile page labels',
    notes: 'Shared labels for every individual profile page (trustees, committee members, administration). Profile data is managed in Leadership → People.',
    fields: [
      text('backPrefix', 'Back link prefix', { help: 'e.g. "Back to"' }),
      text('downloadLabel', 'Download button label'),
      text('printLabel', 'Print button label'),
      group('tabs', 'Tab labels', [
        text('profile', 'Profile'),
        text('responsibilities', 'Role & responsibilities'),
        text('affiliations', 'Affiliations'),
        text('messages', 'Messages'),
        text('gallery', 'Gallery'),
      ]),
      text('aboutHeading', '"About" heading'),
      text('keyInfoHeading', '"Key information" heading'),
      text('focusHeading', '"Focus areas" heading'),
      sidebar,
    ],
  },
  {
    key: 'standard',
    name: 'Standard page',
    notes: 'Generic page used until an approved design is supplied for this section.',
    fields: [heroEyebrow, intro(), rich('body', 'Body')],
  },
];

PAGE_TEMPLATES.push(...COMPOSED_TEMPLATES);

export const TEMPLATE_MAP: Record<string, PageTemplate> = Object.fromEntries(PAGE_TEMPLATES.map((t) => [t.key, t]));

export function templateSchema(key: string) {
  const t = TEMPLATE_MAP[key];
  if (!t) throw new Error(`Unknown page template: ${key}`);
  return objectSchema(t.fields);
}
