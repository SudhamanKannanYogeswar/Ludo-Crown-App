import { useEffect, useState } from 'react';
import { getDiceThemeById } from '../data/catalog';

interface DiceControlProps {
  value: number;
  rolling: boolean;
  canRoll: boolean;
  diceThemeId: string;
  onRoll: () => void;
  label?: string;
  statusSubtext?: string;
  fullWidth?: boolean;
}

const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [26, 26],
    [50, 50],
    [74, 74],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [26, 26],
    [74, 26],
    [50, 50],
    [26, 74],
    [74, 74],
  ],
  6: [
    [28, 24],
    [72, 24],
    [28, 50],
    [72, 50],
    [28, 76],
    [72, 76],
  ],
};

export function DiceControl({
  value,
  rolling,
  canRoll,
  diceThemeId,
  onRoll,
  label = 'ROLL DICE',
  statusSubtext,
  fullWidth = false,
}: DiceControlProps) {
  const theme = getDiceThemeById(diceThemeId);
  const [tumbleFace, setTumbleFace] = useState(6);

  // Visually cycle real die faces during roll animation for tactile arcade feel
  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(() => {
      setTumbleFace((prev) => ((prev + Math.floor(Math.random() * 5)) % 6) + 1);
    }, 60);
    return () => clearInterval(id);
  }, [rolling]);

  const displayFace = rolling ? tumbleFace : value >= 1 && value <= 6 ? value : 6;
  const pips = PIP_POSITIONS[displayFace];

  return (
    <button
      type="button"
      onClick={onRoll}
      disabled={!canRoll || rolling}
      aria-label={canRoll ? label : `Dice showing ${displayFace}`}
      className={`group flex items-center justify-center sm:justify-start gap-3 px-4 py-2 rounded-2xl transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EAB957] min-h-[56px] ${
        fullWidth ? 'w-full' : ''
      } ${
        canRoll && !rolling
          ? 'game-btn-gold cursor-pointer'
          : 'bg-[#13231D] border border-[#2C473C] text-[#9BB0A5] cursor-not-allowed'
      }`}
    >
      <div
        className={`relative w-11 h-11 rounded-xl border-2 flex items-center justify-center shrink-0 shadow-[0_3px_8px_rgba(0,0,0,0.42),inset_0_2px_3px_rgba(255,255,255,0.35)] ${
          rolling ? 'animate-dice-tumble' : ''
        }`}
        style={{
          backgroundColor: theme.faceBg,
          borderColor: theme.borderColor,
        }}
      >
        <svg viewBox="0 0 100 100" className="w-8 h-8" aria-hidden="true">
          <rect
            x="6"
            y="6"
            width="88"
            height="88"
            rx="16"
            fill="none"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth="3"
          />
          {pips.map(([cx, cy], idx) => (
            <g key={idx}>
              <circle cx={cx} cy={cy + 1.5} r="10.2" fill="rgba(0,0,0,0.18)" />
              <circle cx={cx} cy={cy} r="9.6" fill={theme.pipColor} />
            </g>
          ))}
        </svg>
      </div>
      <div className="text-left min-w-0">
        <div className="font-display text-sm sm:text-base font-extrabold whitespace-nowrap leading-tight tracking-wide">
          {rolling ? 'ROLLING...' : canRoll ? label : value > 0 ? `ROLLED ${value}` : 'WAITING'}
        </div>
        <div
          className={`text-[11px] font-semibold truncate mt-0.5 ${
            canRoll && !rolling ? 'text-[#2B1700]/80' : 'text-[#8FA59A]'
          }`}
        >
          {statusSubtext ||
            (canRoll ? 'Tap to Roll' : value > 0 ? 'Tap a highlighted pawn' : 'Opponent turn')}
        </div>
      </div>
    </button>
  );
}
