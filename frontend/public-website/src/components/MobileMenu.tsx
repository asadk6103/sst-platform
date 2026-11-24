'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, Search, X } from 'lucide-react';
import type { NavItem } from '@/lib/api';

/** Mobile/tablet navigation drawer (the desktop header uses CSS hover dropdowns). */
export function MobileMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);
  const link = (it: NavItem) => (it.isComingSoon ? `/coming-soon?from=${encodeURIComponent(it.href)}` : it.href);
  return (
    <>
      <button className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary-100 text-primary-800 xl:hidden" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
        <Menu className="h-6 w-6" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Main menu">
          <div className="absolute inset-0 bg-primary-950/60" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 right-0 flex w-[min(360px,90vw)] flex-col overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-primary-100 px-4 py-3">
              <form action="/search" className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-primary-400" />
                <input name="q" placeholder="Search the website…" aria-label="Search" className="w-full rounded-lg border border-primary-100 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-400" />
              </form>
              <button className="ml-2 p-2 text-primary-800" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-6 w-6" />
              </button>
            </div>
            <ul className="flex-1 px-2 py-2">
              {items.map((it) => (
                <li key={it.id} className="border-b border-primary-50">
                  <div className="flex items-center">
                    <Link href={link(it)} className="flex-1 px-3 py-3 font-serif text-[16px] font-bold text-primary-800">{it.label}</Link>
                    {it.children.length > 0 && (
                      <button className="p-3 text-primary-700" aria-label={`${expanded === it.id ? 'Collapse' : 'Expand'} ${it.label}`} aria-expanded={expanded === it.id} onClick={() => setExpanded(expanded === it.id ? null : it.id)}>
                        <ChevronDown className={`h-5 w-5 transition ${expanded === it.id ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  {expanded === it.id && (
                    <ul className="pb-2 pl-4">
                      {it.children.map((c) => (
                        <li key={c.id}>
                          <Link href={link(c)} className="block px-3 py-2 text-[14.5px] font-semibold text-primary-900">{c.label}</Link>
                          {c.children.map((g) => (
                            <Link key={g.id} href={link(g)} className="block py-1.5 pl-7 pr-3 text-[13.5px] text-primary-900/80">{g.label}</Link>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
