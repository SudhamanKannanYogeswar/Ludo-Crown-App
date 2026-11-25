import { useState } from 'react';
import { Play, Sparkles, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getTodayDateString } from '../data/catalog';
import { tabletopAudio } from '../game/sound';

interface WheelSlice {
  label: string;
  coins: number;
  gems: number;
  tickets: number;
  color: string;
}

const WHEEL_SLICES: WheelSlice[] = [
  { label: '150 Coins', coins: 150, gems: 0, tickets: 0, color: '#2563EB' },
  { label: '3 Gems', coins: 0, gems: 3, tickets: 0, color: '#7C3AED' },
  { label: '300 Coins', coins: 300, gems: 0, tickets: 0, color: '#059669' },
  { label: '1 Ticket', coins: 0, gems: 0, tickets: 1, color: '#D97706' },
  { label: '200 Coins', coins: 200, gems: 0, tickets: 0, color: '#E11D48' },
  { label: '5 Gems', coins: 0, gems: 5, tickets: 0, color: '#4F46E5' },
  { label: '450 Coins', coins: 450, gems: 0, tickets: 0, color: '#0D9488' },
  { label: '1000 Jackpot', coins: 1000, gems: 2, tickets: 0, color: '#CA8A04' },
];

const FREE_SPIN_KEY = 'ludo_crown_last_free_spin_date';

export function LuckySpinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { grantWheelReward, triggerRewardedAd, showToast } = useApp();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastWon, setLastWon] = useState<WheelSlice | null>(null);
  const [freeSpinUsedToday, setFreeSpinUsedToday] = useState(() => {
    try {
      return localStorage.getItem(FREE_SPIN_KEY) === getTodayDateString();
    } catch {
      return false;
    }
  });

  if (!open) return null;

  const performSpin = (isFree: boolean) => {
    if (spinning) return;
    setSpinning(true);
    setLastWon(null);
    tabletopAudio.playDiceRoll();

    const chosenIndex = Math.floor(Math.random() * WHEEL_SLICES.length);
    const sliceAngle = 360 / WHEEL_SLICES.length;
    // Align chosen slice center directly under top pointer (0 deg)
    const targetSliceCenter = chosenIndex * sliceAngle + sliceAngle / 2;
    const extraSpins = 5 * 360;
    const nextRotation = rotation + extraSpins + (360 - ((rotation + targetSliceCenter) % 360));
    setRotation(nextRotation);

    if (isFree) {
      setFreeSpinUsedToday(true);
      try {
        localStorage.setItem(FREE_SPIN_KEY, getTodayDateString());
      } catch {
        // ignore
      }
    }

    setTimeout(async () => {
      const won = WHEEL_SLICES[chosenIndex];
      setSpinning(false);
      setLastWon(won);
      tabletopAudio.playVictory();
      await grantWheelReward(won.coins, won.gems, won.tickets);
      showToast(`Lucky Spin won: ${won.label}!`, 'success');
    }, 3400);
  };

  const handleAdSpin = () => {
    if (spinning) return;
    triggerRewardedAd('daily_bonus_coins', () => {
      performSpin(false);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Lucky Dice Spin Wheel"
    >
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto no-scrollbar rounded-3xl bg-[#14251E] border-2 border-[#3D6153] p-5 sm:p-6 shadow-2xl animate-pop-in">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#EAB957]" />
            <h2 className="font-display text-xl font-bold text-white">Lucky Crown Wheel</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={spinning}
            className="p-2 rounded-xl bg-[#1C3229] text-[#C5D5CC] hover:text-white cursor-pointer disabled:opacity-40"
            aria-label="Close Lucky Wheel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wheel Stage */}
        <div className="relative mt-6 mx-auto w-64 h-64 flex items-center justify-center">
          {/* Top Golden Pointer */}
          <div
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20"
            aria-hidden="true"
          >
            <svg width="28" height="28" viewBox="0 0 28 28">
              <polygon points="14,26 2,4 26,4" fill="#EAB957" stroke="#78350F" strokeWidth="2.5" />
            </svg>
          </div>

          {/* Outer Bezel */}
          <div className="w-64 h-64 rounded-full p-2 bg-gradient-to-b from-[#FDE68A] via-[#F59E0B] to-[#B45309] shadow-2xl shadow-black/50">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full rounded-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 3.3s cubic-bezier(0.14, 0.72, 0.12, 1)' : 'none',
              }}
            >
              {WHEEL_SLICES.map((slice, idx) => {
                const startAngle = (idx * 45 - 90) * (Math.PI / 180);
                const endAngle = ((idx + 1) * 45 - 90) * (Math.PI / 180);
                const x1 = 100 + 100 * Math.cos(startAngle);
                const y1 = 100 + 100 * Math.sin(startAngle);
                const x2 = 100 + 100 * Math.cos(endAngle);
                const y2 = 100 + 100 * Math.sin(endAngle);
                const textAngle = idx * 45 + 22.5;
                return (
                  <g key={slice.label}>
                    <path
                      d={`M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`}
                      fill={slice.color}
                      stroke="#0C1814"
                      strokeWidth="1.8"
                    />
                    <text
                      x="100"
                      y="32"
                      fill="#FFFFFF"
                      fontSize="9.5"
                      fontWeight="700"
                      textAnchor="middle"
                      transform={`rotate(${textAngle} 100 100)`}
                    >
                      {slice.label}
                    </text>
                  </g>
                );
              })}
              <circle cx="100" cy="100" r="20" fill="#0D1A15" stroke="#EAB957" strokeWidth="4" />
              <circle cx="100" cy="100" r="7" fill="#EAB957" />
            </svg>
          </div>
        </div>

        {/* Result Banner */}
        <div className="mt-5 min-h-[38px] text-center">
          {lastWon ? (
            <div className="text-base font-display font-bold text-[#EAB957] animate-pop-in">
              You won {lastWon.label}!
            </div>
          ) : (
            <div className="text-xs text-[#9BB0A5]">
              {spinning
                ? 'Spinning for coins, gems, or a free tournament pass...'
                : freeSpinUsedToday
                  ? 'Daily free spin used. Watch a short rewarded video for a bonus spin!'
                  : 'Your daily Free Spin is ready to roll!'}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-col gap-2.5">
          {!freeSpinUsedToday ? (
            <button
              type="button"
              disabled={spinning}
              onClick={() => performSpin(true)}
              className="w-full py-3 px-5 rounded-2xl font-display font-bold text-base game-btn-gold cursor-pointer disabled:opacity-50"
            >
              {spinning ? 'Spinning...' : 'FREE DAILY SPIN'}
            </button>
          ) : (
            <button
              type="button"
              disabled={spinning}
              onClick={handleAdSpin}
              className="w-full py-3 px-5 rounded-2xl font-display font-bold text-sm game-btn-green flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {spinning ? 'Spinning...' : 'Watch Ad for Bonus Spin'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
