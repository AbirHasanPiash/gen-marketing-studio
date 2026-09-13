import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './lib/queryClient';
import { useAuth } from './store/auth';
import { Spinner } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';

/*
 * Every screen is code-split. Bundled together they produced a single ~950 kB
 * chunk that the login page had to download before it could render, most of it
 * charts and drag-and-drop code that only two screens use.
 */
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const PublicLinkBioPage = lazy(() => import('./pages/public/PublicLinkBioPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'));
const PostEditorPage = lazy(() => import('./pages/PostEditorPage'));
const BriefsPage = lazy(() => import('./pages/BriefsPage'));
const AssetsPage = lazy(() => import('./pages/AssetsPage'));
const CopyStudioPage = lazy(() => import('./pages/CopyStudioPage'));
const ImageStudioPage = lazy(() => import('./pages/ImageStudioPage'));
const CampaignsPage = lazy(() => import('./pages/CampaignsPage'));
const CompositePage = lazy(() => import('./pages/CompositePage'));
const VideoPage = lazy(() => import('./pages/VideoPage'));
const BrandsPage = lazy(() => import('./pages/BrandsPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const LinkBioBuilderPage = lazy(() => import('./pages/LinkBioBuilderPage'));
const QrPage = lazy(() => import('./pages/QrPage'));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'));
const PublishingPage = lazy(() => import('./pages/PublishingPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function Splash({ label = 'Loading your studio…' }) {
  return (
    <div className="grid min-h-[60vh] place-items-center bg-bg" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}

/** Plain <Navigate> drops the query string, which is where OAuth results ride. */
function RedirectKeepingQuery({ to }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  // Remember where they were headed, so signing in lands there and not on a
  // dashboard they never asked for.
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function Router() {
  return (
    <Suspense fallback={<Splash label="Loading…" />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="/l/:slug" element={<PublicLinkBioPage />} />

        {/* Authenticated app */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/posts/new" element={<PostEditorPage />} />
          <Route path="/posts/:id" element={<PostEditorPage />} />
          <Route path="/briefs" element={<BriefsPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/copy" element={<CopyStudioPage />} />
          <Route path="/images" element={<ImageStudioPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/composite" element={<CompositePage />} />
          <Route path="/video" element={<VideoPage />} />
          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/linkbio" element={<LinkBioBuilderPage />} />
          <Route path="/qr" element={<QrPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/settings/connections" element={<RedirectKeepingQuery to="/connections" />} />
          <Route path="/publishing" element={<PublishingPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/team" element={<TeamPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {/* Opt into the v7 behaviours now — they are the defaults in the next
            major, and without the flags React Router logs a warning per app load. */}
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Router />
        </BrowserRouter>
      </ErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          className: '!bg-card !text-fg !border !border-border !shadow-card',
          duration: 3500,
        }}
      />
    </QueryClientProvider>
  );
}
