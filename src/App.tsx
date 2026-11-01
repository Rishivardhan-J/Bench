import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { RequireRole } from '@/components/layout/RequireRole';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { SignInModal } from '@/components/ui/SignInModal';
import { PageLoading } from '@/components/ui/States';
import { SaveToListDialog } from '@/features/shortlist/SaveToListDialog';

function lazyNamed<T extends Record<string, React.ComponentType>>(loader: () => Promise<T>, name: keyof T) {
  return React.lazy(async () => ({ default: (await loader())[name] }));
}

const SearchPage = lazyNamed(() => import('@/features/search/SearchPage'), 'SearchPage');
const FreelancerDetail = lazyNamed(() => import('@/features/profile/FreelancerDetail'), 'FreelancerDetail');
const ShortlistsPage = lazyNamed(() => import('@/features/shortlist/ShortlistsPage'), 'ShortlistsPage');
const ComparePage = lazyNamed(() => import('@/features/shortlist/ComparePage'), 'ComparePage');
const FreelancerLandingPage = lazyNamed(() => import('@/features/freelancer/FreelancerLandingPage'), 'FreelancerLandingPage');
const FreelancerProfilePage = lazyNamed(() => import('@/features/freelancer/FreelancerProfilePage'), 'FreelancerProfilePage');
const StatusPage = lazyNamed(() => import('@/features/freelancer/StatusPage'), 'StatusPage');
const RequestsPage = lazyNamed(() => import('@/features/freelancer/RequestsPage'), 'RequestsPage');
const ProjectBoardPage = lazyNamed(() => import('@/features/freelancer/ProjectBoardPage'), 'ProjectBoardPage');
const AnalyticsPage = lazyNamed(() => import('@/features/freelancer/AnalyticsPage'), 'AnalyticsPage');
const MessagesPage = lazyNamed(() => import('@/features/messaging/MessagesPage'), 'MessagesPage');
const NotificationsPage = lazyNamed(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage');
const SettingsPage = lazyNamed(() => import('@/features/settings/SettingsPage'), 'SettingsPage');
const ProjectsPage = lazyNamed(() => import('@/features/projects/ProjectsPage'), 'ProjectsPage');
const NewProjectPage = lazyNamed(() => import('@/features/projects/NewProjectPage'), 'NewProjectPage');
const ProjectDetailPage = lazyNamed(() => import('@/features/projects/ProjectDetailPage'), 'ProjectDetailPage');
const AdminQueuePage = lazyNamed(() => import('@/features/admin/AdminQueuePage'), 'AdminQueuePage');
const AdminReportsPage = lazyNamed(() => import('@/features/admin/AdminReportsPage'), 'AdminReportsPage');
const PrivacyPage = lazyNamed(() => import('@/pages/PrivacyPage'), 'PrivacyPage');
const TermsPage = lazyNamed(() => import('@/pages/TermsPage'), 'TermsPage');
const NotFoundPage = lazyNamed(() => import('@/pages/NotFoundPage'), 'NotFoundPage');

/** After navigation, move focus to <main> and reset scroll so keyboard and screen-reader users start at the top. */
function useRouteFocus() {
  const { pathname } = useLocation();
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [pathname]);
}

function App() {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  useRouteFocus();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text tabular-nums font-sans relative flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-16 focus:left-16 focus:z-50 focus:px-16 focus:py-8 focus:bg-surface-3 focus:text-text rounded-sm"
      >
        Skip to main content
      </a>

      <SignInModal />
      <SaveToListDialog />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Header onOpenPalette={() => setPaletteOpen(true)} />

      <main id="main-content" className="flex-1 pb-64" tabIndex={-1}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/freelancer/:id" element={<FreelancerDetail />} />
              <Route path="/for-freelancers" element={<FreelancerLandingPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/:threadId" element={<MessagesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />

              <Route path="/shortlists" element={<RequireRole role="client"><ShortlistsPage /></RequireRole>} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/projects" element={<RequireRole role="client"><ProjectsPage /></RequireRole>} />
              <Route path="/projects/new" element={<RequireRole role="client"><NewProjectPage /></RequireRole>} />
              <Route path="/projects/:id" element={<RequireRole role="client"><ProjectDetailPage /></RequireRole>} />

              <Route path="/freelancer/profile" element={<RequireRole role="freelancer"><FreelancerProfilePage /></RequireRole>} />
              <Route path="/freelancer/status" element={<RequireRole role="freelancer"><StatusPage /></RequireRole>} />
              <Route path="/freelancer/requests" element={<RequireRole role="freelancer"><RequestsPage /></RequireRole>} />
              <Route path="/freelancer/board" element={<RequireRole role="freelancer"><ProjectBoardPage /></RequireRole>} />
              <Route path="/freelancer/analytics" element={<RequireRole role="freelancer"><AnalyticsPage /></RequireRole>} />
              <Route path="/freelancer-profile" element={<Navigate to="/freelancer/profile" replace />} />

              <Route path="/admin" element={<RequireRole role="admin"><AdminQueuePage /></RequireRole>} />
              <Route path="/admin/reports" element={<RequireRole role="admin"><AdminReportsPage /></RequireRole>} />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  );
}

export default App;
