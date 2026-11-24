import { type Field, group, icon, image, link, list, rich, strings, text, textarea } from './fields';

/**
 * Fixed-layout block system.
 *
 * A "composed" page template declares its layout in code: which blocks appear, in which column
 * and in which order. Administrators edit only the CONTENT of each block (generated form);
 * they cannot add, remove, reorder or restyle blocks. The website renders the same layout.
 */
export type BlockType =
  | 'strip'
  | 'image'
  | 'checklist'
  | 'downloads'
  | 'imageCards'
  | 'iconGrid'
  | 'stats'
  | 'table'
  | 'steps'
  | 'keyValues'
  | 'benefits'
  | 'note'
  | 'cta'
  | 'cards'
  | 'houses'
  | 'routine'
  | 'detailList'
  | 'gradeCards'
  | 'progression'
  | 'richText'
  | 'textPanel'
  | 'illustration'
  | 'links';

export interface Block {
  id: string;
  type: BlockType;
  /** Admin form label. */
  label: string;
  /** Visual variant understood by the renderer (developer-controlled). */
  variant?: string;
}
/** A row is one block, or cells side by side (`cols` is a CSS grid-template-columns value).
 *  A cell may be a list of blocks stacked vertically. */
export type Cell = Block | Block[];
export type Row = Block | { cols: string; blocks: Cell[] };

export interface PageLayout {
  /** Section whose navigation forms the left sidebar; null = full-width page. */
  sidebar: boolean;
  /** Block shown to the right of the intro heading (illustration, photo …). */
  introAside?: Block;
  main: Row[];
  /** Optional right-hand column next to the main column. */
  aside?: Block[];
  asideWidth?: string;
  /** Rows spanning the full content width below main/aside. */
  full?: Row[];
  /** Data-driven component rendered at the end of the main column (news list, faculty …). */
  dynamic?: string;
}

const items = (fields: Field[], max = 12, itemLabel = 'Item') => list('items', 'Items', itemLabel, fields, { max });
const heading = () => [icon('icon', 'Heading icon'), text('heading', 'Heading')];

/** Content fields for each block type. */
export const BLOCK_FIELDS: Record<BlockType, Field[]> = {
  strip: [items([icon(), text('title', 'Title', { required: true }), text('subtitle', 'Subtitle')], 8)],
  image: [image('image', 'Image'), text('caption', 'Caption')],
  illustration: [image('image', 'Illustration')],
  checklist: [...heading(), textarea('text', 'Introduction', { rows: 2 }), strings('items', 'Points', 'Point', 12)],
  downloads: [...heading(), textarea('text', 'Introduction', { rows: 2 }), { type: 'documents', name: 'documents', label: 'Documents' }],
  imageCards: [...heading(), items([image('image', 'Image'), text('label', 'Label', { required: true }), link('href', 'Link')], 10, 'Card')],
  iconGrid: [...heading(), items([icon(), text('label', 'Label', { required: true }), text('text', 'Description')], 16)],
  stats: [...heading(), items([icon(), text('label', 'Label', { required: true }), text('value', 'Value', { required: true })], 8, 'Figure')],
  table: [
    ...heading(),
    textarea('text', 'Introduction', { rows: 2 }),
    strings('columns', 'Column headings', 'Column', 8),
    list('rows', 'Rows', 'Row', [strings('cells', 'Cells', 'Cell', 8)], { max: 30 }),
    textarea('note', 'Note below the table', { rows: 2 }),
  ],
  steps: [...heading(), items([icon(), text('title', 'Title', { required: true }), textarea('text', 'Text', { rows: 2 }), text('badge', 'Date / badge')], 8, 'Step')],
  keyValues: [...heading(), items([icon(), text('label', 'Label', { required: true }), text('value', 'Value')], 12, 'Row'), text('ctaLabel', 'Button label'), link('ctaHref', 'Button link')],
  benefits: [...heading(), textarea('text', 'Introduction', { rows: 2 }), items([icon(), text('title', 'Title', { required: true }), text('text', 'Text')], 8, 'Benefit')],
  note: [...heading(), textarea('text', 'Text', { rows: 3 }), strings('items', 'Points', 'Point', 8)],
  cta: [icon('icon', 'Icon'), text('heading', 'Heading'), textarea('text', 'Text', { rows: 2 }), text('secondaryLabel', 'Secondary button label'), link('secondaryHref', 'Secondary button link'), text('primaryLabel', 'Primary button label'), link('primaryHref', 'Primary button link')],
  cards: [...heading(), items([image('image', 'Image'), icon(), text('title', 'Title', { required: true }), textarea('text', 'Text', { rows: 2 }), text('badge', 'Badge'), link('href', 'Link')], 10, 'Card')],
  houses: [items([image('image', 'Crest'), text('title', 'House name', { required: true }), text('text', 'Values / motto'), { type: 'color', name: 'color', label: 'House colour' }], 6, 'House')],
  routine: [...heading(), items([icon(), text('title', 'Time', { required: true }), text('text', 'Activity')], 10, 'Slot')],
  detailList: [...heading(), textarea('text', 'Introduction', { rows: 2 }), items([icon(), text('title', 'Title', { required: true }), textarea('text', 'Description', { rows: 2 })], 12, 'Row')],
  gradeCards: [items([icon(), text('title', 'Title', { required: true }), text('badge', 'Badge'), textarea('text', 'Text', { rows: 2 })], 6, 'Card')],
  progression: [...heading(), items([text('title', 'Title', { required: true }), text('text', 'Subtitle')], 8, 'Stage')],
  richText: [...heading(), rich('body', 'Text')],
  links: [items([icon(), text('label', 'Label', { required: true }), link('href', 'Link', { required: true })], 6, 'Button')],
  textPanel: [...heading(), textarea('text', 'Text', { rows: 4 }), strings('items', 'Points', 'Point', 10), text('ctaLabel', 'Button label'), link('ctaHref', 'Button link')],
};

export const SIDEBAR_CARD_FIELDS: Field[] = [icon('icon', 'Icon'), text('heading', 'Heading'), textarea('text', 'Text', { rows: 2 }), text('ctaLabel', 'Button label'), link('ctaHref', 'Button link')];
export const BANNER_FIELDS: Field[] = [
  icon('icon', 'Icon'),
  text('line1', 'Title line 1', { help: 'e.g. "Admissions Open" — leave empty for a quote-only banner' }),
  text('line2', 'Title line 2 (gold)', { help: 'e.g. "2026 – 2027"' }),
  textarea('quote', 'Quotation', { rows: 2 }),
  text('ctaLabel', 'Button label', { help: 'Empty = "EXCEL TO LEAD" badge' }),
  link('ctaHref', 'Button link'),
];

export function layoutBlocks(l: PageLayout): Block[] {
  const fromRows = (rows: Row[] = []) => rows.flatMap((r) => ('blocks' in r ? r.blocks.flat() : [r]));
  return [...(l.introAside ? [l.introAside] : []), ...fromRows(l.main), ...(l.aside ?? []), ...fromRows(l.full)];
}

/** Admin form fields for a composed layout (one group per block, in reading order). */
export function layoutFields(l: PageLayout): Field[] {
  return [
    group('hero', 'Hero banner', [text('eyebrow', 'Eyebrow label')], 'Title, subtitle and background image are set in Page details.'),
    group('intro', 'Introduction', [text('eyebrow', 'Eyebrow label'), text('heading', 'Heading', { required: true }), textarea('text', 'Text', { rows: 3 })]),
    ...layoutBlocks(l).map((b) => group(b.id, b.label, BLOCK_FIELDS[b.type])),
    ...(l.sidebar ? [group('sidebarCard', 'Sidebar card', SIDEBAR_CARD_FIELDS, 'Card shown under the section menu')] : []),
    group('banner', 'Closing banner', BANNER_FIELDS),
  ];
}

// ── helpers for declaring layouts ──
export const B = (id: string, type: BlockType, label: string, variant?: string): Block => ({ id, type, label, variant });
export const R = (cols: string, ...blocks: Cell[]): Row => ({ cols, blocks });
