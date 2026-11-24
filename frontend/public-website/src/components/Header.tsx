'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { ChevronDown, ChevronRight, Mail, MapPin, Phone, Search, UserRound } from 'lucide-react';
import type { NavItem } from '@/lib/api';
import { MobileMenu } from './MobileMenu';

interface Props {
  main: NavItem[];
  utility: NavItem[];
  contact: { address?: string; phone?: string; email?: string };
  identity: { nameLine1?: string; nameLine2?: string; nameLine3?: string; motto?: string };
  logo?: { src: string; alt: string } | null;
}

const href = (it: NavItem) => (it.isComingSoon ? `/coming-soon?from=${encodeURIComponent(it.href)}` : it.href);
const firstSeg = (h: string) => h.split('?')[0]!.split('/').filter(Boolean)[0] ?? '';

export function Header({ main, utility, contact, identity, logo }: Props) {
  const path = usePathname();
  const seg = firstSeg(path);
  const portal = utility.find((u) => u.icon);
  const links = utility.filter((u) => u !== portal);
  return (
    <header className="relative z-40">
      {/* Utility bar */}
      <div className="bg-primary-900 text-[13px] text-white">
        <div className="mx-auto flex max-w-site items-center justify-between gap-4 px-4 py-1.5 sm:px-8 lg:px-[60px] 2xl:px-[88px]">
          <ul className="hidden items-center gap-10 lg:flex">
            {contact.address && <li className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden />{contact.address.split('\n')[0]}</li>}
            {contact.phone && <li><a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 hover:text-gold-300"><Phone className="h-4 w-4" aria-hidden />{contact.phone}</a></li>}
            {contact.email && <li><a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-gold-300"><Mail className="h-4 w-4" aria-hidden />{contact.email}</a></li>}
          </ul>
          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            <ul className="flex items-center">
              {links.map((u, i) => (
                <li key={u.id} className="flex items-center">
                  {i > 0 && <span className="mx-3 h-3.5 w-px bg-white/60" aria-hidden />}
                  <Link href={href(u)} className="hover:text-gold-300">{u.label}</Link>
                </li>
              ))}
            </ul>
            {portal && (
              <Link href={href(portal)} className="flex items-center gap-1.5 whitespace-nowrap rounded bg-gradient-to-b from-[#f7a826] to-[#ee8a12] px-3 py-1 font-medium text-white shadow-sm hover:brightness-105">
                <UserRound className="h-4 w-4" aria-hidden /> {portal.label}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Logo + main navigation */}
      <div className="border-b border-primary-100/60 bg-white">
        <div className="mx-auto flex max-w-site items-center gap-4 px-4 py-1.5 sm:px-8 lg:px-[60px] 2xl:px-[88px]">
          <Link href="/" className="flex shrink-0 items-center gap-3 pr-4 xl:border-r-2 xl:border-gold-400 xl:pr-6 2xl:pr-8" aria-label="SST Public School Rashidabad — home">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.src} alt={logo.alt} className="h-[72px] w-[72px] rounded-full object-contain sm:h-[82px] sm:w-[82px]" />
            )}
            <span className="whitespace-nowrap font-serif leading-none text-primary-800">
              <span className="block text-[15px] font-bold sm:text-[19px]">{identity.nameLine1}</span>
              <span className="block text-[18px] font-bold sm:text-[23px]">{identity.nameLine2}</span>
              {identity.nameLine3 && <span className="mt-1 block text-[11px] font-bold tracking-[0.45em] sm:text-[13px]">{identity.nameLine3}</span>}
            </span>
          </Link>
          <nav aria-label="Main" className="ml-auto hidden xl:block">
            <ul className="flex items-center gap-1">
              {main.map((it) => {
                const active = firstSeg(it.href) === seg;
                return (
                  <li key={it.id} className="group relative">
                    <Link
                      href={href(it)}
                      aria-current={active ? 'page' : undefined}
                      className={clsx('flex items-center gap-1 whitespace-nowrap px-2 py-6 font-serif text-[15px] 2xl:text-[15.5px] font-bold text-primary-800 hover:text-primary-600 2xl:px-3.5')}
                    >
                      {it.label}
                      {it.children.length > 0 && <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
                      <span className={clsx('absolute inset-x-3 bottom-4 h-[3px] rounded-full bg-gold-400 transition-transform', active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100')} aria-hidden />
                    </Link>
                    {it.children.length > 0 && (
                      <div className="invisible absolute left-0 top-full z-50 w-72 translate-y-1 rounded-b-lg border-t-[3px] border-gold-400 bg-white py-2 opacity-0 shadow-lift transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                        <ul>
                          {it.children.map((c) => (
                            <li key={c.id} className="group/sub relative">
                              <Link href={href(c)} className="flex items-center justify-between px-4 py-2 text-[14px] font-semibold text-primary-900 hover:bg-primary-50 hover:text-primary-700">
                                {c.label}
                                {c.children.length > 0 && <ChevronRight className="h-4 w-4" aria-hidden />}
                              </Link>
                              {c.children.length > 0 && (
                                <ul className="invisible absolute left-full top-0 w-64 rounded-lg bg-white py-2 opacity-0 shadow-lift transition group-focus-within/sub:visible group-focus-within/sub:opacity-100 group-hover/sub:visible group-hover/sub:opacity-100">
                                  {c.children.map((g) => (
                                    <li key={g.id}><Link href={href(g)} className="block px-4 py-2 text-[13.5px] text-primary-900 hover:bg-primary-50">{g.label}</Link></li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
          <form action="/search" role="search" className="group relative ml-auto hidden sm:block xl:ml-3">
            <label htmlFor="site-search" className="sr-only">Search the website</label>
            <input id="site-search" name="q" placeholder="Search…" className="peer h-11 w-11 rounded-lg border-2 border-primary-100 bg-white pl-10 text-sm outline-none transition-all focus:w-56 focus:border-primary-400" />
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-primary-800" aria-hidden />
          </form>
          <div className="ml-auto sm:ml-0 xl:hidden">
            <MobileMenu items={main} />
          </div>
        </div>
      </div>
    </header>
  );
}
