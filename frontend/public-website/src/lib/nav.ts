import type { NavItem } from './api';

const norm = (h: string) => h.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/';

/** Path of nav items leading to the deepest item matching `path` (exact match preferred). */
export function trail(items: NavItem[], path: string): NavItem[] {
  const target = norm(path);
  let best: NavItem[] = [];
  const walk = (list: NavItem[], stack: NavItem[]) => {
    for (const it of list) {
      const s = [...stack, it];
      const h = norm(it.href);
      if (h === target && s.length >= best.length) best = s;
      walk(it.children, s);
    }
  };
  walk(items, []);
  if (best.length) return best;
  // Fall back to the closest ancestor path (e.g. a news article under /news-events/news).
  const parts = target.split('/').filter(Boolean);
  for (let i = parts.length - 1; i > 0; i--) {
    const t = trail(items, '/' + parts.slice(0, i).join('/'));
    if (t.length) return t;
  }
  return [];
}

/** Top-level main menu item for a path (its children form the section sidebar). */
export function sectionRoot(items: NavItem[], path: string): NavItem | null {
  const first = norm(path).split('/').filter(Boolean)[0];
  if (!first) return null;
  return items.find((i) => norm(i.href).split('/').filter(Boolean)[0] === first) ?? null;
}

export const isActive = (href: string, path: string) => norm(href) === norm(path);
export const contains = (item: NavItem, path: string): boolean => isActive(item.href, path) || item.children.some((c) => contains(c, path));
