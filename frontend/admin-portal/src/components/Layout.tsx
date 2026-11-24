import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Award,
  Server,
  Briefcase,
  GraduationCap,
  HelpCircle,
  Inbox,
  Tags,
  Trophy,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Gauge,
  Globe,
  History,
  Home,
  Images,
  KeyRound,
  LayoutList,
  LogOut,
  Megaphone,
  Menu,
  MessageSquareQuote,
  Newspaper,
  PanelsTopLeft,
  Phone,
  ScrollText,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Star,
  UserCircle,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

interface Item {
  to: string;
  label: string;
  icon: ReactNode;
  perm?: string;
}
const I = (C: any) => <C className="h-4 w-4" />;

export const NAV: { title: string; items: Item[] }[] = [
  {
    title: 'Dashboard',
    items: [
      { to: '/', label: 'Overview', icon: I(Gauge), perm: 'dashboard.view' },
      { to: '/workflow', label: 'Approval Queue', icon: I(ClipboardCheck), perm: 'dashboard.view' },
    ],
  },
  {
    title: 'Website Content',
    items: [
      { to: '/pages/home', label: 'Homepage Content', icon: I(Home), perm: 'pages.view' },
      { to: '/pages', label: 'Page Content', icon: I(PanelsTopLeft), perm: 'pages.view' },
      { to: '/navigation', label: 'Navigation', icon: I(LayoutList), perm: 'navigation.view' },
      { to: '/statistics', label: 'Statistics', icon: I(BarChart3), perm: 'statistics.view' },
      { to: '/categories', label: 'Categories', icon: I(Tags), perm: 'categories.view' },
    ],
  },
  {
    title: 'Institutional',
    items: [
      { to: '/committees/board-of-trustees', label: 'Board of Trustees', icon: I(Users), perm: 'people.view' },
      { to: '/committees/executive-committee', label: 'Executive Committee', icon: I(UsersRound), perm: 'people.view' },
      { to: '/committees/school-administration', label: 'School Administration', icon: I(Building2), perm: 'people.view' },
      { to: '/people', label: 'All People', icon: I(UserCircle), perm: 'people.view' },
      { to: '/messages', label: 'Leadership Messages', icon: I(MessageSquareQuote), perm: 'messages.view' },
    ],
  },
  {
    title: 'Academics & Admissions',
    items: [
      { to: '/faculty', label: 'Faculty', icon: I(GraduationCap), perm: 'faculty.view' },
      { to: '/results', label: 'Examination Results', icon: I(Trophy), perm: 'results.view' },
      { to: '/faqs', label: 'Admissions FAQs', icon: I(HelpCircle), perm: 'faqs.view' },
      { to: '/vacancies', label: 'Career Vacancies', icon: I(Briefcase), perm: 'vacancies.view' },
      { to: '/submissions', label: 'Form Submissions', icon: I(Inbox), perm: 'submissions.view' },
    ],
  },
  {
    title: 'Content & Publications',
    items: [
      { to: '/posts/news', label: 'News', icon: I(Newspaper), perm: 'posts.view' },
      { to: '/events', label: 'Events', icon: I(CalendarDays), perm: 'events.view' },
      { to: '/posts/announcements', label: 'Announcements', icon: I(Megaphone), perm: 'posts.view' },
      { to: '/posts/achievements', label: 'Achievements', icon: I(Award), perm: 'posts.view' },
      { to: '/stories/testimonials', label: 'Testimonials', icon: I(MessageSquareQuote), perm: 'stories.view' },
      { to: '/stories/success', label: 'Student Success Stories', icon: I(Star), perm: 'stories.view' },
      { to: '/stories/alumni', label: 'Alumni Stories', icon: I(BookOpen), perm: 'stories.view' },
    ],
  },
  {
    title: 'Media',
    items: [
      { to: '/media', label: 'Media Library', icon: I(Images), perm: 'media.view' },
      { to: '/galleries', label: 'Image Galleries', icon: I(FolderOpen), perm: 'galleries.view' },
      { to: '/documents', label: 'Documents & Downloads', icon: I(FileText), perm: 'documents.view' },
    ],
  },
  {
    title: 'Website Configuration',
    items: [
      { to: '/settings/identity', label: 'School Identity & Theme', icon: I(Globe), perm: 'settings.view' },
      { to: '/settings/contact', label: 'Contact Information', icon: I(Phone), perm: 'settings.view' },
      { to: '/settings/social', label: 'Social Media', icon: I(Share2), perm: 'settings.view' },
      { to: '/settings/seo', label: 'SEO Settings', icon: I(Search), perm: 'settings.view' },
      { to: '/settings/website', label: 'Website Settings', icon: I(Settings), perm: 'settings.view' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/users', label: 'Users', icon: I(Users), perm: 'users.view' },
      { to: '/roles', label: 'Roles & Permissions', icon: I(KeyRound), perm: 'roles.manage' },
      { to: '/revisions', label: 'Revision History', icon: I(History), perm: 'revisions.view' },
      { to: '/audit', label: 'Audit Logs', icon: I(ScrollText), perm: 'audit.view' },
      { to: '/system', label: 'System', icon: I(Server), perm: 'system.manage' },
    ],
  },
];

export function Layout() {
  const { user, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Administration">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500 font-serif text-sm font-bold text-brand-900">SST</div>
        <div>
          <p className="font-serif text-sm font-bold leading-tight text-white">SST Rashidabad</p>
          <p className="text-[11px] uppercase tracking-wider text-gold-400">Administration</p>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.perm || can(i.perm));
          if (!items.length) return null;
          return (
            <div key={g.title}>
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200/70">{g.title}</p>
              <ul className="space-y-0.5">
                {items.map((i) => (
                  <li key={i.to}>
                    <NavLink
                      to={i.to}
                      end={i.to === '/' || i.to === '/pages'}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        clsx('flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition', isActive ? 'bg-white/10 font-medium text-white' : 'text-brand-100/80 hover:bg-white/5 hover:text-white')
                      }
                    >
                      {i.icon}
                      {i.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-brand-900 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-brand-900">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="hidden text-sm text-slate-500 lg:block">
          <a href="/" target="_blank" rel="noopener" className="hover:text-brand-700">
            View website ↗
          </a>
        </div>
        <div className="flex items-center gap-3">
          <NavLink to="/account" className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{user?.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
            <span className="hidden text-left sm:block">
              <span className="block font-medium leading-tight text-slate-800">{user?.name}</span>
              <span className="block text-xs leading-tight text-slate-500">{user?.roles.map((r) => r.name).join(', ')}</span>
            </span>
          </NavLink>
          <button onClick={logout} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Sign out" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main key={location.pathname} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}

export const ShieldIcon = ShieldCheck;
