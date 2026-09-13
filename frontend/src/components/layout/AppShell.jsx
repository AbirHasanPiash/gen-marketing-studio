import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ErrorBoundary } from '../ErrorBoundary';

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-bg">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8 animate-fade-in">
            {/* Scoped to the page, so one broken screen can't take the shell with it. */}
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
