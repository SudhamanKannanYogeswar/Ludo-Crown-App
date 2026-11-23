import { getDiceThemeById } from '../data/catalog';

interface DiceControlProps {
  value: number;
  rolling: boolean;
  canRoll: boolean;
  diceThemeId: string;
  onRoll: () => void;
  label?: string;
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
  label = 'Roll Dice',
}: DiceControlProps) {
  const theme = getDiceThemeById(diceThemeId);
  const displayFace = value >= 1 && value <= 6 ? value : 6;
  const pips = PIP_POSITIONS[displayFace];

  return (
    <button
      type="button"
      onClick={onRoll}
      disabled={!canRoll || rolling}
      aria-label={canRoll ? label : `Dice showing ${displayFace}`}
      className={`group flex items-center gap-3.5 px-4 py-2.5 rounded-xl border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A446] min-h-[56px] ${
        canRoll && !rolling
          ? 'bg-[#D4A446] border-[#E7C272] text-[#0B231B] hover:bg-[#E1B45B] active:scale-[0.98] cursor-pointer shadow-lg shadow-black/25'
          : 'bg-[#123026] border-[#264B3C] text-[#9EB5AA] cursor-not-allowed'
      }`}
    >
      <div
        className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center shrink-0 shadow-inner ${
          rolling ? 'animate-dice-tumble' : ''
        }`}
        style={{
          backgroundColor: theme.faceBg,
          borderColor: theme.borderColor,
        }}
      >
        <svg viewBox="0 0 100 100" className="w-9 h-9" aria-hidden="true">
          {pips.map(([cx, cy], idx) => (
            <circle key={idx} cx={cx} cy={cy} r="10.5" fill={theme.pipColor} />
          ))}
        </svg>
      </div>
      <div className="text-left">
        <div className="text-sm font-semibold whitespace-nowrap leading-tight">
          {rolling ? 'Rolling...' : canRoll ? label : value > 0 ? `Rolled ${value}` : 'Waiting'}
        </div>
        <div
          className={`text-xs whitespace-nowrap mt-0.5 ${
            canRoll && !rolling ? 'text-[#0B231B]/80' : 'text-[#7F9B8E]'
          }`}
        >
          {canRoll ? 'Tap or press Space' : value > 0 ? 'Select token or next turn' : 'Opponent turn'}
        </div>
      </div>
    </button>
  );
}
