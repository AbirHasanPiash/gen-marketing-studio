import { useId } from 'react';

/**
 * Studio mark: a growth curve rising through four data nodes, framed by an open
 * arc. Square viewBox so it fills any square container edge-to-edge, and a
 * white -> violet -> cyan stroke that stays legible on any brand-gradient tile.
 *
 * Gradient ids are namespaced per instance so multiple marks can coexist in the
 * DOM (e.g. the desktop sidebar and the open mobile drawer) without colliding.
 */
export function StudioMark({ className = 'h-7 w-7' }) {
  const uid = useId().replace(/:/g, '');
  const trendId = `msTrend-${uid}`;
  const frameId = `msFrame-${uid}`;
  const glowId = `msGlow-${uid}`;

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
        <linearGradient id={trendId} x1="12" y1="47" x2="51" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#DDD6FE" />
          <stop offset="1" stopColor="#67E8F9" />
        </linearGradient>
        <linearGradient id={frameId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#67E8F9" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient
          id={glowId}
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
      <circle cx="51" cy="16" r="14" fill={`url(#${glowId})`} />

      {/* Open frame arc */}
      <path
        d="M32 5.5a26.5 26.5 0 1 1-18.74 45.24"
        stroke={`url(#${frameId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Growth curve */}
      <path
        d="M12 47 L25.5 32.5 L37.5 40.5 L51 16"
        stroke={`url(#${trendId})`}
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

export default StudioMark;
