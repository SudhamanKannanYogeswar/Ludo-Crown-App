import { useEffect, useState } from 'react';
import { getDiceThemeById, PLAYER_COLOR_META } from '../data/catalog';
import { PlayerColor } from '../types';

interface DiceControlProps {
  value: number;
  rolling: boolean;
  canRoll: boolean;
  diceThemeId: string;
  activeColor?: PlayerColor;
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
  activeColor,
  onRoll,
  label = 'ROLL DICE',
  statusSubtext,
  fullWidth = false,
}: DiceControlProps) {
  const theme = getDiceThemeById(diceThemeId);
  const [tumbleFace, setTumbleFace] = useState(6);

  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(() => {
      setTumbleFace((prev) => ((prev + Math.floor(Math.random() * 5)) % 6) + 1);
    }, 75);
    return () => clearInterval(id);
  }, [rolling]);

  const displayFace = rolling ? tumbleFace : value >= 1 && value <= 6 ? value : 6;
  const pips = PIP_POSITIONS[displayFace];
  const accentHex = activeColor ? PLAYER_COLOR_META[activeColor].fill : '#FACC15';

  return (
    <button
      type="button"
      onClick={onRoll}
      disabled={!canRoll || rolling}
      aria-label={canRoll ? label : `Dice showing ${displayFace}`}
      className={`group relative flex items-center justify-center sm:justify-start gap-3 px-4 py-2 rounded-2xl transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] min-h-[60px] ${
        fullWidth ? 'w-full' : ''
      } ${
        canRoll && !rolling
          ? 'game-btn-blue cursor-pointer'
          : 'bg-white border-2 border-[#CBD5E1] text-[#111827] cursor-not-allowed shadow-xs'
      }`}
    >
      {/* Animated Turn Arrow pointing directly at the Dice when it's your turn to roll */}
      {canRoll && !rolling && (
        <span
          aria-hidden="true"
          className="animate-turn-arrow shrink-0 flex items-center justify-center text-[#FACC15]"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M4 9h9V5l8 7-8 7v-4H4z" />
          </svg>
        </span>
      )}

      {/* Tactile Die */}
      <div
        className={`relative w-11 h-11 rounded-xl border-2 flex items-center justify-center shrink-0 shadow-xs ${
          rolling ? 'animate-dice-tumble' : ''
        }`}
        style={{
          backgroundColor: theme.faceBg,
          borderColor: '#111827',
        }}
      >
        <svg viewBox="0 0 100 100" className="w-8 h-8" aria-hidden="true">
          {pips.map(([cx, cy], idx) => (
            <circle key={idx} cx={cx} cy={cy} r="10.2" fill={theme.pipColor} />
          ))}
        </svg>
      </div>

      <div className="text-left min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {!canRoll && activeColor && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-[#111827]/40"
              style={{ backgroundColor: accentHex }}
            />
          )}
          <div
            className={`font-display text-sm sm:text-base font-extrabold whitespace-nowrap leading-tight tracking-wide ${
              canRoll && !rolling ? 'text-white' : 'text-[#111827]'
            }`}
          >
            {rolling
              ? 'ROLLING...'
              : canRoll
                ? label
                : value > 0
                  ? `ROLLED ${value}!`
                  : 'WAIT TURN'}
          </div>
        </div>
        <div
          className={`text-[11px] font-bold truncate mt-0.5 ${
            canRoll && !rolling ? 'text-[#DBEAFE]' : 'text-[#64748B]'
          }`}
        >
          {statusSubtext ||
            (canRoll
              ? 'Your Turn — Tap to Roll!'
              : value > 0
                ? 'Tap a bouncing pawn'
                : 'Opponent playing...')}
        </div>
      </div>
    </button>
  );
}
