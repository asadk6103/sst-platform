import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ArrowLeft, ArrowRight, Copy, Download, FileText, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { api, ApiError, qs, type Paged } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, EmptyState, fmtBytes, fmtDate, Loading, Modal, PageHeader, Pagination, SearchInput, useFeedback } from '../components/ui';
import { FormRow, SelectInput, TextArea, TextInput, Toggle } from '../components/fields';
import { isImage, MediaField, MediaPickerModal, thumb, useMediaItem, useUpload, type MediaItem } from '../components/media';
import { CategorySlugSelect } from './extra';
import { useQuery as useQ } from '@tanstack/react-query';

// ─────────────────────────── Media library ───────────────────────────
export function MediaLibraryPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('general');
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, busy } = useUpload();
  const q = useQuery({ queryKey: ['media-list', { search, type, category, page }], queryFn: () => api.get<Paged<MediaItem>>(`/admin/media${qs({ search, type, category, page, pageSize: 30 })}`) });
  const cats = useQuery({ queryKey: ['media-categories'], queryFn: () => api.get<{ category: string; count: number }[]>('/admin/media/categories') });
  const onFiles = (files?: FileList | null) => files?.length && upload(files, uploadCategory);

  return (
    <>
      <PageHeader
        title="Media library"
        description="Original files are preserved; responsive WebP versions are generated automatically for images. Replacing a file updates it everywhere it is used."
        actions={
          can('media.create') && (
            <>
              <input ref={fileRef} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.pdf,.docx,.xlsx,.pptx" onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
              <Button icon={<Upload className="h-4 w-4" />} loading={busy} onClick={() => fileRef.current?.click()}>Upload files</Button>
            </>
          )
        }
      />
      {can('media.create') && (
        <div
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => (e.preventDefault(), setDrag(false), onFiles(e.dataTransfer.files))}
          className={clsx('mb-4 flex flex-wrap items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-5 text-sm', drag ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-500')}
        >
          Drag & drop files here (up to 20 at once) · category
          <input className="input w-40" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} aria-label="Upload category" />
        </div>
      )}
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Search name, alt text, caption…" />
          <select className="input w-40" value={type} onChange={(e) => (setType(e.target.value), setPage(1))} aria-label="Type">
            <option value="">All types</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
          </select>
          <select className="input w-48" value={category} onChange={(e) => (setCategory(e.target.value), setPage(1))} aria-label="Category">
            <option value="">All categories</option>
            {cats.data?.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}
          </select>
        </div>
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <EmptyState title="No files found" /> : (
          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {q.data.items.map((m) => (
              <button key={m.id} onClick={() => setSelected(m.id)} className="overflow-hidden rounded-md border border-slate-200 text-left hover:border-brand-500 hover:ring-2 hover:ring-brand-500/20">
                <div className="flex aspect-[4/3] items-center justify-center bg-slate-100">
                  {isImage(m) ? <img src={thumb(m)} alt={m.alt ?? ''} loading="lazy" className="h-full w-full object-cover" /> : <FileText className="h-10 w-10 text-slate-400" />}
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-medium text-slate-700" title={m.originalName}>{m.originalName}</p>
                  <p className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{fmtBytes(m.size)}</span>
                    {m._count?.usages ? <span>used {m._count.usages}×</span> : !m.alt && isImage(m) ? <span className="text-amber-600">no alt text</span> : null}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
        {q.data && <Pagination {...q.data.pagination} onPage={setPage} />}
      </div>
      {selected && <MediaDetails id={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function MediaDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const q = useMediaItem(id);
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);
  const m: any = q.data;
  useEffect(() => {
    if (m) setForm({ alt: m.alt ?? '', caption: m.caption ?? '', title: m.title ?? '', category: m.category });
  }, [m?.id, m?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => (qc.invalidateQueries({ queryKey: ['media-list'] }), qc.invalidateQueries({ queryKey: ['media', id] }));
  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/admin/media/${id}`, form);
      toast('Saved');
      refresh();
      onClose();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const replace = async (file?: File) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true);
    try {
      await api.upload(`/admin/media/${id}/replace`, fd);
      toast('File replaced everywhere it is used');
      refresh();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!(await confirm({ title: 'Delete this file?', text: 'Files that are in use cannot be deleted.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/admin/media/${id}`);
      toast('Deleted');
      refresh();
      onClose();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="File details"
      footer={
        m && (
          <>
            {can('media.delete') && <Button variant="ghost" className="mr-auto text-red-600" icon={<Trash2 className="h-4 w-4" />} onClick={remove}>Delete</Button>}
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {can('media.edit') && <Button loading={busy} onClick={save}>Save details</Button>}
          </>
        )
      }
    >
      {!m || !form ? <Loading /> : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-center overflow-hidden rounded-md bg-slate-100">
              {isImage(m) ? <img src={thumb(m, 960)} alt={m.alt ?? ''} className="max-h-80 w-full object-contain" /> : <FileText className="my-16 h-16 w-16 text-slate-400" />}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">File name</dt><dd className="truncate" title={m.originalName}>{m.originalName}</dd>
              <dt className="text-slate-500">Type</dt><dd>{m.mimeType}</dd>
              <dt className="text-slate-500">Size</dt><dd>{fmtBytes(m.size)}</dd>
              {m.width && <><dt className="text-slate-500">Dimensions</dt><dd>{m.width} × {m.height}px</dd></>}
              <dt className="text-slate-500">Uploaded</dt><dd>{fmtDate(m.createdAt, true)}</dd>
              <dt className="text-slate-500">Responsive versions</dt><dd>{m.variants.length ? m.variants.map((v: any) => v.width).join(', ') + 'px' : '—'}</dd>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={m.url} target="_blank" rel="noopener"><Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />}>Original</Button></a>
              <Button size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => (navigator.clipboard.writeText(location.origin + m.url), toast('Link copied', 'info'))}>Copy link</Button>
              {can('media.edit') && (
                <>
                  <input ref={replaceRef} type="file" hidden onChange={(e) => (replace(e.target.files?.[0]), (e.target.value = ''))} />
                  <Button size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} loading={busy} onClick={() => replaceRef.current?.click()}>Replace file</Button>
                </>
              )}
            </div>
          </div>
          <fieldset disabled={!can('media.edit')} className="space-y-4">
            {isImage(m) && <TextInput label="Alternative text" value={form.alt} onChange={(v) => setForm({ ...form, alt: v })} help="Describes the image for screen readers and search engines (required for accessibility)." />}
            <TextInput label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <TextArea label="Caption" rows={2} value={form.caption} onChange={(v) => setForm({ ...form, caption: v })} />
            <TextInput label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
            <div>
              <p className="label">Used in</p>
              {!m.usages?.length ? <p className="text-sm text-slate-500">Not used in any content.</p> : (
                <ul className="space-y-1 text-sm">{m.usages.map((u: any) => <li key={u.id}><Badge>{u.entityType}</Badge> {u.label}</li>)}</ul>
              )}
            </div>
          </fieldset>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────── Documents & downloads ───────────────────────────
const DOC_CATEGORIES = [
  { value: 'PROSPECTUS', label: 'Prospectus' },
  { value: 'ADMISSION_FORM', label: 'Admission forms' },
  { value: 'GOVERNANCE_POLICY', label: 'Governance policies' },
  { value: 'PUBLICATION', label: 'School publications' },
  { value: 'ANNUAL_REPORT', label: 'Annual reports' },
  { value: 'OTHER', label: 'Other' },
];
const catLabel = (v: string, list: { value: string; label: string }[]) => list.find((c) => c.value === v)?.label ?? v;

export function DocumentsPage() {
  const docCats = useCats('documents');
  const catName = (_: string, slug: string) => docCats.data?.items.find((c: any) => c.slug === slug)?.name ?? slug;
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const q = useQuery({ queryKey: ['documents', search, category, page], queryFn: () => api.get<Paged<any>>(`/admin/documents${qs({ search, category, page, pageSize: 20, sort: 'sortOrder', order: 'asc' })}`) });
  const save = async () => {
    setErrors({});
    try {
      const { id, title, slug, description, category, fileId, publishedDate, sortOrder, isPublished } = edit;
      const body = { title, slug: slug || undefined, description, category, fileId, publishedDate: publishedDate || null, sortOrder: Number(sortOrder) || 0, isPublished };
      if (id) await api.put(`/admin/documents/${id}`, body);
      else await api.post('/admin/documents', body);
      toast('Document saved');
      setEdit(null);
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['documents-all'] });
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast((e as Error).message, 'error');
    }
  };
  return (
    <>
      <PageHeader
        title="Documents & downloads"
        description="Prospectus, admission forms, policies, publications and reports. Published documents can be linked from pages and appear on the Downloads page."
        actions={can('documents.create') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ title: '', category: '', fileId: null, isPublished: false, sortOrder: 0 })}>New document</Button>}
      />
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} />
          <select className="input w-56" value={category} onChange={(e) => (setCategory(e.target.value), setPage(1))} aria-label="Category">
            <option value="">All categories</option>
            {(docCats.data?.items ?? []).map((c: any) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <EmptyState title="No documents" /> : (
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50"><tr><th className="th">Title</th><th className="th hidden md:table-cell">Category</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.items.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="td"><span className="font-medium text-slate-800">{d.title}</span>{d.description && <p className="text-xs text-slate-500">{d.description}</p>}</td>
                  <td className="td hidden text-sm text-slate-500 md:table-cell">{catName('documents', d.category)}</td>
                  <td className="td">{d.isPublished ? <Badge tone="green">Published</Badge> : <Badge>Hidden</Badge>}</td>
                  <td className="td text-right">
                    {can('documents.edit') && <Button size="sm" variant="ghost" onClick={() => setEdit({ ...d, publishedDate: d.publishedDate?.slice(0, 10) ?? '' })}>Edit</Button>}
                    {can('documents.delete') && <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (await confirm({ title: `Delete "${d.title}"?`, danger: true, confirmLabel: 'Delete' })) { await api.del(`/admin/documents/${d.id}`); qc.invalidateQueries({ queryKey: ['documents'] }); } }}>Delete</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pagination {...q.data.pagination} onPage={setPage} />}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit document' : 'New document'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!edit?.fileId}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            <TextInput label="Title" required value={edit.title} onChange={(v) => setEdit({ ...edit, title: v })} error={errors.title} />
            <TextArea label="Description" rows={2} value={edit.description} onChange={(v) => setEdit({ ...edit, description: v })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <CategorySlugSelect scope="documents" value={edit.category} onChange={(v) => setEdit({ ...edit, category: v })} error={errors.category} />
              <TextInput label="Publication date" type="date" value={edit.publishedDate ?? ''} onChange={(v) => setEdit({ ...edit, publishedDate: v })} />
            </div>
            <FormRow label="File" required error={errors.fileId} help="PDF, Word, Excel or PowerPoint. Upload it here or choose one from the media library.">
              <MediaField type="document" value={edit.fileId} onChange={(v) => setEdit({ ...edit, fileId: v })} aspect="aspect-square" />
            </FormRow>
            <Toggle label="Published on the website" checked={!!edit.isPublished} onChange={(v) => setEdit({ ...edit, isPublished: v })} />
          </div>
        )}
      </Modal>
    </>
  );
}

// ─────────────────────────── Galleries ───────────────────────────
const GALLERY_CATEGORIES = ['CAMPUS', 'ACADEMICS', 'SPORTS', 'RESIDENTIAL_LIFE', 'CEREMONIES', 'EVENTS', 'STUDENT_ACTIVITIES', 'ALUMNI_EVENTS'].map((v) => ({ value: v, label: v.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) }));

function GalleryThumb({ id }: { id: string }) {
  const m = useMediaItem(id);
  return m.data ? <img src={thumb(m.data, 320)} alt={m.data.alt ?? ''} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-slate-100" />;
}

export function GalleriesPage() {
  const galCats = useCats('gallery');
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [picker, setPicker] = useState(false);
  const q = useQuery({ queryKey: ['galleries', category], queryFn: () => api.get<Paged<any>>(`/admin/galleries${qs({ category, pageSize: 100, sort: 'sortOrder', order: 'asc' })}`) });
  const save = async () => {
    try {
      const body = { title: edit.title, slug: edit.slug || undefined, description: edit.description, category: edit.category, coverImageId: edit.coverImageId || null, sortOrder: Number(edit.sortOrder) || 0, isPublished: !!edit.isPublished, isFeatured: !!edit.isFeatured, eventDate: edit.eventDate || null, videos: (edit.videos ?? []).filter((v: any) => v.title) };
      const g = edit.id ? await api.put(`/admin/galleries/${edit.id}`, body) : await api.post('/admin/galleries', body);
      await api.put(`/admin/galleries/${g.id}/images`, { images: edit.images.map((i: any) => ({ mediaId: i.mediaId, caption: i.caption ?? null })) });
      toast('Gallery saved');
      setEdit(null);
      qc.invalidateQueries({ queryKey: ['galleries'] });
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const moveImg = (i: number, to: number) => {
    const imgs = [...edit.images];
    const [x] = imgs.splice(i, 1);
    imgs.splice(to, 0, x);
    setEdit({ ...edit, images: imgs });
  };
  return (
    <>
      <PageHeader
        title="Image galleries"
        description="Categorised galleries for campus, academics, sports, residential life, ceremonies, events, student activities and alumni events."
        actions={can('galleries.create') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ title: '', category: galCats.data?.items[0]?.slug ?? '', images: [], videos: [], isPublished: false, isFeatured: false, sortOrder: 0 })}>New gallery</Button>}
      />
      <select className="input mb-4 w-56" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
        <option value="">All categories</option>
        {(galCats.data?.items ?? []).map((c: any) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
      </select>
      {q.isLoading ? <Loading /> : !q.data?.items.length ? <EmptyState title="No galleries" /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.items.map((g) => (
            <div key={g.id} className="card overflow-hidden">
              <div className="aspect-[16/9]">{g.coverImageId || g.images[0] ? <GalleryThumb id={g.coverImageId ?? g.images[0].mediaId} /> : <div className="h-full bg-slate-100" />}</div>
              <div className="flex items-start justify-between gap-2 p-3">
                <div>
                  <p className="font-medium text-slate-800">{g.title}</p>
                  <p className="text-xs text-slate-500">{galCats.data?.items.find((c: any) => c.slug === g.category)?.name ?? g.category} · {g._count.images} images{g.isFeatured ? ' · featured' : ''}</p>
                </div>
                {g.isPublished ? <Badge tone="green">Published</Badge> : <Badge>Hidden</Badge>}
              </div>
              <div className="flex justify-end gap-1 border-t border-slate-100 px-2 py-1.5">
                {can('galleries.edit') && <Button size="sm" variant="ghost" onClick={() => setEdit({ ...g, images: g.images, videos: g.videos ?? [], eventDate: g.eventDate?.slice(0, 10) ?? '' })}>Edit</Button>}
                {can('galleries.delete') && <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (await confirm({ title: `Delete "${g.title}"?`, text: 'The images stay in the media library.', danger: true, confirmLabel: 'Delete' })) { await api.del(`/admin/galleries/${g.id}`); qc.invalidateQueries({ queryKey: ['galleries'] }); } }}>Delete</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit?.id ? 'Edit gallery' : 'New gallery'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!edit?.title}>Save gallery</Button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Title" required value={edit.title} onChange={(v) => setEdit({ ...edit, title: v })} />
              <CategorySlugSelect scope="gallery" value={edit.category} onChange={(v) => setEdit({ ...edit, category: v })} />
              <TextInput label="Event date" type="date" value={edit.eventDate ?? ''} onChange={(v) => setEdit({ ...edit, eventDate: v })} />
            </div>
            <TextArea label="Description" rows={2} value={edit.description} onChange={(v) => setEdit({ ...edit, description: v })} />
            <FormRow label="Cover image" help="Defaults to the first image"><MediaField value={edit.coverImageId} onChange={(v) => setEdit({ ...edit, coverImageId: v })} /></FormRow>
            <Toggle label="Published on the website" checked={!!edit.isPublished} onChange={(v) => setEdit({ ...edit, isPublished: v })} />
            <Toggle label="Featured album (top of the Gallery page)" checked={!!edit.isFeatured} onChange={(v) => setEdit({ ...edit, isFeatured: v })} />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="label mb-0">Videos ({(edit.videos ?? []).length})</p>
                <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEdit({ ...edit, videos: [...(edit.videos ?? []), { title: '', url: '', duration: '', thumbnailId: null }] })}>Add video</Button>
              </div>
              {(edit.videos ?? []).map((v: any, i: number) => (
                <div key={i} className="mb-3 grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
                  <TextInput label="Title" value={v.title} onChange={(x) => setEdit({ ...edit, videos: edit.videos.map((y: any, j: number) => (j === i ? { ...y, title: x } : y)) })} />
                  <TextInput label="YouTube / video URL" value={v.url} onChange={(x) => setEdit({ ...edit, videos: edit.videos.map((y: any, j: number) => (j === i ? { ...y, url: x } : y)) })} help="Leave empty to show 'coming soon'" />
                  <TextInput label="Duration" value={v.duration ?? ''} onChange={(x) => setEdit({ ...edit, videos: edit.videos.map((y: any, j: number) => (j === i ? { ...y, duration: x } : y)) })} help="e.g. 03:42" />
                  <FormRow label="Thumbnail"><MediaField value={v.thumbnailId} onChange={(x) => setEdit({ ...edit, videos: edit.videos.map((y: any, j: number) => (j === i ? { ...y, thumbnailId: x } : y)) })} /></FormRow>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setEdit({ ...edit, videos: edit.videos.filter((_: any, j: number) => j !== i) })}>Remove video</Button>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="label mb-0">Images ({edit.images.length})</p>
                <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPicker(true)}>Add image</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {edit.images.map((im: any, i: number) => (
                  <div key={`${im.mediaId}-${i}`} className="overflow-hidden rounded-md border border-slate-200">
                    <div className="relative aspect-[4/3]">
                      <GalleryThumb id={im.mediaId} />
                      <button className="absolute right-1 top-1 rounded bg-white/90 p-1 text-slate-600 hover:text-red-600" aria-label="Remove image" onClick={() => setEdit({ ...edit, images: edit.images.filter((_: any, j: number) => j !== i) })}><X className="h-3.5 w-3.5" /></button>
                    </div>
                    <input className="w-full border-t border-slate-200 px-2 py-1 text-xs outline-none" placeholder="Caption" value={im.caption ?? ''} onChange={(e) => setEdit({ ...edit, images: edit.images.map((x: any, j: number) => (j === i ? { ...x, caption: e.target.value } : x)) })} />
                    <div className="flex justify-between border-t border-slate-100 px-1">
                      <button className="p-1 text-slate-400 disabled:opacity-30" disabled={i === 0} onClick={() => moveImg(i, i - 1)} aria-label="Move left"><ArrowLeft className="h-3.5 w-3.5" /></button>
                      <button className="p-1 text-slate-400 disabled:opacity-30" disabled={i === edit.images.length - 1} onClick={() => moveImg(i, i + 1)} aria-label="Move right"><ArrowRight className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
      <MediaPickerModal open={picker} onClose={() => setPicker(false)} onPick={(m) => (setEdit({ ...edit, images: [...edit.images, { mediaId: m.id, caption: '' }] }), setPicker(false))} />
    </>
  );
}

/** Managed category list for a scope (Website Content → Categories). */
function useCats(scope: string) {
  return useQ({ queryKey: ['categories', scope], queryFn: () => api.get<Paged<any>>(`/admin/categories${qs({ scope, pageSize: 100, sort: 'sortOrder', order: 'asc' })}`) });
}
