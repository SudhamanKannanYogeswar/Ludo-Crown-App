import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Coins,
  Crown,
  Gift,
  KeyRound,
  PlusSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  getTodayDateString,
  HERO_STUDIO_BOARD_IMAGE,
  MODE_DUEL1V1_IMAGE,
  MODE_QUICK4P_IMAGE,
  MODE_VSBOT_IMAGE,
} from '../data/catalog';
import { AiDifficulty, GameMode } from '../types';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'PL';
}

const FRIEND_BADGE_STYLES = [
  'bg-gradient-to-b from-[#FF5E7E] to-[#E11D48] text-white',
  'bg-gradient-to-b from-[#34F59F] to-[#059669] text-white',
  'bg-gradient-to-b from-[#FFF066] to-[#F59E0B] text-[#111827]',
  'bg-gradient-to-b from-[#38BDF8] to-[#1D4ED8] text-white',
];

interface LobbyViewProps {
  onOpenWheel: () => void;
  onOpenAdPolicy: () => void;
}

export function LobbyView({ onOpenWheel, onOpenAdPolicy }: LobbyViewProps) {
  const {
    isSignedIn,
    profile,
    wallet,
    openRooms,
    refreshOpenRooms,
    startQuickMatchmaking,
    createPrivateRoom,
    joinRoom,
    launchOfflinePractice,
    claimDailyStreak,
    triggerRewardedAd,
    signInWithGoogle,
    setActiveTab,
    showToast,
    friendships,
    incomingInvites,
    inviteFriendToPlay,
    acceptRoomInvite,
    declineRoomInvite,
  } = useApp();

  const [mode, setMode] = useState<GameMode>('quick');
  const [playerCount, setPlayerCount] = useState<2 | 4>(4);
  const [stake, setStake] = useState<100 | 250 | 500>(100);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('tactical');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (isSignedIn) {
      refreshOpenRooms().catch(() => {});
    }
  }, [isSignedIn, refreshOpenRooms]);

  const today = getTodayDateString();
  const dailyChestReady = wallet.lastDailyClaimDate !== today;

  const acceptedFriends = useMemo(
    () => friendships.filter((f) => f.status === 'accepted'),
    [friendships]
  );

  const handleCreatePrivate = async () => {
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setBusyAction('private');
    try {
      await createPrivateRoom({ mode, maxPlayers: playerCount, entryStake: stake });
    } finally {
      setBusyAction(null);
    }
  };

  const handleQuickOnlineMode = async (targetPlayers: 2 | 4) => {
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setBusyAction(targetPlayers === 4 ? 'quick4' : 'duel2');
    try {
      await startQuickMatchmaking({ mode, maxPlayers: targetPlayers, entryStake: stake });
    } finally {
      setBusyAction(null);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length !== 6) return;
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setBusyAction('join');
    try {
      await joinRoom(cleaned);
      setJoinCode('');
      setJoinModalOpen(false);
    } finally {
      setBusyAction(null);
    }
  };

  const handleInviteFriend = async (friendUid: string, friendName: string) => {
    setBusyAction(`invite_${friendUid}`);
    try {
      await inviteFriendToPlay(friendUid, friendName);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-4 pb-8">
      {/* Live Incoming Room Invite Banner right at the top of Home */}
      {incomingInvites.length > 0 && (
        <div className="mb-4 rounded-3xl bg-gradient-to-r from-[#FFF066] via-[#FDE047] to-[#FEF08A] border-2 border-[#111827] shadow-[0_5px_0_#111827] px-4 py-3 flex items-center justify-between gap-3 animate-pop-in animate-pulse-glow-gold">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#FF5E7E] to-[#E11D48] text-white border-2 border-[#111827] font-display font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              {getInitials(incomingInvites[0].fromName)}
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-extrabold text-[#111827] truncate">
                {incomingInvites[0].fromName} invited you to a table!
              </div>
              <div className="font-mono text-xs text-[#334155] font-bold truncate">
                Room {incomingInvites[0].roomCode} · {incomingInvites[0].seatsCount}/
                {incomingInvites[0].maxPlayers} seats
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => acceptRoomInvite(incomingInvites[0])}
              className="px-4 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-blue btn-gloss-sheen cursor-pointer"
            >
              Join
            </button>
            <button
              type="button"
              onClick={() => declineRoomInvite(incomingInvites[0].id)}
              className="p-1.5 rounded-xl bg-white border-2 border-[#111827] text-[#475569] hover:text-[#E11D48] cursor-pointer"
              aria-label="Dismiss invite"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Layout: Single crisp column on mobile, clean 12-col split on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT / PRIMARY COLUMN (7 cols on desktop): Hero Card + More Ways to Play */}
        <div className="lg:col-span-7 space-y-5">
          {/* TOP HERO CARD: Vivid Animated AAA Game Showcase + Play with friends */}
          <section className="studio-card rounded-3xl p-4 sm:p-5 space-y-4">
            {/* Illustrated Board Showcase (~Top 1/3rd on Mobile) with Animated Graphic Overlays */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#111827] bg-gradient-to-br from-[#38BDF8] via-[#60A5FA] to-[#FACC15] h-[24dvh] min-h-[168px] max-h-[240px] shadow-[inset_0_2px_0_rgba(255,255,255,0.6)]">
              <img
                src={HERO_STUDIO_BOARD_IMAGE}
                alt="Ludo Crown Festive Arcade Tabletop Board"
                draggable={false}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center select-none animate-art-breathe"
              />

              {/* Rotating Sunlit Radial Burst Overlay */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-[45%] opacity-35 mix-blend-soft-light animate-sun-spin"
                style={{
                  background:
                    'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.9) 0deg 14deg, transparent 14deg 28deg)',
                }}
              />

              {/* Glossy Diagonal Shine Sweep */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent animate-shine-sweep"
              />

              {/* Subtle Bottom Rim Gradient for Crisp Overlay Pop */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0F172A]/25 to-transparent"
              />

              {/* Twinkling Golden Graphic Star Overlays */}
              <svg
                aria-hidden="true"
                viewBox="0 0 36 36"
                className="pointer-events-none absolute top-11 left-5 w-6 h-6 drop-shadow-[0_2px_3px_rgba(17,24,39,0.35)] animate-sparkle"
              >
                <path
                  d="M18 2 L22 14 L34 18 L22 22 L18 34 L14 22 L2 18 L14 14 Z"
                  fill="#FFF066"
                  stroke="#111827"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <svg
                aria-hidden="true"
                viewBox="0 0 36 36"
                className="pointer-events-none absolute top-4 left-[44%] w-5 h-5 drop-shadow-[0_2px_3px_rgba(17,24,39,0.35)] animate-sparkle"
                style={{ animationDelay: '0.9s' }}
              >
                <path
                  d="M18 2 L22 14 L34 18 L22 22 L18 34 L14 22 L2 18 L14 14 Z"
                  fill="#FFFFFF"
                  stroke="#1D4ED8"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <svg
                aria-hidden="true"
                viewBox="0 0 36 36"
                className="pointer-events-none absolute bottom-12 right-16 w-5 h-5 drop-shadow-[0_2px_3px_rgba(17,24,39,0.35)] animate-sparkle"
                style={{ animationDelay: '1.5s' }}
              >
                <path
                  d="M18 2 L22 14 L34 18 L22 22 L18 34 L14 22 L2 18 L14 14 Z"
                  fill="#FFE033"
                  stroke="#B45309"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Animated Brand Crown Badge Top-Left */}
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-b from-[#FFF066] to-[#FACC15] border-2 border-[#111827] shadow-[0_3px_0_#111827]">
                <Crown className="w-3.5 h-3.5 text-[#E11D48] fill-[#E11D48] animate-badge-bob" />
                <span className="font-display text-xs font-black tracking-tight text-[#111827]">
                  LUDO CROWN
                </span>
              </div>

              {/* Match Options Trigger Top-Right */}
              <button
                type="button"
                onClick={() => setOptionsModalOpen(true)}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 hover:bg-[#FEF08A] border-2 border-[#111827] shadow-[0_3px_0_#111827] text-[11px] font-display font-extrabold text-[#111827] cursor-pointer transition-colors"
                title="Change Rules, Players & Stake"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>
                  {playerCount}P · {mode === 'quick' ? 'Quick' : 'Classic'}
                </span>
              </button>

              {/* Playful Bouncing 3D Corner Die Bottom-Right */}
              <div
                aria-hidden="true"
                className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-xl bg-gradient-to-br from-white via-[#FFFDF5] to-[#E0F2FE] border-2 border-[#111827] shadow-[0_4px_0_#111827] grid grid-cols-3 grid-rows-3 p-1.5 gap-0.5 animate-die-hop"
              >
                <span className="w-2 h-2 rounded-full bg-[#2563EB] self-center justify-self-center" />
                <span />
                <span className="w-2 h-2 rounded-full bg-[#10B981] self-center justify-self-center" />
                <span />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF2E54] self-center justify-self-center shadow-xs" />
                <span />
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] self-center justify-self-center" />
                <span />
                <span className="w-2 h-2 rounded-full bg-[#2563EB] self-center justify-self-center" />
              </div>
            </div>

            {/* Play with friends Heading + Private Pill */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <h1 className="font-display text-2xl font-extrabold text-[#111827] tracking-tight">
                  Play with friends
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-b from-[#DCFCE7] to-[#A7F3D0] border-2 border-[#059669] text-[11px] font-display font-extrabold text-[#065F46] shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  Private
                </span>
              </div>
              <p className="text-sm text-[#475569] mt-1">
                Host a private 2 to 4 player table, invite your squad, or join by room code.
              </p>
            </div>

            {/* Primary Dual Buttons: Create room (Glossy Sky-Blue) + Join code (Sunburst Gold) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleCreatePrivate}
                className="py-3 px-3 rounded-2xl game-btn-blue btn-gloss-sheen font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <PlusSquare className="w-4 h-4 shrink-0" />
                <span>{busyAction === 'private' ? 'Creating...' : 'Create room'}</span>
              </button>

              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => setJoinModalOpen(true)}
                className="py-3 px-3 rounded-2xl game-btn-gold btn-gloss-sheen font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>Join code</span>
              </button>
            </div>
          </section>

          {/* MORE WAYS TO PLAY: 3 Vibrant Illustrated Tactile Mode Cards */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-[#111827]">
                More ways to play
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-white/90 border border-[#CBD5E1] text-[11px] font-display font-extrabold text-[#1D4ED8]">
                3 modes
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleQuickOnlineMode(4)}
                className="group relative overflow-hidden rounded-3xl p-3.5 text-left bg-gradient-to-b from-[#FFF2F5] via-[#FFE4EB] to-[#FFD1DF] border-2 border-[#111827] shadow-[0_4px_0_#111827,0_8px_16px_rgba(225,29,72,0.14)] hover:-translate-y-1 active:translate-y-0.5 transition-transform cursor-pointer disabled:opacity-60 flex flex-col justify-between min-h-[132px]"
              >
                <div className="relative w-13 h-13 rounded-2xl border-2 border-[#111827] shadow-[0_3px_0_#111827] overflow-hidden bg-[#FF2E54] animate-badge-bob">
                  <img
                    src={MODE_QUICK4P_IMAGE}
                    alt="Quick 4P"
                    draggable={false}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover scale-[1.15] group-hover:scale-[1.24] transition-transform duration-200"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/45 to-transparent"
                  />
                </div>
                <div className="mt-3">
                  <div className="font-display text-sm sm:text-base font-extrabold text-[#111827] leading-tight">
                    {busyAction === 'quick4' ? 'Matching...' : 'Quick 4P'}
                  </div>
                  <div className="text-[11px] font-bold text-[#BE123C] mt-0.5">Fast online</div>
                </div>
              </button>

              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleQuickOnlineMode(2)}
                className="group relative overflow-hidden rounded-3xl p-3.5 text-left bg-gradient-to-b from-[#ECFFF6] via-[#D1FAE5] to-[#A7F3D0] border-2 border-[#111827] shadow-[0_4px_0_#111827,0_8px_16px_rgba(16,185,129,0.14)] hover:-translate-y-1 active:translate-y-0.5 transition-transform cursor-pointer disabled:opacity-60 flex flex-col justify-between min-h-[132px]"
              >
                <div
                  className="relative w-13 h-13 rounded-2xl border-2 border-[#111827] shadow-[0_3px_0_#111827] overflow-hidden bg-[#10B981] animate-badge-bob"
                  style={{ animationDelay: '0.45s' }}
                >
                  <img
                    src={MODE_DUEL1V1_IMAGE}
                    alt="1v1 Duel"
                    draggable={false}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover scale-[1.12] group-hover:scale-[1.22] transition-transform duration-200"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/45 to-transparent"
                  />
                </div>
                <div className="mt-3">
                  <div className="font-display text-sm sm:text-base font-extrabold text-[#111827] leading-tight">
                    {busyAction === 'duel2' ? 'Matching...' : '1v1 Duel'}
                  </div>
                  <div className="text-[11px] font-bold text-[#047857] mt-0.5">Head to head</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  launchOfflinePractice({
                    mode,
                    playerCount,
                    difficulty: aiDifficulty,
                  })
                }
                className="group relative overflow-hidden rounded-3xl p-3.5 text-left bg-gradient-to-b from-[#EFF8FF] via-[#DBEAFE] to-[#BFDBFE] border-2 border-[#111827] shadow-[0_4px_0_#111827,0_8px_16px_rgba(37,99,235,0.14)] hover:-translate-y-1 active:translate-y-0.5 transition-transform cursor-pointer flex flex-col justify-between min-h-[132px]"
              >
                <div
                  className="relative w-13 h-13 rounded-2xl border-2 border-[#111827] shadow-[0_3px_0_#111827] overflow-hidden bg-[#2563EB] animate-badge-bob"
                  style={{ animationDelay: '0.9s' }}
                >
                  <img
                    src={MODE_VSBOT_IMAGE}
                    alt="VS Computer"
                    draggable={false}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover scale-[1.15] group-hover:scale-[1.24] transition-transform duration-200"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/45 to-transparent"
                  />
                </div>
                <div className="mt-3">
                  <div className="font-display text-sm sm:text-base font-extrabold text-[#111827] leading-tight">
                    VS Computer
                  </div>
                  <div className="text-[11px] font-bold text-[#1D4ED8] mt-0.5">Play offline</div>
                </div>
              </button>
            </div>
          </section>

          {/* Compact Vivid Bonus & Cups Strip */}
          <section className="grid grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => (dailyChestReady ? claimDailyStreak() : setActiveTab('rewards'))}
              className={`rounded-2xl p-2.5 border-2 border-[#111827] shadow-[0_4px_0_#111827] text-center cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0.5 flex flex-col items-center justify-center ${
                dailyChestReady
                  ? 'bg-gradient-to-b from-[#FFF599] to-[#FDE047] animate-chest-wiggle'
                  : 'bg-gradient-to-b from-[#FFFDF0] to-[#FEF9C3]'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#FFE84D] to-[#F59E0B] border-2 border-[#111827] flex items-center justify-center text-[#111827] shadow-xs">
                <Gift className="w-4 h-4" />
              </div>
              <span className="mt-1.5 font-display text-[11px] font-extrabold text-[#111827] truncate">
                {dailyChestReady ? 'Claim Gift' : 'Daily Gift'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenWheel}
              className="rounded-2xl p-2.5 bg-gradient-to-b from-[#FFF1F5] to-[#FFE4EC] border-2 border-[#111827] shadow-[0_4px_0_#111827] text-center cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0.5 flex flex-col items-center justify-center"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#FF5E7E] to-[#E11D48] border-2 border-[#111827] flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4 animate-wheel-spin-idle" />
              </div>
              <span className="mt-1.5 font-display text-[11px] font-extrabold text-[#111827] truncate">
                Lucky Spin
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tournaments')}
              className="rounded-2xl p-2.5 bg-gradient-to-b from-[#EFF8FF] to-[#DBEAFE] border-2 border-[#111827] shadow-[0_4px_0_#111827] text-center cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0.5 flex flex-col items-center justify-center"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#38BDF8] to-[#1D4ED8] border-2 border-[#111827] flex items-center justify-center text-white shadow-xs">
                <Trophy className="w-4 h-4 animate-badge-bob" />
              </div>
              <span className="mt-1.5 font-display text-[11px] font-extrabold text-[#111827] truncate">
                Cups ({wallet.freeTournamentTickets})
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerRewardedAd('daily_bonus_coins', () => {
                  showToast('+250 Coins credited!', 'success');
                })
              }
              className="rounded-2xl p-2.5 bg-gradient-to-b from-[#ECFFF6] to-[#CCFBF1] border-2 border-[#111827] shadow-[0_4px_0_#111827] text-center cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0.5 flex flex-col items-center justify-center"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#34F59F] to-[#059669] border-2 border-[#111827] flex items-center justify-center text-white shadow-xs">
                <Coins className="w-4 h-4" />
              </div>
              <span className="mt-1.5 font-display text-[11px] font-extrabold text-[#111827] truncate">
                +250 Free
              </span>
            </button>
          </section>
        </div>

        {/* RIGHT / SECONDARY COLUMN (5 cols on desktop): Friends online + Live Open Tables */}
        <div className="lg:col-span-5 space-y-5">
          {/* FRIENDS ONLINE SECTION (Matches Image 1 Bottom) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-extrabold text-[#111827]">
                  Friends online
                </h2>
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#E11D48] text-white text-xs font-mono font-extrabold border border-[#111827]">
                  {acceptedFriends.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className="text-xs font-display font-extrabold text-[#1D4ED8] hover:underline cursor-pointer"
              >
                See all
              </button>
            </div>

            {!isSignedIn ? (
              <div className="studio-card-soft rounded-3xl p-4 text-center space-y-2.5">
                <p className="text-xs text-[#475569]">
                  Sign in with Google to add friends and send instant room invites.
                </p>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-4 py-2 rounded-xl font-display font-extrabold text-xs game-btn-blue cursor-pointer"
                >
                  Sign In with Google
                </button>
              </div>
            ) : acceptedFriends.length === 0 ? (
              <div className="studio-card-soft rounded-3xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-sm font-extrabold text-[#111827]">
                    Invite your squad
                  </div>
                  <div className="text-xs text-[#64748B]">
                    Find players by name or #tag in Friends.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('friends')}
                  className="px-3.5 py-2 rounded-xl font-display font-extrabold text-xs game-btn-white cursor-pointer shrink-0"
                >
                  Add friends
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {acceptedFriends.slice(0, 4).map((f, idx) => {
                  const isRequester = f.requesterUid === profile.uid;
                  const friendUid = isRequester ? f.recipientUid : f.requesterUid;
                  const friendName = isRequester ? f.recipientName : f.requesterName;
                  const badgeStyle = FRIEND_BADGE_STYLES[idx % FRIEND_BADGE_STYLES.length];
                  const sending = busyAction === `invite_${friendUid}`;
                  return (
                    <div
                      key={f.id}
                      className="studio-card-soft hover:border-[#111827] transition-colors rounded-2xl px-3.5 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div
                            className={`w-10 h-10 rounded-full border-2 border-[#111827] ${badgeStyle} font-display font-black text-xs flex items-center justify-center`}
                          >
                            {getInitials(friendName)}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10E587] border-2 border-white animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-sm font-extrabold text-[#111827] truncate">
                            {friendName}
                          </div>
                          <div className="text-xs text-[#64748B] truncate">
                            {idx % 2 === 0 ? 'In lobby' : 'Ready to roll'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => handleInviteFriend(friendUid, friendName)}
                        className="px-3.5 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-white inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 shrink-0"
                      >
                        <Send className="w-3 h-3 text-[#1D4ED8]" />
                        {sending ? 'Sending...' : 'Invite'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* OPEN PUBLIC TABLES SECTION */}
          <section className="studio-card-soft rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1D4ED8]" />
                <h2 className="font-display text-sm font-extrabold text-[#111827]">
                  Open public tables
                </h2>
              </div>
              {isSignedIn && (
                <button
                  type="button"
                  onClick={() => refreshOpenRooms()}
                  className="p-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] cursor-pointer"
                  aria-label="Refresh open tables"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!isSignedIn ? (
              <p className="text-xs text-[#64748B]">
                Sign in to browse and join live open public rooms.
              </p>
            ) : openRooms.length === 0 ? (
              <p className="text-xs text-[#64748B]">
                No public waiting tables right now. Tap <strong>Quick 4P</strong> or{' '}
                <strong>1v1 Duel</strong> to start one!
              </p>
            ) : (
              <div className="space-y-2 max-h-[168px] overflow-y-auto no-scrollbar">
                {openRooms.slice(0, 4).map((room) => (
                  <div
                    key={room.id}
                    className="px-3 py-2.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-extrabold text-[#1D4ED8]">
                        {room.roomCode}
                      </div>
                      <div className="text-[11px] text-[#475569] truncate">
                        {room.seats[0]?.name} · {room.seats.length}/{room.maxPlayers} seats ·{' '}
                        {room.mode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => joinRoom(room.roomCode)}
                      className="px-3 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-gold cursor-pointer shrink-0"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setOptionsModalOpen(true)}
                className="text-xs font-bold text-[#475569] hover:text-[#111827] inline-flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Stake: {stake} · Bot: {aiDifficulty}
              </button>
              <button
                type="button"
                onClick={onOpenAdPolicy}
                className="text-xs font-bold text-[#1D4ED8] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Privacy
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* JOIN BY ROOM CODE MODAL */}
      {joinModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] bg-[#0F172A]/55 backdrop-blur-xs flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Join room by code"
            onClick={(e) => {
              if (e.target === e.currentTarget) setJoinModalOpen(false);
            }}
          >
            <div className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-3xl bg-white border-2 border-[#111827] shadow-[0_6px_0_#111827] p-5 sm:p-6 animate-pop-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#1D4ED8]" />
                <h2 className="font-display text-lg font-extrabold text-[#111827]">
                  Join by room code
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setJoinModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] hover:border-[#111827] cursor-pointer"
                aria-label="Close join modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleJoinByCode} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="room-code-input"
                  className="block text-xs font-bold text-[#475569] mb-1.5"
                >
                  Enter 6-character table code
                </label>
                <input
                  id="room-code-input"
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="E.G. K7M4P2"
                  className="w-full px-4 py-3 rounded-2xl bg-[#F8FAFC] border-2 border-[#111827] font-mono text-lg font-extrabold tracking-[0.2em] text-center text-[#111827] uppercase focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25"
                />
              </div>

              <button
                type="submit"
                disabled={joinCode.length !== 6 || busyAction !== null}
                className="w-full py-3 rounded-2xl font-display font-extrabold text-sm game-btn-blue cursor-pointer disabled:opacity-50"
              >
                {busyAction === 'join' ? 'Joining table...' : 'Join room'}
              </button>
            </form>
          </div>
        </div>,
          document.body
        )}

      {/* MATCH OPTIONS MODAL (Players, Rules, Stake, Bot Skill) */}
      {optionsModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] bg-[#0F172A]/55 backdrop-blur-xs flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Match options"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOptionsModalOpen(false);
            }}
          >
            <div className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-3xl bg-white border-2 border-[#111827] shadow-[0_6px_0_#111827] p-5 sm:p-6 animate-pop-in space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-[#1D4ED8]" />
                <h2 className="font-display text-lg font-extrabold text-[#111827]">
                  Table settings
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOptionsModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] hover:border-[#111827] cursor-pointer"
                aria-label="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="text-xs font-bold text-[#475569] mb-2">Table size (Private & Bot)</div>
              <div className="grid grid-cols-2 gap-2">
                {([2, 4] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setPlayerCount(cnt)}
                    className={`py-2.5 rounded-xl font-display text-sm font-extrabold cursor-pointer ${
                      playerCount === cnt
                        ? 'game-btn-blue'
                        : 'bg-[#F8FAFC] border-2 border-[#CBD5E1] text-[#334155]'
                    }`}
                  >
                    {cnt} Players
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-[#475569] mb-2">Rule set</div>
              <div className="grid grid-cols-2 gap-2">
                {(['quick', 'classic'] as GameMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-2.5 rounded-xl font-display text-sm font-extrabold capitalize cursor-pointer ${
                      mode === m
                        ? 'game-btn-gold'
                        : 'bg-[#F8FAFC] border-2 border-[#CBD5E1] text-[#334155]'
                    }`}
                  >
                    {m} rules
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-[#475569] mb-2">Online match stake</div>
              <div className="grid grid-cols-3 gap-2">
                {([100, 250, 500] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStake(s)}
                    className={`py-2 rounded-xl font-mono text-xs font-extrabold cursor-pointer ${
                      stake === s
                        ? 'game-btn-gold'
                        : 'bg-[#F8FAFC] border-2 border-[#CBD5E1] text-[#334155]'
                    }`}
                  >
                    {s} Coins
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-[#475569] mb-2">Computer bot difficulty</div>
              <div className="grid grid-cols-3 gap-2">
                {(['casual', 'tactical', 'grandmaster'] as AiDifficulty[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setAiDifficulty(lvl)}
                    className={`py-2 rounded-xl font-display text-xs font-extrabold capitalize cursor-pointer ${
                      aiDifficulty === lvl
                        ? 'game-btn-blue'
                        : 'bg-[#F8FAFC] border-2 border-[#CBD5E1] text-[#334155]'
                    }`}
                  >
                    {lvl === 'grandmaster' ? 'Master' : lvl}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOptionsModalOpen(false)}
              className="w-full py-2.5 rounded-2xl font-display font-extrabold text-sm game-btn-blue cursor-pointer"
            >
              Done
            </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
