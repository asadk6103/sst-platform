/**
 * Permission catalogue. Roles are stored in the database and are configurable from the
 * administration portal; this file defines the permission keys and the default role presets.
 */

export const CONTENT_MODULES = [
  'pages',
  'people',
  'messages',
  'posts',
  'events',
  'stories',
  'faculty',
  'results',
  'vacancies',
] as const;
export type ContentModule = (typeof CONTENT_MODULES)[number];

const crud = (module: string, label: string) => [
  { key: `${module}.view`, module, description: `View ${label}` },
  { key: `${module}.create`, module, description: `Create ${label}` },
  { key: `${module}.edit`, module, description: `Edit ${label}` },
  { key: `${module}.delete`, module, description: `Archive/delete ${label}` },
];

export const PERMISSIONS = [
  { key: 'dashboard.view', module: 'dashboard', description: 'View the dashboard' },
  ...crud('pages', 'page content').filter((p) => !p.key.endsWith('.create') && !p.key.endsWith('.delete')),
  ...crud('people', 'leadership people & committees'),
  ...crud('messages', 'leadership messages').filter((p) => !p.key.endsWith('.create') && !p.key.endsWith('.delete')),
  ...crud('posts', 'news, announcements & achievements'),
  ...crud('events', 'events'),
  ...crud('stories', 'testimonials & success stories'),
  ...crud('faculty', 'faculty members'),
  ...crud('results', 'examination results'),
  ...crud('vacancies', 'career vacancies'),
  { key: 'faqs.view', module: 'faqs', description: 'View FAQs' },
  { key: 'faqs.edit', module: 'faqs', description: 'Create, edit and delete FAQs' },
  { key: 'categories.view', module: 'categories', description: 'View categories' },
  { key: 'categories.edit', module: 'categories', description: 'Manage categories' },
  { key: 'submissions.view', module: 'submissions', description: 'View form submissions (contact, applications, subscribers)' },
  { key: 'submissions.manage', module: 'submissions', description: 'Update, export and delete form submissions' },
  { key: 'content.edit_others', module: 'workflow', description: "Edit content created by other users" },
  { key: 'workflow.submit', module: 'workflow', description: 'Submit content for review' },
  { key: 'workflow.review', module: 'workflow', description: 'Approve or reject submitted content' },
  { key: 'workflow.publish', module: 'workflow', description: 'Publish, schedule and unpublish content' },
  { key: 'revisions.view', module: 'revisions', description: 'View revision history' },
  { key: 'revisions.restore', module: 'revisions', description: 'Restore previous versions' },
  { key: 'statistics.view', module: 'statistics', description: 'View statistics' },
  { key: 'statistics.edit', module: 'statistics', description: 'Edit statistics' },
  { key: 'navigation.view', module: 'navigation', description: 'View navigation' },
  { key: 'navigation.edit', module: 'navigation', description: 'Edit navigation' },
  ...crud('media', 'media library'),
  ...crud('documents', 'documents & downloads'),
  ...crud('galleries', 'image galleries'),
  { key: 'settings.view', module: 'settings', description: 'View website settings' },
  { key: 'settings.edit', module: 'settings', description: 'Edit website settings, theme, contact, social, SEO' },
  { key: 'users.view', module: 'users', description: 'View users' },
  { key: 'users.manage', module: 'users', description: 'Create, edit and deactivate users' },
  { key: 'roles.manage', module: 'roles', description: 'Manage roles & permissions' },
  { key: 'audit.view', module: 'audit', description: 'View audit logs' },
  { key: 'system.manage', module: 'system', description: 'Manage system settings (public address, uploads, cookies) and rotate security keys' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

const ALL = PERMISSIONS.map((p) => p.key) as PermissionKey[];
const VIEW = ALL.filter((k) => k.endsWith('.view'));
/** Views that expose personal data — only granted explicitly. */
const PRIVATE_VIEWS: string[] = ['users.view', 'audit.view', 'submissions.view'];
const CONTENT_EDIT = ALL.filter((k) =>
  /^(pages|people|messages|posts|events|stories|faculty|results|vacancies)\.(create|edit)$/.test(k),
);

export const DEFAULT_ROLES: { key: string; name: string; description: string; permissions: PermissionKey[] }[] = [
  {
    key: 'super_admin',
    name: 'Super Administrator',
    description: 'Full platform access.',
    permissions: ALL,
  },
  {
    key: 'website_admin',
    name: 'Website Administrator',
    description: 'Manage all website content and settings.',
    permissions: ALL.filter((k) => !['users.manage', 'roles.manage', 'system.manage'].includes(k)),
  },
  {
    key: 'content_editor',
    name: 'Content Editor',
    description: 'Create and edit content.',
    permissions: [
      ...VIEW.filter((k) => !PRIVATE_VIEWS.includes(k)),
      ...CONTENT_EDIT,
      'content.edit_others',
      'workflow.submit',
      'statistics.edit',
      'faqs.edit',
      'categories.edit',
      'media.create',
      'media.edit',
    ],
  },
  {
    key: 'content_author',
    name: 'Content Author',
    description: 'Create content and submit for review.',
    permissions: [
      'dashboard.view',
      'pages.view',
      'people.view',
      'messages.view',
      'posts.view',
      'events.view',
      'stories.view',
      'media.view',
      'documents.view',
      'galleries.view',
      'revisions.view',
      'posts.create',
      'posts.edit',
      'events.create',
      'events.edit',
      'stories.create',
      'stories.edit',
      'media.create',
      'workflow.submit',
    ],
  },
  {
    key: 'publisher',
    name: 'Publisher',
    description: 'Review and publish content.',
    permissions: [
      ...VIEW.filter((k) => !PRIVATE_VIEWS.includes(k)),
      'workflow.review',
      'workflow.publish',
      'revisions.view',
    ],
  },
  {
    key: 'media_manager',
    name: 'Media Manager',
    description: 'Manage images and documents.',
    permissions: [
      'dashboard.view',
      'media.view',
      'media.create',
      'media.edit',
      'media.delete',
      'documents.view',
      'documents.create',
      'documents.edit',
      'documents.delete',
      'galleries.view',
      'galleries.create',
      'galleries.edit',
      'galleries.delete',
    ],
  },
  {
    key: 'reviewer',
    name: 'Read-only Reviewer',
    description: 'View content and revisions.',
    permissions: [...VIEW.filter((k) => !PRIVATE_VIEWS.includes(k)), 'revisions.view'],
  },
];
