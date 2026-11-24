import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, Search, X, XCircle } from 'lucide-react';

// ───────── Button ─────────
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-800 text-white hover:bg-brand-700 focus-visible:ring-brand-500',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-brand-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-brand-500',
  gold: 'bg-gold-500 text-white hover:bg-gold-600 focus-visible:ring-gold-500',
};
export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={clsx('h-5 w-5 animate-spin text-brand-600', className)} />;

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="py-14 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{(error as Error).message ?? 'Something went wrong'}</span>
    </div>
  );
}

// ───────── Badges ─────────
const badgeTones = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
};
export const Badge = ({ tone = 'slate', children }: { tone?: keyof typeof badgeTones; children: ReactNode }) => (
  <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-slate-200', badgeTones[tone])}>{children}</span>
);

export const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', IN_REVIEW: 'In review', APPROVED: 'Approved', REJECTED: 'Rejected', PUBLISHED: 'Published' };
const STATUS_TONE: Record<string, keyof typeof badgeTones> = { DRAFT: 'slate', IN_REVIEW: 'amber', APPROVED: 'blue', REJECTED: 'red', PUBLISHED: 'green' };
export function StatusBadge({ status, isLive, hasPendingChanges, scheduledPublishAt }: { status: string; isLive?: boolean; hasPendingChanges?: boolean; scheduledPublishAt?: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status] ?? status}</Badge>
      {status === 'APPROVED' && scheduledPublishAt && <Badge tone="purple">Scheduled</Badge>}
      {isLive && hasPendingChanges && <Badge tone="green">Live (older version)</Badge>}
      {isLive === false && status !== 'PUBLISHED' && <Badge>Not on website</Badge>}
    </span>
  );
}

// ───────── Layout helpers ─────────
export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back}
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, description, children, actions }: { title: ReactNode; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => v !== value && onChange(v), 350);
    return () => clearTimeout(t);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
      <input className="input pl-8" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>
        {total} item{total === 1 ? '' : 's'} · page {page} of {totalPages}
      </span>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" icon={<ChevronLeft className="h-4 w-4" />} />
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page" icon={<ChevronRight className="h-4 w-4" />} />
      </div>
    </div>
  );
}

// ───────── Modal & drawer ─────────
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean | 'xl' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[6vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" className={clsx('w-full rounded-lg bg-white shadow-xl outline-none', wide === 'xl' ? 'max-w-6xl' : wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ───────── Toasts & confirm ─────────
type Toast = { id: number; tone: 'success' | 'error' | 'info'; text: string };
interface Feedback {
  toast: (text: string, tone?: Toast['tone']) => void;
  confirm: (opts: { title: string; text?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}
const FeedbackContext = createContext<Feedback>(null!);
export const useFeedback = () => useContext(FeedbackContext);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<null | { title: string; text?: string; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void }>(null);
  const toast = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);
  const confirm = useCallback<Feedback['confirm']>((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);
  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };
  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto flex items-start gap-2 rounded-md px-3 py-2.5 text-sm text-white shadow-lg', t.tone === 'error' ? 'bg-red-600' : t.tone === 'info' ? 'bg-brand-800' : 'bg-emerald-600')}>
            {t.tone === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : t.tone === 'info' ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={dialog?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {dialog?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{dialog?.text}</p>
      </Modal>
    </FeedbackContext.Provider>
  );
}

// ───────── Misc ─────────
export const fmtDate = (d?: string | Date | null, withTime = false) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '—';

export const fmtBytes = (n?: number | null) => (n == null ? '—' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', value === t.value ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-700')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
