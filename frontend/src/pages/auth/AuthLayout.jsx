import { Sparkles, CheckCircle2 } from 'lucide-react';
import heroImage from '../../../assets/register-page-hero.jpeg';

const FEATURES = [
  'AI captions, hashtags & ad copy in seconds',
  'On-brand image generation with smart caching',
  'Drag-and-drop content calendar & approvals',
  'Auto-publish to Facebook & Instagram',
  'Analytics, best-time-to-post & campaign ROI',
];

/**
 * Studio mark: a growth curve rising through four data nodes, framed by an open
 * arc. Square viewBox so it fills any square container edge-to-edge, and a
 * white -> violet -> cyan stroke that stays legible on the dark photo panel.
 */
function StudioMark({ className = 'h-7 w-7' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="msTrend" x1="12" y1="47" x2="51" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#DDD6FE" />
          <stop offset="1" stopColor="#67E8F9" />
        </linearGradient>
        <linearGradient id="msFrame" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#67E8F9" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient
          id="msGlow"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(51 16) scale(14)"
        >
          <stop stopColor="#67E8F9" stopOpacity="0.85" />
          <stop offset="1" stopColor="#67E8F9" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow behind the peak */}
      <circle cx="51" cy="16" r="14" fill="url(#msGlow)" />

      {/* Open frame arc */}
      <path
        d="M32 5.5a26.5 26.5 0 1 1-18.74 45.24"
        stroke="url(#msFrame)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Growth curve */}
      <path
        d="M12 47 L25.5 32.5 L37.5 40.5 L51 16"
        stroke="url(#msTrend)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data nodes */}
      <circle cx="12" cy="47" r="3.6" fill="#FFFFFF" fillOpacity="0.92" />
      <circle cx="25.5" cy="32.5" r="3.6" fill="#FFFFFF" fillOpacity="0.92" />
      <circle cx="37.5" cy="40.5" r="3.6" fill="#FFFFFF" fillOpacity="0.92" />

      {/* Peak node */}
      <circle cx="51" cy="16" r="7" fill="#FFFFFF" />
      <circle cx="51" cy="16" r="3.1" fill="#7C3AED" />
    </svg>
  );
}

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
