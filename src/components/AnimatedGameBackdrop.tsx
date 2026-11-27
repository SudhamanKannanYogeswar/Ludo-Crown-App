import { getBackdropThemeById } from '../data/catalog';

interface AnimatedGameBackdropProps {
  backdropThemeId?: string;
}

/**
 * Luminous AAA Casual-Game Animated Backdrop
 * Supports 5 subtle multi-color atmosphere variations while preserving the
 * slow-spinning radial sunburst rays, halftone dot texture, soft 4-color
 * corner glows, and floating animated dice, Ludo pawns, and twinkling stars.
 */
export function AnimatedGameBackdrop({
  backdropThemeId = 'backdrop_sky',
}: AnimatedGameBackdropProps) {
  const theme = getBackdropThemeById(backdropThemeId);
  const isDark = Boolean(theme.isDark);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none transition-all duration-500"
      style={{
        background: theme.canvasGradient,
      }}
    >
      {/* Slow-spinning sunlit radial burst rays */}
      <div
        className={`absolute -top-[42vmax] left-1/2 -translate-x-1/2 w-[135vmax] h-[135vmax] animate-sun-spin ${
          isDark ? 'opacity-[0.22]' : 'opacity-[0.28]'
        }`}
        style={{
          background: `repeating-conic-gradient(from 0deg, ${theme.rayColor} 0deg 12deg, transparent 12deg 24deg)`,
        }}
      />

      {/* Crisp comic halftone tabletop dot grid */}
      <div
        className={`absolute inset-0 ${isDark ? 'opacity-20' : 'opacity-45'}`}
        style={{
          backgroundImage: `radial-gradient(${theme.dotColor} 1.15px, transparent 1.15px)`,
          backgroundSize: '22px 22px',
        }}
      />

      {/* Subtle 4-color ambient corner blooms */}
      <div
        className={`absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl transition-all duration-500 ${
          isDark ? 'opacity-35' : 'opacity-55'
        }`}
        style={{
          background: `radial-gradient(circle, ${theme.bloomColors[0]} 0%, transparent 70%)`,
        }}
      />
      <div
        className={`absolute -top-20 -right-24 w-96 h-96 rounded-full blur-3xl transition-all duration-500 ${
          isDark ? 'opacity-30' : 'opacity-55'
        }`}
        style={{
          background: `radial-gradient(circle, ${theme.bloomColors[1]} 0%, transparent 70%)`,
        }}
      />
      <div
        className={`absolute -bottom-24 -left-20 w-96 h-96 rounded-full blur-3xl transition-all duration-500 ${
          isDark ? 'opacity-30' : 'opacity-42'
        }`}
        style={{
          background: `radial-gradient(circle, ${theme.bloomColors[2]} 0%, transparent 70%)`,
        }}
      />
      <div
        className={`absolute -bottom-24 -right-20 w-96 h-96 rounded-full blur-3xl transition-all duration-500 ${
          isDark ? 'opacity-30' : 'opacity-45'
        }`}
        style={{
          background: `radial-gradient(circle, ${theme.bloomColors[3]} 0%, transparent 70%)`,
        }}
      />

      {/* Floating Animated Graphic Overlays (Dice, Ludo Pawns & Twinkling Stars) */}
      {/* Top-left floating glossy die */}
      <svg
        viewBox="0 0 64 64"
        className={`absolute top-[11%] left-[3%] w-12 h-12 sm:w-14 sm:h-14 animate-float-drift ${
          isDark ? 'opacity-[0.42]' : 'opacity-[0.34]'
        }`}
      >
        <rect
          x="6"
          y="6"
          width="52"
          height="52"
          rx="14"
          fill={theme.diePrimaryFill}
          stroke={theme.diePrimaryStroke}
          strokeWidth="3.5"
        />
        <circle cx="22" cy="22" r="4.5" fill={theme.diePrimaryPip} />
        <circle cx="42" cy="22" r="4.5" fill={theme.diePrimaryPip} />
        <circle cx="32" cy="32" r="4.8" fill="#FF2E54" />
        <circle cx="22" cy="42" r="4.5" fill={theme.diePrimaryPip} />
        <circle cx="42" cy="42" r="4.5" fill={theme.diePrimaryPip} />
      </svg>

      {/* Top-right floating golden star */}
      <svg
        viewBox="0 0 48 48"
        className={`absolute top-[13%] right-[5%] w-10 h-10 sm:w-12 sm:h-12 animate-sparkle ${
          isDark ? 'opacity-75' : 'opacity-60'
        }`}
      >
        <path
          d="M24 2 L29.5 18.5 L46 24 L29.5 29.5 L24 46 L18.5 29.5 L2 24 L18.5 18.5 Z"
          fill={theme.starFill}
          stroke={theme.starStroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Mid-left floating Red Ludo pawn */}
      <svg
        viewBox="0 0 64 76"
        className={`hidden sm:block absolute top-[46%] left-[2.5%] w-11 h-13 animate-float-drift-alt ${
          isDark ? 'opacity-[0.36]' : 'opacity-[0.28]'
        }`}
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
        className={`hidden sm:block absolute top-[52%] right-[3%] w-11 h-13 animate-float-drift ${
          isDark ? 'opacity-[0.36]' : 'opacity-[0.28]'
        }`}
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

      {/* Bottom-left twinkling accent star */}
      <svg
        viewBox="0 0 48 48"
        className={`absolute bottom-[14%] left-[6%] w-8 h-8 animate-sparkle ${
          isDark ? 'opacity-70' : 'opacity-55'
        }`}
        style={{ animationDelay: '1.1s' }}
      >
        <path
          d="M24 3 L28.8 19.2 L45 24 L28.8 28.8 L24 45 L19.2 28.8 L3 24 L19.2 19.2 Z"
          fill={theme.starAltFill}
          stroke={theme.starAltStroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Bottom-right floating sunny gold die */}
      <svg
        viewBox="0 0 64 64"
        className={`absolute bottom-[13%] right-[4%] w-11 h-11 sm:w-13 sm:h-13 animate-float-drift-alt ${
          isDark ? 'opacity-[0.42]' : 'opacity-[0.34]'
        }`}
        style={{ animationDelay: '0.8s' }}
      >
        <rect
          x="6"
          y="6"
          width="52"
          height="52"
          rx="14"
          fill={theme.dieSecondaryFill}
          stroke={theme.dieSecondaryStroke}
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
