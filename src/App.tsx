import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { RequireRole } from '@/components/layout/RequireRole';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { SignInModal } from '@/components/ui/SignInModal';
import { PageLoading } from '@/components/ui/States';
import { pageKey, pages } from '@/components/layout/routes';
import { useRouteScroll } from '@/hooks/useRouteScroll';
import { SaveToListDialog } from '@/features/shortlist/SaveToListDialog';

const {
  SearchPage, FreelancerDetail, ShortlistsPage, ComparePage, FreelancerLandingPage, FreelancerProfilePage, StatusPage,
  RequestsPage, ProjectBoardPage, AnalyticsPage, MessagesPage, NotificationsPage, SettingsPage, ProjectsPage,
  NewProjectPage, ProjectDetailPage, AdminQueuePage, AdminReportsPage, PrivacyPage, TermsPage, NotFoundPage,
} = pages;

function App() {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  useRouteScroll();
  const location = useLocation();

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
            {/* Keyed by page so each new page fades in; thread switches inside Messages keep the same key. */}
            <div key={pageKey(location.pathname)} className="animate-fade-in">
            <Routes location={location}>
              <Route path="/" element={<SearchPage />} />
              <Route path="/freelancer/:id" element={<FreelancerDetail />} />
              <Route path="/for-freelancers" element={<FreelancerLandingPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/:threadId" element={<MessagesPage />} />
              <Route path="/notifications" element={<RequireRole><NotificationsPage /></RequireRole>} />
              <Route path="/settings" element={<RequireRole><SettingsPage /></RequireRole>} />

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
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  );
}

export default App;
