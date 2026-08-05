import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './lib/queryClient';
import { useAuth } from './store/auth';
import { Spinner } from './components/ui';
import { AppShell } from './components/layout/AppShell';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import PublicLinkBioPage from './pages/public/PublicLinkBioPage';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import ApprovalsPage from './pages/ApprovalsPage';
import PostEditorPage from './pages/PostEditorPage';
import BriefsPage from './pages/BriefsPage';
import AssetsPage from './pages/AssetsPage';
import CopyStudioPage from './pages/CopyStudioPage';
import ImageStudioPage from './pages/ImageStudioPage';
import CampaignsPage from './pages/CampaignsPage';
import CompositePage from './pages/CompositePage';
import VideoPage from './pages/VideoPage';
import BrandsPage from './pages/BrandsPage';
import ProductsPage from './pages/ProductsPage';
import LinkBioBuilderPage from './pages/LinkBioBuilderPage';
import QrPage from './pages/QrPage';
import ConnectionsPage from './pages/ConnectionsPage';
import PublishingPage from './pages/PublishingPage';
import AnalyticsPage from './pages/AnalyticsPage';
import TeamPage from './pages/TeamPage';
import NotFoundPage from './pages/NotFoundPage';

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted">Loading your studio…</p>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
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
        <Route path="/settings/connections" element={<Navigate to="/connections" replace />} />
        <Route path="/publishing" element={<PublishingPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/team" element={<TeamPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Router />
      </BrowserRouter>
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
