export const fmtDate = (d?: string | Date | null, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', ...opts }) : '';

export const fmtRange = (a?: string | null, b?: string | null) => {
  if (!a) return '';
  if (!b || new Date(a).toDateString() === new Date(b).toDateString()) return fmtDate(a);
  const A = new Date(a);
  const B = new Date(b);
  return A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear()
    ? `${fmtDate(a, { day: '2-digit' })} – ${fmtDate(b)}`
    : `${fmtDate(a, { day: '2-digit', month: 'short' })} – ${fmtDate(b)}`;
};

export const fmtSize = (n?: number | null) => (n == null ? '' : n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

export const isExternal = (href?: string | null) => !!href && /^https?:\/\//.test(href);

export const stripHtml = (s?: string | null) => (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
