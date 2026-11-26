/**
 * Luminous AAA Casual-Game Animated Backdrop
 * Sunlit sky-blue to warm cream canvas with slow-spinning radial sunburst rays,
 * crisp comic halftone dots, bright Ludo primary color corner glows,
 * and floating translucent dice, pawn, and golden star graphic overlays.
 */
export function AnimatedGameBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
      style={{
        background:
          'linear-gradient(180deg, #CFEBFF 0%, #EAF7FF 36%, #FFFDF0 74%, #E6F6FF 100%)',
      }}
    >
      {/* Slow-spinning sunlit radial burst rays */}
      <div
        className="absolute -top-[42vmax] left-1/2 -translate-x-1/2 w-[135vmax] h-[135vmax] opacity-[0.28] animate-sun-spin"
        style={{
          background:
            'repeating-conic-gradient(from 0deg, rgba(255, 255, 255, 0.85) 0deg 12deg, transparent 12deg 24deg)',
        }}
      />

      {/* Crisp comic halftone tabletop dot grid */}
      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage: 'radial-gradient(#93C5FD 1.15px, transparent 1.15px)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* Bright Ludo 4-color ambient corner blooms */}
      <div
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-55"
        style={{ background: 'radial-gradient(circle, #7DD3FC 0%, transparent 70%)' }}
      />
      <div
        className="absolute -top-20 -right-24 w-96 h-96 rounded-full blur-3xl opacity-55"
        style={{ background: 'radial-gradient(circle, #FDE047 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-24 -left-20 w-96 h-96 rounded-full blur-3xl opacity-40"
        style={{ background: 'radial-gradient(circle, #FDA4AF 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-24 -right-20 w-96 h-96 rounded-full blur-3xl opacity-45"
        style={{ background: 'radial-gradient(circle, #6EE7B7 0%, transparent 70%)' }}
      />

      {/* Floating Animated Graphic Overlays (Dice, Ludo Pawns & Twinkling Stars) */}
      {/* Top-left floating glossy die */}
      <svg
        viewBox="0 0 64 64"
        className="absolute top-[11%] left-[3%] w-12 h-12 sm:w-14 sm:h-14 opacity-[0.34] animate-float-drift"
      >
        <rect
          x="6"
          y="6"
          width="52"
          height="52"
          rx="14"
          fill="#FFFFFF"
          stroke="#1D4ED8"
          strokeWidth="3.5"
        />
        <circle cx="22" cy="22" r="4.5" fill="#2563EB" />
        <circle cx="42" cy="22" r="4.5" fill="#2563EB" />
        <circle cx="32" cy="32" r="4.8" fill="#FF2E54" />
        <circle cx="22" cy="42" r="4.5" fill="#2563EB" />
        <circle cx="42" cy="42" r="4.5" fill="#2563EB" />
      </svg>

      {/* Top-right floating golden star */}
      <svg
        viewBox="0 0 48 48"
        className="absolute top-[13%] right-[5%] w-10 h-10 sm:w-12 sm:h-12 opacity-60 animate-sparkle"
      >
        <path
          d="M24 2 L29.5 18.5 L46 24 L29.5 29.5 L24 46 L18.5 29.5 L2 24 L18.5 18.5 Z"
          fill="#FFE033"
          stroke="#D97706"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Mid-left floating Red Ludo pawn */}
      <svg
        viewBox="0 0 64 76"
        className="hidden sm:block absolute top-[46%] left-[2.5%] w-11 h-13 opacity-[0.28] animate-float-drift-alt"
      >
        <circle cx="32" cy="20" r="14" fill="#FF2E54" stroke="#111827" strokeWidth="3" />
        <path
          d="M15 62 C17 42, 47 42, 49 62 Z"
          fill="#FF2E54"
          stroke="#111827"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <ellipse cx="32" cy="64" rx="20" ry="6" fill="#E11D48" stroke="#111827" strokeWidth="3" />
      </svg>

      {/* Mid-right floating Emerald Ludo pawn */}
      <svg
        viewBox="0 0 64 76"
        className="hidden sm:block absolute top-[52%] right-[3%] w-11 h-13 opacity-[0.28] animate-float-drift"
        style={{ animationDelay: '1.4s' }}
      >
        <circle cx="32" cy="20" r="14" fill="#10E587" stroke="#111827" strokeWidth="3" />
        <path
          d="M15 62 C17 42, 47 42, 49 62 Z"
          fill="#10E587"
          stroke="#111827"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <ellipse cx="32" cy="64" rx="20" ry="6" fill="#059669" stroke="#111827" strokeWidth="3" />
      </svg>

      {/* Bottom-left twinkling star */}
      <svg
        viewBox="0 0 48 48"
        className="absolute bottom-[14%] left-[6%] w-8 h-8 opacity-55 animate-sparkle"
        style={{ animationDelay: '1.1s' }}
      >
        <path
          d="M24 3 L28.8 19.2 L45 24 L28.8 28.8 L24 45 L19.2 28.8 L3 24 L19.2 19.2 Z"
          fill="#38BDF8"
          stroke="#1D4ED8"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Bottom-right floating sunny gold die */}
      <svg
        viewBox="0 0 64 64"
        className="absolute bottom-[13%] right-[4%] w-11 h-11 sm:w-13 sm:h-13 opacity-[0.34] animate-float-drift-alt"
        style={{ animationDelay: '0.8s' }}
      >
        <rect
          x="6"
          y="6"
          width="52"
          height="52"
          rx="14"
          fill="#FFE84D"
          stroke="#B45309"
          strokeWidth="3.5"
        />
        <circle cx="22" cy="20" r="4.2" fill="#111827" />
        <circle cx="42" cy="20" r="4.2" fill="#111827" />
        <circle cx="22" cy="32" r="4.2" fill="#111827" />
        <circle cx="42" cy="32" r="4.2" fill="#111827" />
        <circle cx="22" cy="44" r="4.2" fill="#111827" />
        <circle cx="42" cy="44" r="4.2" fill="#111827" />
      </svg>
    </div>
  );
}
