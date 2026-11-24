import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExt from '@tiptap/extension-link';
import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, Bold, ChevronDown, ChevronRight, Heading2, Heading3, Italic, Link2, List, ListOrdered, Plus, Quote, Redo2, Trash2, Undo2, X } from 'lucide-react';
import { ICON_NAMES, type Field } from '@sst/shared';
import { ICONS } from '../lib/icons';
import { api, qs, type Paged } from '../lib/api';
import { Button } from './ui';
import { MediaField } from './media';

// ───────── Basic wrappers ─────────
export function FormRow({ label, help, error, required, children, htmlFor }: { label: ReactNode; help?: ReactNode; error?: string; required?: boolean; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-slate-500">{help}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

let idSeq = 0;
const useId = () => useMemo(() => `f${++idSeq}`, []);

export function TextInput({ label, value, onChange, error, help, required, type = 'text', placeholder, maxLength }: { label: ReactNode; value: any; onChange: (v: string) => void; error?: string; help?: ReactNode; required?: boolean; type?: string; placeholder?: string; maxLength?: number }) {
  const id = useId();
  return (
    <FormRow label={label} help={help} error={error} required={required} htmlFor={id}>
      <input id={id} type={type} className={clsx('input', error && 'border-red-400')} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} />
    </FormRow>
  );
}

export function TextArea({ label, value, onChange, error, help, required, rows = 3 }: { label: ReactNode; value: any; onChange: (v: string) => void; error?: string; help?: ReactNode; required?: boolean; rows?: number }) {
  const id = useId();
  return (
    <FormRow label={label} help={help} error={error} required={required} htmlFor={id}>
      <textarea id={id} rows={rows} className={clsx('input', error && 'border-red-400')} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </FormRow>
  );
}

export function Toggle({ label, checked, onChange, help }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; help?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx('relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-brand-700' : 'bg-slate-300')}
      >
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      <span>
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {help && <span className="block text-xs text-slate-500">{help}</span>}
      </span>
    </label>
  );
}

export function SelectInput({ label, value, onChange, options, error, help, required, placeholder = '— Select —' }: { label: ReactNode; value: any; onChange: (v: string | null) => void; options: { value: string; label: string }[]; error?: string; help?: ReactNode; required?: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <FormRow label={label} help={help} error={error} required={required} htmlFor={id}>
      <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        {(!required || !value) && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FormRow>
  );
}

// ───────── Icon picker ─────────
export function IconPicker({ value, onChange }: { value?: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const Current = value ? ICONS[value] : null;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="input flex items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2">
          {Current ? <Current className="h-4 w-4 text-gold-600" /> : <span className="h-4 w-4" />}
          <span className={value ? '' : 'text-slate-400'}>{value ?? 'No icon'}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-80 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          <input autoFocus className="input mb-2" placeholder="Filter icons…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="grid max-h-56 grid-cols-7 gap-1 overflow-y-auto">
            <button type="button" title="No icon" onClick={() => (onChange(null), setOpen(false))} className="flex h-9 items-center justify-center rounded hover:bg-slate-100">
              <X className="h-4 w-4 text-slate-400" />
            </button>
            {ICON_NAMES.filter((n) => n.toLowerCase().includes(filter.toLowerCase())).map((n) => {
              const I = ICONS[n]!;
              return (
                <button type="button" key={n} title={n} onClick={() => (onChange(n), setOpen(false))} className={clsx('flex h-9 items-center justify-center rounded hover:bg-slate-100', n === value && 'bg-brand-50 ring-1 ring-brand-500')}>
                  <I className="h-4 w-4 text-slate-700" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── Rich text ─────────
export function RichText({ value, onChange }: { value?: string | null; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), LinkExt.configure({ openOnClick: false, autolink: true })],
    content: value ?? '',
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });
  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(value ?? '', false);
  }, [value, editor]);
  if (!editor) return null;
  const Btn = ({ on, active, title, children }: { on: () => void; active?: boolean; title: string; children: ReactNode }) => (
    <button type="button" title={title} aria-label={title} onClick={on} className={clsx('rounded p-1.5 hover:bg-slate-200', active && 'bg-slate-200 text-brand-800')}>
      {children}
    </button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="prose-editor overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      <div className="flex flex-wrap gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-600">
        <Btn title="Bold" on={() => c().toggleBold().run()} active={editor.isActive('bold')}><Bold className="h-4 w-4" /></Btn>
        <Btn title="Italic" on={() => c().toggleItalic().run()} active={editor.isActive('italic')}><Italic className="h-4 w-4" /></Btn>
        <Btn title="Heading" on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}><Heading2 className="h-4 w-4" /></Btn>
        <Btn title="Sub-heading" on={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}><Heading3 className="h-4 w-4" /></Btn>
        <Btn title="Bulleted list" on={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')}><List className="h-4 w-4" /></Btn>
        <Btn title="Numbered list" on={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')}><ListOrdered className="h-4 w-4" /></Btn>
        <Btn title="Quote" on={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')}><Quote className="h-4 w-4" /></Btn>
        <Btn
          title="Link"
          active={editor.isActive('link')}
          on={() => {
            const prev = editor.getAttributes('link').href;
            const url = window.prompt('Link URL (https://… or /page)', prev ?? '');
            if (url === null) return;
            if (url === '') c().unsetLink().run();
            else if (/^(https?:\/\/|\/|mailto:|tel:)/.test(url)) c().extendMarkRange('link').setLink({ href: url }).run();
          }}
        >
          <Link2 className="h-4 w-4" />
        </Btn>
        <span className="mx-1 w-px bg-slate-200" />
        <Btn title="Undo" on={() => c().undo().run()}><Undo2 className="h-4 w-4" /></Btn>
        <Btn title="Redo" on={() => c().redo().run()}><Redo2 className="h-4 w-4" /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

// ───────── Document multi-select ─────────
function DocumentsPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const q = useQuery({ queryKey: ['documents-all'], queryFn: () => api.get<Paged<any>>(`/admin/documents${qs({ pageSize: 100, sort: 'title', order: 'asc' })}`) });
  const all = q.data?.items ?? [];
  const byId = Object.fromEntries(all.map((d) => [d.id, d]));
  return (
    <div className="space-y-2">
      {value.map((id, i) => (
        <div key={id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="flex-1 truncate">{byId[id]?.title ?? 'Unknown document'}</span>
          {byId[id] && !byId[id].isPublished && <span className="text-xs text-amber-700">not published</span>}
          <ReorderButtons index={i} length={value.length} onMove={(to) => onChange(move(value, i, to))} />
          <button type="button" className="text-slate-400 hover:text-red-600" aria-label="Remove" onClick={() => onChange(value.filter((v) => v !== id))}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <select className="input" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
        <option value="">+ Add a document…</option>
        {all.filter((d) => !value.includes(d.id)).map((d) => (
          <option key={d.id} value={d.id}>
            {d.title}
          </option>
        ))}
      </select>
    </div>
  );
}

// ───────── Lists ─────────
const move = <T,>(arr: T[], from: number, to: number) => {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x!);
  return a;
};

function ReorderButtons({ index, length, onMove }: { index: number; length: number; onMove: (to: number) => void }) {
  return (
    <span className="flex">
      <button type="button" disabled={index === 0} onClick={() => onMove(index - 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move up">
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" disabled={index === length - 1} onClick={() => onMove(index + 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move down">
        <ArrowDown className="h-4 w-4" />
      </button>
    </span>
  );
}

export function StringList({ value, onChange, itemLabel = 'Item', max }: { value: string[]; onChange: (v: string[]) => void; itemLabel?: string; max?: number }) {
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="input" value={s} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))} aria-label={`${itemLabel} ${i + 1}`} />
          <ReorderButtons index={i} length={value.length} onMove={(to) => onChange(move(value, i, to))} />
          <button type="button" className="p-1 text-slate-400 hover:text-red-600" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {(!max || value.length < max) && (
        <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...value, ''])}>
          Add {itemLabel.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

const blankFor = (fields: Field[]): Record<string, unknown> =>
  Object.fromEntries(fields.map((f) => [f.name, f.type === 'list' || f.type === 'stringList' || f.type === 'documents' ? [] : f.type === 'group' ? blankFor(f.fields) : f.type === 'boolean' ? false : null]));

const itemTitle = (item: any, fields: Field[]) => {
  const f = fields.find((x) => ['title', 'label', 'headline', 'year', 'name', 'heading'].includes(x.name));
  return (f && item?.[f.name]) || '';
};

function ListField({ field, value, onChange, path, errors }: { field: Extract<Field, { type: 'list' }>; value: any[]; onChange: (v: any[]) => void; path: string; errors: Record<string, string> }) {
  const [openIdx, setOpenIdx] = useState<number | null>(value.length ? null : null);
  return (
    <div className="space-y-2">
      {value.map((item, i) => {
        const open = openIdx === i;
        const hasError = Object.keys(errors).some((k) => k.startsWith(`${path}.${i}.`));
        return (
          <div key={i} className={clsx('rounded-md border bg-slate-50/60', hasError ? 'border-red-300' : 'border-slate-200')}>
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-slate-700" onClick={() => setOpenIdx(open ? null : i)} aria-expanded={open}>
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="text-slate-400">{field.itemLabel} {i + 1}</span>
                <span className="truncate">{itemTitle(item, field.fields)}</span>
              </button>
              <ReorderButtons index={i} length={value.length} onMove={(to) => (onChange(move(value, i, to)), setOpenIdx(to))} />
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-30"
                aria-label={`Remove ${field.itemLabel}`}
                disabled={!!field.min && value.length <= field.min}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {open && (
              <div className="space-y-4 border-t border-slate-200 bg-white px-4 py-4">
                <FieldList fields={field.fields} value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} path={`${path}.${i}`} errors={errors} />
              </div>
            )}
          </div>
        );
      })}
      {(!field.max || value.length < field.max) && (
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => {
            onChange([...value, blankFor(field.fields)]);
            setOpenIdx(value.length);
          }}
        >
          Add {field.itemLabel.toLowerCase()}
        </Button>
      )}
      {field.max && <p className="text-xs text-slate-400">The design holds up to {field.max}.</p>}
    </div>
  );
}

// ───────── Generic field renderer ─────────
export function FieldControl({ field, value, onChange, path, errors }: { field: Field; value: any; onChange: (v: any) => void; path: string; errors: Record<string, string> }) {
  const error = errors[path];
  const common = { label: field.label, help: field.help, error, required: field.required };
  switch (field.type) {
    case 'text':
      return <TextInput {...common} value={value} onChange={onChange} maxLength={field.maxLength} />;
    case 'link':
      return <TextInput {...common} value={value} onChange={onChange} placeholder="/about or https://…" help={field.help ?? 'Internal path (e.g. /admissions) or full URL'} />;
    case 'textarea':
      return <TextArea {...common} value={value} onChange={onChange} rows={field.rows} />;
    case 'number':
      return <TextInput {...common} type="number" value={value ?? ''} onChange={(v) => onChange(v === '' ? null : Number(v))} />;
    case 'color':
      return (
        <FormRow {...common}>
          <div className="flex items-center gap-2">
            <input type="color" className="h-9 w-12 cursor-pointer rounded border border-slate-300" value={value || '#14254f'} onChange={(e) => onChange(e.target.value)} aria-label={field.label} />
            <input className="input w-36 font-mono" value={value ?? ''} placeholder="#14254f" onChange={(e) => onChange(e.target.value)} />
            {value && <Button variant="ghost" size="sm" onClick={() => onChange('')}>Clear</Button>}
          </div>
        </FormRow>
      );
    case 'boolean':
      return <Toggle label={field.label} help={field.help} checked={!!value} onChange={onChange} />;
    case 'select':
      return <SelectInput {...common} value={value} onChange={onChange} options={field.options} />;
    case 'icon':
      return (
        <FormRow {...common}>
          <IconPicker value={value} onChange={onChange} />
        </FormRow>
      );
    case 'image':
    case 'document':
      return (
        <FormRow {...common}>
          <MediaField value={value} onChange={onChange} type={field.type === 'image' ? 'image' : 'document'} />
        </FormRow>
      );
    case 'documents':
      return (
        <FormRow {...common}>
          <DocumentsPicker value={value ?? []} onChange={onChange} />
        </FormRow>
      );
    case 'richtext':
      return (
        <FormRow {...common}>
          <RichText value={value} onChange={onChange} />
        </FormRow>
      );
    case 'stringList':
      return (
        <FormRow {...common}>
          <StringList value={value ?? []} onChange={onChange} itemLabel={field.itemLabel} max={field.max} />
        </FormRow>
      );
    case 'list':
      return (
        <FormRow {...common}>
          <ListField field={field} value={value ?? []} onChange={onChange} path={path} errors={errors} />
        </FormRow>
      );
    case 'group':
      return (
        <fieldset className="space-y-4 rounded-md border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">{field.label}</legend>
          {field.help && <p className="-mt-2 text-xs text-slate-500">{field.help}</p>}
          <FieldList fields={field.fields} value={value ?? {}} onChange={onChange} path={path} errors={errors} />
        </fieldset>
      );
  }
}

/** Groups short fields (icon/text/link) in a 2-column grid; long fields take the full width. */
export function FieldList({ fields, value, onChange, path, errors }: { fields: Field[]; value: any; onChange: (v: any) => void; path: string; errors: Record<string, string> }) {
  const set = (name: string, v: any) => onChange({ ...(value ?? {}), [name]: v });
  const short = (f: Field) => ['text', 'link', 'icon', 'number', 'select', 'color'].includes(f.type);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((f) => (
        <div key={f.name} className={short(f) ? '' : 'md:col-span-2'}>
          <FieldControl field={f} value={value?.[f.name]} onChange={(v) => set(f.name, v)} path={`${path}.${f.name}`} errors={errors} />
        </div>
      ))}
    </div>
  );
}
