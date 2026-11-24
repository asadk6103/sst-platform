import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, ImageOff, ImagePlus, Upload, X } from 'lucide-react';
import { clsx } from 'clsx';
import { api, qs, type Paged } from '../lib/api';
import { Button, EmptyState, Loading, Modal, Pagination, SearchInput, fmtBytes, useFeedback } from './ui';

export interface MediaItem {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  title: string | null;
  category: string;
  variants: { width: number; url: string }[];
  createdAt: string;
  _count?: { usages: number };
}

export const isImage = (m?: { mimeType: string } | null) => !!m?.mimeType.startsWith('image/');
/** Smallest variant at least `min` px wide (falls back to the original). */
export const thumb = (m: MediaItem, min = 320) => m.variants?.find((v) => v.width >= min)?.url ?? m.url;

export function useMediaItem(id?: string | null) {
  return useQuery({ queryKey: ['media', id], queryFn: () => api.get<MediaItem>(`/admin/media/${id}`), enabled: !!id, staleTime: 60_000, retry: false });
}

export function useUpload() {
  const qc = useQueryClient();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | File[], category?: string): Promise<MediaItem[]> => {
    const form = new FormData();
    [...files].forEach((f) => form.append('files', f));
    if (category) form.append('category', category);
    setBusy(true);
    try {
      const res = await api.upload<{ items: MediaItem[]; errors: { file: string; message: string }[] }>('/admin/media', form);
      res.errors.forEach((e) => toast(`${e.file}: ${e.message}`, 'error'));
      if (res.items.length) toast(`Uploaded ${res.items.length} file${res.items.length > 1 ? 's' : ''}`);
      qc.invalidateQueries({ queryKey: ['media-list'] });
      return res.items;
    } catch (e: any) {
      toast(e.message, 'error');
      return [];
    } finally {
      setBusy(false);
    }
  };
  return { upload, busy };
}

/** Library browser used for picking an image/document. */
export function MediaPickerModal({ open, onClose, onPick, type = 'image' }: { open: boolean; onClose: () => void; onPick: (m: MediaItem) => void; type?: 'image' | 'document' }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, busy } = useUpload();
  const q = useQuery({
    queryKey: ['media-list', { search, page, type }],
    queryFn: () => api.get<Paged<MediaItem>>(`/admin/media${qs({ search, page, pageSize: 24, type })}`),
    enabled: open,
  });
  return (
    <Modal open={open} onClose={onClose} title={type === 'image' ? 'Choose an image' : 'Choose a file'} wide="xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Search by name, alt text…" />
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept={type === 'image' ? 'image/jpeg,image/png,image/webp,image/gif,image/avif' : '.pdf,.docx,.xlsx,.pptx'}
          onChange={async (e) => {
            if (!e.target.files?.length) return;
            const items = await upload(e.target.files);
            e.target.value = '';
            if (items.length === 1) onPick(items[0]!);
          }}
        />
        <Button icon={<Upload className="h-4 w-4" />} loading={busy} onClick={() => fileRef.current?.click()}>
          Upload new
        </Button>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.items.length ? (
        <EmptyState title="No files found" text="Upload a file to get started." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {q.data.items.map((m) => (
            <button key={m.id} onClick={() => onPick(m)} className="group overflow-hidden rounded-md border border-slate-200 text-left hover:border-brand-500 hover:ring-2 hover:ring-brand-500/30">
              <div className="flex aspect-[4/3] items-center justify-center bg-slate-100">
                {isImage(m) ? <img src={thumb(m)} alt={m.alt ?? ''} className="h-full w-full object-cover" loading="lazy" /> : <FileText className="h-10 w-10 text-slate-400" />}
              </div>
              <div className="truncate px-2 py-1.5 text-xs text-slate-600" title={m.originalName}>
                {m.originalName}
              </div>
            </button>
          ))}
        </div>
      )}
      {q.data && <Pagination {...q.data.pagination} onPage={setPage} />}
    </Modal>
  );
}

/** Form control: a single media reference (stores the media id). */
export function MediaField({ value, onChange, type = 'image', aspect = 'aspect-[16/9]' }: { value?: string | null; onChange: (id: string | null) => void; type?: 'image' | 'document'; aspect?: string }) {
  const [open, setOpen] = useState(false);
  const m = useMediaItem(value);
  return (
    <div className="flex items-start gap-3">
      <div className={clsx('flex w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50', aspect)}>
        {value && m.data ? (
          isImage(m.data) ? <img src={thumb(m.data)} alt={m.data.alt ?? ''} className="h-full w-full object-cover" /> : <FileText className="h-8 w-8 text-slate-400" />
        ) : value && m.isError ? (
          <ImageOff className="h-6 w-6 text-red-400" />
        ) : (
          <ImagePlus className="h-6 w-6 text-slate-300" />
        )}
      </div>
      <div className="min-w-0 space-y-2">
        {m.data && (
          <p className="truncate text-xs text-slate-500" title={m.data.originalName}>
            {m.data.originalName} · {m.data.width ? `${m.data.width}×${m.data.height} · ` : ''}
            {fmtBytes(m.data.size)}
          </p>
        )}
        {value && m.isError && <p className="text-xs text-red-600">This file no longer exists.</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {value ? 'Change' : type === 'image' ? 'Choose image' : 'Choose file'}
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)} icon={<X className="h-3.5 w-3.5" />}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <MediaPickerModal
        open={open}
        type={type}
        onClose={() => setOpen(false)}
        onPick={(item) => {
          onChange(item.id);
          setOpen(false);
        }}
      />
    </div>
  );
}
