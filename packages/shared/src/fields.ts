import { z, type ZodTypeAny } from 'zod';
import { ICON_NAMES } from './icons';

/**
 * Field definitions for predefined content forms. Each page template is a fixed list of
 * fields — administrators edit values, never structure or layout.
 */
interface Base {
  name: string;
  label: string;
  help?: string;
  required?: boolean;
}

export type Field =
  | (Base & { type: 'text'; maxLength?: number })
  | (Base & { type: 'textarea'; maxLength?: number; rows?: number })
  | (Base & { type: 'richtext' })
  | (Base & { type: 'link' })
  | (Base & { type: 'icon' })
  | (Base & { type: 'image' })
  | (Base & { type: 'document' })
  | (Base & { type: 'documents' })
  | (Base & { type: 'number' })
  | (Base & { type: 'color' })
  | (Base & { type: 'boolean' })
  | (Base & { type: 'select'; options: { value: string; label: string }[] })
  | (Base & { type: 'stringList'; itemLabel?: string; max?: number })
  | (Base & { type: 'group'; fields: Field[] })
  | (Base & { type: 'list'; itemLabel: string; fields: Field[]; min?: number; max?: number });

const uuid = z.string().uuid();
/** Internal path ("/about") , anchor, mailto/tel, or absolute http(s) URL. */
const linkSchema = z
  .string()
  .max(500)
  .refine((v) => v === '' || /^(\/|#|https?:\/\/|mailto:|tel:)/.test(v), 'Must be a path starting with / or a full URL');

const optionalStr = (s: z.ZodString, required?: boolean) =>
  required ? s.min(1, 'Required') : s.optional().nullable().or(z.literal(''));

export function fieldSchema(f: Field): ZodTypeAny {
  switch (f.type) {
    case 'text':
      return optionalStr(z.string().max(f.maxLength ?? 300), f.required);
    case 'textarea':
      return optionalStr(z.string().max(f.maxLength ?? 3000), f.required);
    case 'richtext':
      return optionalStr(z.string().max(100_000), f.required);
    case 'link':
      return f.required ? linkSchema.refine((v) => v !== '', 'Required') : linkSchema.optional().nullable();
    case 'icon':
      return f.required ? z.enum(ICON_NAMES) : z.enum(ICON_NAMES).optional().nullable().or(z.literal(''));
    case 'image':
    case 'document':
      return f.required ? uuid : uuid.optional().nullable().or(z.literal(''));
    case 'documents':
      return z.array(uuid).max(50).default([]);
    case 'number':
      return f.required ? z.number() : z.number().optional().nullable();
    case 'color': {
      const c = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour such as #1b2a55');
      return f.required ? c : c.optional().nullable().or(z.literal(''));
    }
    case 'boolean':
      return z.boolean().optional().default(false);
    case 'select': {
      const values = f.options.map((o) => o.value) as [string, ...string[]];
      return f.required ? z.enum(values) : z.enum(values).optional().nullable();
    }
    case 'stringList':
      return z.array(z.string().max(500)).max(f.max ?? 50).default([]);
    case 'group':
      return objectSchema(f.fields).default({});
    case 'list': {
      let arr = z.array(objectSchema(f.fields)).max(f.max ?? 50);
      if (f.min) arr = arr.min(f.min);
      return arr.default([]);
    }
  }
}

export function objectSchema(fields: Field[]) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of fields) shape[f.name] = fieldSchema(f);
  return z.object(shape).strip();
}

/** Apply `fn` to every richtext value (used by the backend to sanitise HTML). */
export function mapRichText(fields: Field[], value: any, fn: (html: string) => string): any {
  if (!value || typeof value !== 'object') return value;
  const out: any = { ...value };
  for (const f of fields) {
    const v = out[f.name];
    if (v == null) continue;
    if (f.type === 'richtext' && typeof v === 'string') out[f.name] = fn(v);
    else if (f.type === 'group') out[f.name] = mapRichText(f.fields, v, fn);
    else if (f.type === 'list' && Array.isArray(v)) out[f.name] = v.map((item) => mapRichText(f.fields, item, fn));
  }
  return out;
}

// ── small helpers for building templates ──
export const text = (name: string, label: string, extra: Partial<Base> & { maxLength?: number } = {}): Field => ({ type: 'text', name, label, ...extra });
export const textarea = (name: string, label: string, extra: Partial<Base> & { rows?: number; maxLength?: number } = {}): Field => ({ type: 'textarea', name, label, ...extra });
export const rich = (name: string, label: string, extra: Partial<Base> = {}): Field => ({ type: 'richtext', name, label, ...extra });
export const link = (name: string, label: string, extra: Partial<Base> = {}): Field => ({ type: 'link', name, label, ...extra });
export const icon = (name = 'icon', label = 'Icon'): Field => ({ type: 'icon', name, label });
export const image = (name: string, label: string, extra: Partial<Base> = {}): Field => ({ type: 'image', name, label, ...extra });
export const group = (name: string, label: string, fields: Field[], help?: string): Field => ({ type: 'group', name, label, fields, help });
export const list = (name: string, label: string, itemLabel: string, fields: Field[], opts: { min?: number; max?: number; help?: string } = {}): Field => ({ type: 'list', name, label, itemLabel, fields, ...opts });
export const strings = (name: string, label: string, itemLabel = 'Item', max?: number): Field => ({ type: 'stringList', name, label, itemLabel, max });
