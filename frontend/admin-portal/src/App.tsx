import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { EmptyState, Loading } from './components/ui';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from './pages/auth';
import { DashboardPage, WorkflowQueuePage } from './pages/dashboard';
import { PageEditorPage, PagesListPage } from './pages/pages';
import { ContentEditorPage, ContentListPage, MODULES } from './pages/content';
import { CommitteePage, NavigationPage, SettingsPage, StatisticsPage } from './pages/site';
import { DocumentsPage, GalleriesPage, MediaLibraryPage } from './pages/library';
import { AccountPage, AuditPage, RevisionsPage, RolesPage, UsersPage } from './pages/admin';
import { CategoriesPage, FaqsPage, SubmissionsPage } from './pages/extra';
import { SetupPage, SystemPage, useSetupStatus } from './pages/setup';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const setup = useSetupStatus();
  if (loading || (!user && setup.isLoading)) return <Loading label="Checking your session…" />;
  if (!user && setup.data?.required) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  return can(perm) ? <>{children}</> : <EmptyState title="You do not have access to this section" text="Ask a Super Administrator to update your role." />;
}

/** Resolves /posts/:group, /stories/:group to their module definition. */
function ModuleRoute({ editor }: { editor?: boolean }) {
  const { group } = useParams();
  const def = MODULES[group ?? ''];
  if (!def) return <EmptyState title="Not found" />;
  return <Guard perm={`${def.module}.view`}>{editor ? <ContentEditorPage key={group} def={def} /> : <ContentListPage key={group} def={def} />}</Guard>;
}

export function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Guard perm="dashboard.view"><DashboardPage /></Guard>} />
        <Route path="workflow" element={<Guard perm="dashboard.view"><WorkflowQueuePage /></Guard>} />
        <Route path="pages" element={<Guard perm="pages.view"><PagesListPage /></Guard>} />
        <Route path="pages/:id" element={<Guard perm="pages.view"><PageEditorPage /></Guard>} />
        <Route path="navigation" element={<Guard perm="navigation.view"><NavigationPage /></Guard>} />
        <Route path="statistics" element={<Guard perm="statistics.view"><StatisticsPage /></Guard>} />
        <Route path="committees/:slug" element={<Guard perm="people.view"><CommitteePage /></Guard>} />
        <Route path="people" element={<Guard perm="people.view"><ContentListPage def={MODULES.people!} /></Guard>} />
        <Route path="people/:id" element={<Guard perm="people.view"><ContentEditorPage def={MODULES.people!} /></Guard>} />
        <Route path="messages" element={<Guard perm="messages.view"><ContentListPage def={MODULES.messages!} /></Guard>} />
        <Route path="messages/:id" element={<Guard perm="messages.view"><ContentEditorPage def={MODULES.messages!} /></Guard>} />
        <Route path="events" element={<Guard perm="events.view"><ContentListPage def={MODULES.events!} /></Guard>} />
        <Route path="events/:id" element={<Guard perm="events.view"><ContentEditorPage def={MODULES.events!} /></Guard>} />
        <Route path="posts/:group" element={<ModuleRoute />} />
        <Route path="posts/:group/:id" element={<ModuleRoute editor />} />
        <Route path="stories/:group" element={<ModuleRoute />} />
        <Route path="stories/:group/:id" element={<ModuleRoute editor />} />
        <Route path="faculty" element={<Guard perm="faculty.view"><ContentListPage def={MODULES.faculty!} /></Guard>} />
        <Route path="faculty/:id" element={<Guard perm="faculty.view"><ContentEditorPage def={MODULES.faculty!} /></Guard>} />
        <Route path="results" element={<Guard perm="results.view"><ContentListPage def={MODULES.results!} /></Guard>} />
        <Route path="results/:id" element={<Guard perm="results.view"><ContentEditorPage def={MODULES.results!} /></Guard>} />
        <Route path="vacancies" element={<Guard perm="vacancies.view"><ContentListPage def={MODULES.vacancies!} /></Guard>} />
        <Route path="vacancies/:id" element={<Guard perm="vacancies.view"><ContentEditorPage def={MODULES.vacancies!} /></Guard>} />
        <Route path="faqs" element={<Guard perm="faqs.view"><FaqsPage /></Guard>} />
        <Route path="categories" element={<Guard perm="categories.view"><CategoriesPage /></Guard>} />
        <Route path="submissions" element={<Guard perm="submissions.view"><SubmissionsPage /></Guard>} />
        <Route path="media" element={<Guard perm="media.view"><MediaLibraryPage /></Guard>} />
        <Route path="galleries" element={<Guard perm="galleries.view"><GalleriesPage /></Guard>} />
        <Route path="documents" element={<Guard perm="documents.view"><DocumentsPage /></Guard>} />
        <Route path="settings/:group" element={<Guard perm="settings.view"><SettingsPage /></Guard>} />
        <Route path="users" element={<Guard perm="users.view"><UsersPage /></Guard>} />
        <Route path="roles" element={<Guard perm="roles.manage"><RolesPage /></Guard>} />
        <Route path="revisions" element={<Guard perm="revisions.view"><RevisionsPage /></Guard>} />
        <Route path="audit" element={<Guard perm="audit.view"><AuditPage /></Guard>} />
        <Route path="system" element={<Guard perm="system.manage"><SystemPage /></Guard>} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<EmptyState title="Page not found" />} />
      </Route>
    </Routes>
  );
}
