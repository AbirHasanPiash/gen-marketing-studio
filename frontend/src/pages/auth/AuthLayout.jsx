import { CheckCircle2 } from 'lucide-react';
import { StudioMark } from '../../components/ui';
import heroImage from '../../../assets/register-page-hero.jpeg';

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
      <div className="relative hidden overflow-hidden bg-brand-950 p-8 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
        {/* Hero photo. Lazy so mobile (panel hidden below lg) never downloads it. */}
        <img
          src={heroImage}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Brand tint keeps the panel on-palette over the photo */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-950/85 via-brand-900/60 to-brand-800/80" />
        {/* Top + bottom scrim so white text stays readable against the busy midtones */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-slate-950/60" />
        {/* Ambient bloom */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-white/25 to-white/5 shadow-lg shadow-brand-950/50 ring-1 ring-inset ring-white/25 backdrop-blur-md">
            <StudioMark className="h-7 w-7" />
          </div>
          <div>
            <p className="font-display text-xl font-bold tracking-tight">mkt_studio</p>
            <p className="text-sm text-white/70">AI Marketing Studio</p>
          </div>
        </div>

        <div className="relative z-10">
          <h2 className="font-display text-3xl font-bold leading-tight xl:text-4xl 2xl:text-5xl">
            Your entire social workflow,
            <br />
            powered by AI.
          </h2>
          <p className="mt-4 max-w-md text-white/80">
            Built for local brands - from creative brief to published post to performance analytics.
          </p>
          <ul className="mt-6 space-y-2.5 xl:mt-8 xl:space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-white/90">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-white" />
                <span className="text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <StudioMark className="h-5 w-5" />
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
