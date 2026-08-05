import { Sparkles, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  'AI captions, hashtags & ad copy in seconds',
  'On-brand image generation with smart caching',
  'Drag-and-drop content calendar & approvals',
  'Auto-publish to Facebook & Instagram',
  'Analytics, best-time-to-post & campaign ROI',
];

export function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-bg">
      {/* Marketing panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-12 text-white">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 -left-24 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="font-display text-xl font-bold">mkt_studio</p>
            <p className="text-sm text-white/70">AI Marketing Studio</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Your entire social workflow,
            <br />
            powered by AI.
          </h2>
          <p className="mt-4 max-w-md text-white/80">
            Built for local brands — from creative brief to published post to performance analytics.
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-white/90">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-white" />
                <span className="text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/60">Made in Bangladesh 🇧🇩 · CSE471 Project</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold text-fg">mkt_studio</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-fg">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
