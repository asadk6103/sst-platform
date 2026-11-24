import { type Field, group, image, link, objectSchema, text, textarea } from './fields';

/** Theme presets. Navy is the default (homepage design); Purple matches the inner-page designs. */
export const THEME_PRESETS = {
  navy: { label: 'Navy (default)', primary: '#14254f', accent: '#c9a14a' },
  purple: { label: 'Royal purple', primary: '#4a1d5f', accent: '#c9a14a' },
} as const;
export type ThemePreset = keyof typeof THEME_PRESETS | 'custom';

export interface SettingsGroup {
  key: string;
  name: string;
  description: string;
  fields: Field[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: 'identity',
    name: 'School identity',
    description: 'Official name, logo and motto shown in the header and footer.',
    fields: [
      image('logo', 'Official logo', { required: true }),
      text('nameLine1', 'Name — first line', { required: true }),
      text('nameLine2', 'Name — second line'),
      text('nameLine3', 'Name — third line (spaced capitals)'),
      text('shortName', 'Short name', { help: 'Used in page titles, e.g. "SST"' }),
      text('motto', 'Motto'),
      text('copyright', 'Footer copyright text', { help: '{year} is replaced with the current year' }),
    ],
  },
  {
    key: 'theme',
    name: 'Theme colour',
    description: 'Colour scheme of the public website. Layout and typography remain fixed.',
    fields: [
      {
        type: 'select',
        name: 'preset',
        label: 'Colour scheme',
        required: true,
        options: [
          { value: 'navy', label: 'Navy (default)' },
          { value: 'purple', label: 'Royal purple' },
          { value: 'custom', label: 'Custom colour' },
        ],
      },
      { type: 'color', name: 'primary', label: 'Custom primary colour', help: 'Used only when "Custom colour" is selected.' },
      { type: 'color', name: 'accent', label: 'Accent (gold) colour', help: 'Leave empty for the standard SST gold.' },
    ],
  },
  {
    key: 'contact',
    name: 'Contact information',
    description: 'Shown in the top bar, footer and contact page.',
    fields: [
      textarea('address', 'Address', { rows: 2 }),
      text('phone', 'Phone'),
      text('email', 'Email'),
      link('mapUrl', 'Map link'),
      text('officeHours', 'Office hours'),
    ],
  },
  {
    key: 'social',
    name: 'Social media',
    description: 'Footer "Follow Us" links. Leave empty to hide an icon.',
    fields: [link('facebook', 'Facebook URL'), link('instagram', 'Instagram URL'), link('youtube', 'YouTube URL'), link('linkedin', 'LinkedIn URL'), link('x', 'X (Twitter) URL')],
  },
  {
    key: 'seo',
    name: 'SEO defaults',
    description: 'Used when a page has no specific SEO metadata.',
    fields: [
      text('defaultTitle', 'Default title'),
      text('titleSuffix', 'Title suffix', { help: 'e.g. " | SST Rashidabad"' }),
      textarea('defaultDescription', 'Default description', { rows: 2, maxLength: 300 }),
      text('keywords', 'Keywords'),
      image('ogImage', 'Default social sharing image'),
    ],
  },
  {
    key: 'website',
    name: 'Website settings',
    description: 'Shared components and general website behaviour.',
    fields: [
      image('defaultHeroImage', 'Default hero banner image', { help: 'Used by inner pages without their own hero image.' }),
      image('sketchImage', 'Campus sketch artwork', { help: 'Line drawing shown at the top right of inner pages.' }),
      group('virtualTour', 'Virtual campus tour card', [
        image('image', 'Thumbnail'),
        text('heading', 'Heading'),
        textarea('text', 'Text', { rows: 2 }),
        text('ctaLabel', 'Button label'),
        link('videoUrl', 'Tour video / page link'),
      ]),
      text('comingSoonText', '"Coming soon" message'),
      { type: 'boolean', name: 'showShareBar', label: 'Show share & print buttons on inner pages' },
    ],
  },
];

export const SETTINGS_MAP: Record<string, SettingsGroup> = Object.fromEntries(SETTINGS_GROUPS.map((g) => [g.key, g]));
export const settingsSchema = (key: string) => objectSchema(SETTINGS_MAP[key]!.fields);
