import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6 text-center">
      <div>
        <p className="font-display text-7xl font-bold text-brand-500">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-fg">Page not found</h1>
        <p className="mt-2 text-muted">The page you’re looking for doesn’t exist.</p>
        <Link to="/dashboard">
          <Button className="mt-6">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
