import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui';

/**
 * Last line of defence. Without one, a render error anywhere unmounts the whole
 * tree and leaves a blank white page with nothing but a console trace.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
     
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-fg">Something broke on this screen</h1>
          <p className="mt-2 text-sm text-muted">
            The rest of the studio is fine. Reload to try again — if it keeps happening, the details are in
            the browser console.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-elevated p-3 text-left text-xs text-muted">
              {error.message}
            </pre>
          )}
          <Button className="mt-6" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" /> Reload
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
