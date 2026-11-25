import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  Crown,
  Flame,
  Gift,
  Globe,
  KeyRound,
  Palette,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  AVATAR_OPTIONS,
  BOARD_THEMES,
  DAILY_CHALLENGES,
  getAvatarById,
  getTodayDateString,
  LEAGUE_META,
} from '../data/catalog';
import { tabletopAudio } from '../game/sound';
import { AiDifficulty, GameMode } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

const CHARACTER_LINES = [
  'Ready to roll a six?',
  'Star tiles keep you safe!',
  'Let’s claim the crown!',
  'Spin for bonus coins!',
  'Challenge friends by code!',
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
    saveCustomization,
    signInWithGoogle,
    setActiveTab,
    showToast,
  } = useApp();

  const [mode, setMode] = useState<GameMode>('quick');
  const [playerCount, setPlayerCount] = useState<2 | 4>(4);
  const [stake, setStake] = useState<100 | 250 | 500>(100);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('tactical');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [tablesSheetOpen, setTablesSheetOpen] = useState(false);
  const [skinsSheetOpen, setSkinsSheetOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const [cheering, setCheering] = useState(false);
  const [speechLine, setSpeechLine] = useState(CHARACTER_LINES[0]);

  useEffect(() => {
    if (isSignedIn) {
      refreshOpenRooms().catch(() => {});
    }
  }, [isSignedIn, refreshOpenRooms]);

  const today = getTodayDateString();
  const dailyChestReady = wallet.lastDailyClaimDate !== today;
  const claimableChallenges = DAILY_CHALLENGES.filter(
    (ch) =>
      !wallet.claimedChallenges.includes(ch.id) &&
      (wallet.challengeProgress[ch.metric] || 0) >= ch.target
  ).length;

  const currentAvatarIdx = Math.max(
    0,
    AVATAR_OPTIONS.findIndex((a) => a.id === profile.avatarId)
  );
  const currentAvatar = getAvatarById(profile.avatarId);
  const xpIntoLevel = profile.xp % 250;
  const xpPct = Math.round((xpIntoLevel / 250) * 100);

  const handleTapCharacter = () => {
    tabletopAudio.playSafeStar();
    setCheering(true);
    const nextLine = CHARACTER_LINES[Math.floor(Math.random() * CHARACTER_LINES.length)];
    setSpeechLine(nextLine);
    setTimeout(() => setCheering(false), 520);
  };

  const handleCycleAvatar = async (dir: -1 | 1) => {
    const nextIdx = (currentAvatarIdx + dir + AVATAR_OPTIONS.length) % AVATAR_OPTIONS.length;
    const nextAvatar = AVATAR_OPTIONS[nextIdx];
    tabletopAudio.playTokenMove();
    setSpeechLine(`${nextAvatar.name} ready!`);
    await saveCustomization({
      displayName: profile.displayName,
      avatarId: nextAvatar.id,
      avatarFrame: profile.avatarFrame,
      boardTheme: profile.boardTheme,
      diceTheme: profile.diceTheme,
    });
  };

  const handleQuickOnline = async () => {
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setBusyAction('online');
    try {
      await startQuickMatchmaking({ mode, maxPlayers: playerCount, entryStake: stake });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreatePrivate = async () => {
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setBusyAction('private');
    try {
      await createPrivateRoom({ mode, maxPlayers: playerCount, entryStake: stake });
      setFriendsModalOpen(false);
    } finally {
      setBusyAction(null);
    }
  };

  const handleJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length !== 6) return;
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setBusyAction('join');
    try {
      await joinRoom(joinCode);
      setJoinCode('');
      setFriendsModalOpen(false);
    } finally {
      setBusyAction(null);
    }
  };

  const handleQuickBoardSwitch = async (boardId: string) => {
    if (boardId !== 'board_emerald' && !wallet.unlockedCosmetics.includes(boardId)) {
      setSkinsSheetOpen(false);
      setActiveTab('atelier');
      return;
    }
    tabletopAudio.playTokenMove();
    await saveCustomization({
      displayName: profile.displayName,
      avatarId: profile.avatarId,
      avatarFrame: profile.avatarFrame,
      boardTheme: boardId,
      diceTheme: profile.diceTheme,
    });
  };

  return (
    <div className="min-h-full w-full flex flex-col justify-center">
      {/* MOBILE & TABLET NATIVE APP HOME STAGE (< lg): Fits 1-screen on phones, safely scrollable if short/landscape */}
      <div className="lg:hidden min-h-full w-full max-w-lg mx-auto px-3 py-2.5 pb-4 flex flex-col justify-between gap-2.5">
        <div className="shrink-0 rounded-2xl bg-[#14251E]/90 border-2 border-[#2E4C40] px-3 py-2 flex items-center gap-2.5 shadow-lg">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleCycleAvatar(-1)}
              className="w-7 h-7 rounded-lg bg-[#1C332A] border border-[#345548] text-[#C5D5CC] flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="Previous character"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleTapCharacter}
              className={`relative rounded-full cursor-pointer ${
                cheering ? 'animate-character-cheer' : 'animate-character-idle'
              }`}
              aria-label={`Interact with ${currentAvatar.name}`}
            >
              <PlayerAvatar
                avatarId={profile.avatarId}
                frameId={profile.avatarFrame}
                size="md"
                alt={profile.displayName}
              />
            </button>

            <button
              type="button"
              onClick={() => handleCycleAvatar(1)}
              className="w-7 h-7 rounded-lg bg-[#1C332A] border border-[#345548] text-[#C5D5CC] flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="Next character"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <Crown className="w-4 h-4 text-[#EAB957] shrink-0" />
                <h1 className="font-display text-base font-extrabold tracking-tight text-white truncate">
                  LUDO CROWN
                </h1>
              </div>
              <span className="text-[10px] font-mono font-bold text-[#EAB957] shrink-0">
                LV.{profile.level}
              </span>
            </div>

            <div
              key={speechLine}
              className="mt-0.5 text-[11px] font-medium text-[#FEF08A] truncate animate-pop-in"
            >
              “{speechLine}”
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-[#0A1410] overflow-hidden">
                <div className="h-full bg-[#EAB957]" style={{ width: `${xpPct}%` }} />
              </div>
              <span className="text-[10px] font-mono tabular-nums text-[#A6BBB0] shrink-0">
                {LEAGUE_META[profile.league].name.split(' ')[0]} · {profile.elo}
              </span>
            </div>
          </div>
        </div>

        {/* 5-Icon Interactive Mobile Retention Dock */}
        <div className="shrink-0 grid grid-cols-5 gap-1.5">
          <button
            type="button"
            onClick={() => (dailyChestReady ? claimDailyStreak() : setActiveTab('rewards'))}
            className={`rounded-xl py-2 px-1 border text-center active:scale-95 transition-transform cursor-pointer ${
              dailyChestReady
                ? 'bg-[#2B1F0A] border-[#EAB957] animate-chest-wiggle'
                : 'bg-[#14251E]/90 border-[#2D4A3E]'
            }`}
          >
            <Gift className="w-4 h-4 text-[#EAB957] mx-auto" />
            <div className="mt-1 font-display text-[10px] font-bold text-white leading-none truncate">
              {dailyChestReady ? 'Claim!' : 'Chest'}
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenWheel}
            className="rounded-xl py-2 px-1 bg-[#241E30]/95 border border-[#754E8F] text-center active:scale-95 transition-transform cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#D4B2E8] mx-auto" />
            <div className="mt-1 font-display text-[10px] font-bold text-white leading-none truncate">
              Spin
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isSignedIn) refreshOpenRooms().catch(() => {});
              setTablesSheetOpen(true);
            }}
            className="rounded-xl py-2 px-1 bg-[#14251E]/90 border border-[#2D4A3E] text-center active:scale-95 transition-transform cursor-pointer"
          >
            <Globe className="w-4 h-4 text-[#60A5FA] mx-auto" />
            <div className="mt-1 font-display text-[10px] font-bold text-white leading-none truncate">
              Tables{openRooms.length > 0 ? ` (${openRooms.length})` : ''}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSkinsSheetOpen(true)}
            className="rounded-xl py-2 px-1 bg-[#14251E]/90 border border-[#2D4A3E] text-center active:scale-95 transition-transform cursor-pointer"
          >
            <Palette className="w-4 h-4 text-[#EAB957] mx-auto" />
            <div className="mt-1 font-display text-[10px] font-bold text-white leading-none truncate">
              Skins
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerRewardedAd('daily_bonus_coins', () => {
                showToast('+250 Coins credited!', 'success');
              })
            }
            className="rounded-xl py-2 px-1 bg-[#0E2E2B]/95 border border-[#10B981] text-center active:scale-95 transition-transform cursor-pointer"
          >
            <Play className="w-4 h-4 text-[#34D399] mx-auto" />
            <div className="mt-1 font-display text-[10px] font-bold text-white leading-none truncate">
              +250
            </div>
          </button>
        </div>

        {/* Compact 1-Row Quick Match Rules Bar */}
        <div className="shrink-0 grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-[#0C1814]/95 border border-[#274136]">
          <div className="grid grid-cols-2 gap-1">
            {([2, 4] as const).map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => setPlayerCount(cnt)}
                className={`py-1.5 rounded-lg text-[11px] font-display font-bold cursor-pointer transition-colors ${
                  playerCount === cnt
                    ? 'bg-[#EAB957] text-[#1A1000]'
                    : 'bg-[#1A2F26] text-[#CBD5E1]'
                }`}
              >
                {cnt}P
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1">
            {(['quick', 'classic'] as GameMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`py-1.5 rounded-lg text-[11px] font-display font-bold capitalize cursor-pointer transition-colors ${
                  mode === m
                    ? 'bg-[#34D399] text-[#052E16]'
                    : 'bg-[#1A2F26] text-[#CBD5E1]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1">
            {([100, 250, 500] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStake(s)}
                className={`py-1.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                  stake === s
                    ? 'bg-[#60A5FA] text-[#081233]'
                    : 'bg-[#1A2F26] text-[#CBD5E1]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Hero 2x2 Tactile 3D Arcade Play Tiles */}
        <div className="flex-1 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleQuickOnline}
            className="rounded-2xl p-3.5 text-left game-btn-green cursor-pointer disabled:opacity-60 flex flex-col justify-between min-h-[104px] h-full"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-black/15 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <span className="font-mono text-[11px] font-bold opacity-85">{playerCount}P LIVE</span>
            </div>
            <div>
              <div className="font-display text-base sm:text-lg font-extrabold leading-tight">
                {busyAction === 'online' ? 'MATCHING...' : 'PLAY ONLINE'}
              </div>
              <div className="text-[11px] font-semibold opacity-85 mt-0.5 truncate">
                {isSignedIn ? `Win ${(stake * playerCount).toLocaleString()} Coins` : 'Google Sync'}
              </div>
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
            className="rounded-2xl p-3.5 text-left game-btn-gold cursor-pointer flex flex-col justify-between min-h-[104px] h-full"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-black/15 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="font-mono text-[10px] font-bold uppercase opacity-85">
                {aiDifficulty}
              </span>
            </div>
            <div>
              <div className="font-display text-base sm:text-lg font-extrabold leading-tight">
                VS COMPUTER
              </div>
              <div className="text-[11px] font-semibold opacity-85 mt-0.5 truncate">
                Instant Offline Play
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFriendsModalOpen(true)}
            className="rounded-2xl p-3.5 text-left game-btn-blue cursor-pointer flex flex-col justify-between min-h-[104px] h-full"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="font-mono text-[11px] font-bold opacity-90">CODE</span>
            </div>
            <div>
              <div className="font-display text-base sm:text-lg font-extrabold leading-tight">
                PLAY FRIENDS
              </div>
              <div className="text-[11px] font-semibold opacity-90 mt-0.5 truncate">
                Host or Join Room
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tournaments')}
            className="rounded-2xl p-3.5 text-left game-btn-purple cursor-pointer flex flex-col justify-between min-h-[104px] h-full"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <span className="font-mono text-[11px] font-bold opacity-90">
                {wallet.freeTournamentTickets} PASS
              </span>
            </div>
            <div>
              <div className="font-display text-base sm:text-lg font-extrabold leading-tight">
                TOURNAMENTS
              </div>
              <div className="text-[11px] font-semibold opacity-90 mt-0.5 truncate">
                Knockout Cups
              </div>
            </div>
          </button>
        </div>

        {/* Bottom Utility Strip */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold text-[#A6BBB0] mr-1">AI:</span>
            {(['casual', 'tactical', 'grandmaster'] as AiDifficulty[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setAiDifficulty(lvl)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize cursor-pointer transition-colors ${
                  aiDifficulty === lvl
                    ? 'bg-[#EAB957] text-[#1A1000]'
                    : 'bg-[#14251E] text-[#94A3B8] border border-[#274136]'
                }`}
              >
                {lvl === 'grandmaster' ? 'Master' : lvl}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenAdPolicy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#14261F] border border-[#325245] text-[10px] font-semibold text-[#A6BBB0] hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
            AdMob
          </button>
        </div>
      </div>

      {/* DESKTOP GAME LOBBY STAGE (lg:): Full Presence, Safely Accessible on Short Windows */}
      <div className="hidden lg:grid min-h-full w-full max-w-[1260px] mx-auto px-6 py-4 grid-cols-12 gap-5 items-center">
        <div className="col-span-3 flex flex-col gap-3.5">
          <div className="rounded-3xl bg-[#14251E]/90 border-2 border-[#2E4C40] p-4 text-center shadow-xl">
            <div className="min-h-[32px] flex items-center justify-center mb-1.5">
              <div
                key={speechLine}
                className="px-3 py-1 rounded-xl bg-[#213B30] border border-[#456C5C] text-xs font-medium text-[#FEF08A] animate-pop-in"
              >
                {speechLine}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 my-1.5">
              <button
                type="button"
                onClick={() => handleCycleAvatar(-1)}
                className="w-8 h-8 rounded-xl bg-[#1C332A] border border-[#345548] text-[#C5D5CC] hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Previous character"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleTapCharacter}
                className={`relative rounded-full p-1 cursor-pointer ${
                  cheering ? 'animate-character-cheer' : 'animate-character-idle'
                }`}
                aria-label={`Interact with ${currentAvatar.name}`}
              >
                <PlayerAvatar
                  avatarId={profile.avatarId}
                  frameId={profile.avatarFrame}
                  size="lg"
                  alt={profile.displayName}
                  className="w-20 h-20 shadow-2xl shadow-black/50"
                />
              </button>

              <button
                type="button"
                onClick={() => handleCycleAvatar(1)}
                className="w-8 h-8 rounded-xl bg-[#1C332A] border border-[#345548] text-[#C5D5CC] hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Next character"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-1.5 font-display text-base font-bold text-white truncate">
              {profile.displayName}
            </div>
            <div className="text-xs text-[#A6BBB0]">
              {LEAGUE_META[profile.league].name} · ELO{' '}
              <span className="font-mono tabular-nums text-[#EAB957] font-semibold">
                {profile.elo}
              </span>
            </div>

            <div className="mt-2.5 px-1">
              <div className="flex items-center justify-between text-[11px] text-[#9BB0A5] font-mono tabular-nums mb-1">
                <span>LV. {profile.level}</span>
                <span>{xpIntoLevel}/250 XP</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#0A1410] overflow-hidden">
                <div className="h-full bg-[#EAB957]" style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => (dailyChestReady ? claimDailyStreak() : setActiveTab('rewards'))}
              className={`rounded-2xl p-3 border-2 text-center transition-transform active:scale-95 cursor-pointer ${
                dailyChestReady
                  ? 'bg-[#2B1F0A] border-[#EAB957] animate-chest-wiggle'
                  : 'bg-[#14251E]/90 border-[#2D4A3E] hover:border-[#3D5EC2]'
              }`}
            >
              <Gift className="w-5 h-5 text-[#EAB957] mx-auto" />
              <div className="mt-1 font-display text-xs font-bold text-white">Daily Chest</div>
              <div className="text-[10px] text-[#FDE68A]">
                {dailyChestReady ? 'Tap to Open!' : `Day ${wallet.dailyStreak} Done`}
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenWheel}
              className="rounded-2xl p-3 bg-[#241E30]/95 border-2 border-[#754E8F] hover:border-[#A78BFA] text-center transition-transform active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-[#D4B2E8] mx-auto" />
              <div className="mt-1 font-display text-xs font-bold text-white">Lucky Spin</div>
              <div className="text-[10px] text-[#DDD6FE]">Win 1,000 Coins</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rewards')}
              className="rounded-2xl p-3 bg-[#14251E]/90 border-2 border-[#2D4A3E] hover:border-[#3D5EC2] text-center transition-transform active:scale-95 cursor-pointer"
            >
              <Flame className="w-5 h-5 text-[#FB7185] mx-auto" />
              <div className="mt-1 font-display text-xs font-bold text-white">Missions</div>
              <div className="text-[10px] text-[#FDA4AF]">
                {claimableChallenges > 0 ? `${claimableChallenges} Ready!` : '4 Quests'}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerRewardedAd('daily_bonus_coins', () => {
                  showToast('+250 Coins credited to your treasury!', 'success');
                })
              }
              className="rounded-2xl p-3 bg-[#0E2E2B]/95 border-2 border-[#10B981] hover:border-[#34D399] text-center transition-transform active:scale-95 cursor-pointer"
            >
              <Play className="w-5 h-5 text-[#34D399] mx-auto" />
              <div className="mt-1 font-display text-xs font-bold text-white">Free +250</div>
              <div className="text-[10px] text-[#A7F3D0]">Watch Video</div>
            </button>
          </div>
        </div>

        <div className="col-span-6 rounded-3xl bg-[#14251E]/88 border-2 border-[#325245] p-5 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <svg viewBox="0 0 180 62" className="w-36 h-12" aria-hidden="true">
              <path
                d="M66 28 L72 8 L90 20 L108 8 L114 28 Z"
                fill="#EAB957"
                stroke="#B45309"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <rect x="65" y="27" width="50" height="6" rx="3" fill="#FDE68A" stroke="#B45309" strokeWidth="2" />
              {[
                { x: 30, fill: '#E11D48', top: '#FB7185' },
                { x: 68, fill: '#059669', top: '#34D399' },
                { x: 112, fill: '#D97706', top: '#FBBF24' },
                { x: 150, fill: '#2563EB', top: '#60A5FA' },
              ].map((p) => (
                <g key={p.x}>
                  <circle cx={p.x} cy="38" r="7.5" fill={p.top} stroke="#FFFFFF" strokeWidth="2" />
                  <path
                    d={`M${p.x - 9.5} 58 C${p.x - 9.5} 45 ${p.x + 9.5} 45 ${p.x + 9.5} 58 Z`}
                    fill={p.fill}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </g>
              ))}
            </svg>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white mt-1">
              LUDO CROWN
            </h1>
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2 p-2 rounded-2xl bg-[#0C1814] border border-[#274136]">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#94A3B8] text-center">PLAYERS</span>
              <div className="grid grid-cols-2 gap-1">
                {([2, 4] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setPlayerCount(cnt)}
                    className={`py-1 rounded-lg text-xs font-display font-bold cursor-pointer transition-colors ${
                      playerCount === cnt
                        ? 'bg-[#EAB957] text-[#1A1000]'
                        : 'bg-[#1A2F26] text-[#CBD5E1] hover:text-white'
                    }`}
                  >
                    {cnt}P
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#94A3B8] text-center">RULESET</span>
              <div className="grid grid-cols-2 gap-1">
                {(['quick', 'classic'] as GameMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-1 rounded-lg text-xs font-display font-bold capitalize cursor-pointer transition-colors ${
                      mode === m
                        ? 'bg-[#34D399] text-[#052E16]'
                        : 'bg-[#1A2F26] text-[#CBD5E1] hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#94A3B8] text-center">STAKE</span>
              <div className="grid grid-cols-3 gap-1">
                {([100, 250, 500] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStake(s)}
                    className={`py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                      stake === s
                        ? 'bg-[#60A5FA] text-[#081233]'
                        : 'bg-[#1A2F26] text-[#CBD5E1] hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleQuickOnline}
              className="rounded-2xl p-4 text-left game-btn-green cursor-pointer disabled:opacity-60 flex flex-col justify-between min-h-[108px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-black/15 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="font-mono text-xs font-bold opacity-85">{playerCount}P LIVE</span>
              </div>
              <div className="mt-2">
                <div className="font-display text-lg font-extrabold leading-tight">
                  {busyAction === 'online' ? 'MATCHING...' : 'PLAY ONLINE'}
                </div>
                <div className="text-xs font-medium opacity-85 mt-0.5">
                  {isSignedIn ? `Win ${(stake * playerCount).toLocaleString()} Coins` : 'Google Sign-In Sync'}
                </div>
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
              className="rounded-2xl p-4 text-left game-btn-gold cursor-pointer flex flex-col justify-between min-h-[108px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-black/15 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <span className="font-mono text-xs font-bold uppercase opacity-85">
                  {aiDifficulty} AI
                </span>
              </div>
              <div className="mt-2">
                <div className="font-display text-lg font-extrabold leading-tight">
                  VS COMPUTER
                </div>
                <div className="text-xs font-medium opacity-85 mt-0.5">Instant Offline Play</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFriendsModalOpen(true)}
              className="rounded-2xl p-4 text-left game-btn-blue cursor-pointer flex flex-col justify-between min-h-[108px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <span className="font-mono text-xs font-bold opacity-90">CODE</span>
              </div>
              <div className="mt-2">
                <div className="font-display text-lg font-extrabold leading-tight">
                  PLAY FRIENDS
                </div>
                <div className="text-xs font-medium opacity-90 mt-0.5">Create or Join Code</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tournaments')}
              className="rounded-2xl p-4 text-left game-btn-purple cursor-pointer flex flex-col justify-between min-h-[108px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="font-mono text-xs font-bold opacity-90">
                  {wallet.freeTournamentTickets} PASS
                </span>
              </div>
              <div className="mt-2">
                <div className="font-display text-lg font-extrabold leading-tight">
                  TOURNAMENTS
                </div>
                <div className="text-xs font-medium opacity-90 mt-0.5">Knockout Prize Cups</div>
              </div>
            </button>
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-2 pt-3 border-t border-[#274136]">
            <span className="text-xs font-medium text-[#9BB0A5]">Offline Bot Skill:</span>
            <div className="flex items-center gap-1.5">
              {(['casual', 'tactical', 'grandmaster'] as AiDifficulty[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setAiDifficulty(lvl)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-colors ${
                    aiDifficulty === lvl
                      ? 'bg-[#EAB957] text-[#1A1000]'
                      : 'bg-[#0C1814] text-[#94A3B8] hover:text-white border border-[#274136]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-3 flex flex-col gap-3.5">
          <div className="rounded-3xl bg-[#14251E]/90 border-2 border-[#2E4C40] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#EAB957]" />
                <h2 className="font-display text-sm font-bold text-white">Live Open Tables</h2>
              </div>
              {isSignedIn && (
                <button
                  type="button"
                  onClick={() => refreshOpenRooms()}
                  className="p-1.5 rounded-lg bg-[#1C3229] text-[#A6BBB0] hover:text-white cursor-pointer"
                  aria-label="Refresh open tables"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!isSignedIn ? (
              <div className="rounded-2xl bg-[#0C1814] border border-[#274136] p-3 text-center">
                <p className="text-xs text-[#9BB0A5]">
                  Sign in with Google to join real-time players across devices.
                </p>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="mt-2.5 w-full py-2 rounded-xl font-display font-bold text-xs game-btn-gold cursor-pointer"
                >
                  Sign In with Google
                </button>
              </div>
            ) : openRooms.length === 0 ? (
              <div className="rounded-2xl bg-[#0C1814] border border-[#274136] p-3 text-xs text-[#94A3B8] text-center">
                No waiting tables yet. Tap <strong className="text-white">PLAY ONLINE</strong> to
                host!
              </div>
            ) : (
              <div className="space-y-2 max-h-[168px] overflow-y-auto no-scrollbar">
                {openRooms.slice(0, 4).map((room) => (
                  <div
                    key={room.id}
                    className="p-2 rounded-xl bg-[#0C1814] border border-[#274136] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-[#EAB957]">
                        {room.roomCode}
                      </div>
                      <div className="text-[11px] text-[#9BB0A5] truncate">
                        {room.seats[0]?.name} · {room.seats.length}/{room.maxPlayers}P
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => joinRoom(room.roomCode)}
                      className="px-3 py-1 rounded-lg font-display font-bold text-xs game-btn-green cursor-pointer shrink-0"
                    >
                      JOIN
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-[#14251E]/90 border-2 border-[#2E4C40] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#EAB957]" />
                <h2 className="font-display text-sm font-bold text-white">Board Skin</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('atelier')}
                className="text-[11px] font-semibold text-[#A6BBB0] hover:text-white cursor-pointer"
              >
                Shop All
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {BOARD_THEMES.map((t) => {
                const active = profile.boardTheme === t.id;
                const unlocked = t.priceCoins === 0 || wallet.unlockedCosmetics.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={`${t.name}${unlocked ? '' : ' (Locked - Shop)'}`}
                    onClick={() => handleQuickBoardSwitch(t.id)}
                    className={`h-10 rounded-xl border-2 flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${
                      active
                        ? 'border-[#EAB957] scale-105'
                        : 'border-[#2A463B] opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: t.frameBg }}
                  >
                    <span
                      className="w-4 h-4 rounded-sm border border-white/40"
                      style={{ backgroundColor: t.swatchHex }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAdPolicy}
            className="w-full rounded-2xl bg-[#14261F] border border-[#325245] hover:border-[#60A5FA] p-3 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldCheck className="w-5 h-5 text-[#34D399] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  AdMob Policy · Android &amp; iOS
                </div>
                <div className="text-[11px] text-[#A6BBB0] truncate">
                  Play Store &amp; App Store Ready
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#A6BBB0] shrink-0" />
          </button>
        </div>
      </div>

      {/* Play With Friends Sheet */}
      {friendsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Play With Friends"
        >
          <div className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-3xl bg-[#14251E] border-t-2 sm:border-2 border-[#3D6153] p-5 pb-7 sm:p-6 shadow-2xl animate-pop-in">
            <div className="w-10 h-1 rounded-full bg-[#3D6153] mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#274136]">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-[#EAB957]" />
                <h2 className="font-display text-lg font-bold text-white">Play With Friends</h2>
              </div>
              <button
                type="button"
                onClick={() => setFriendsModalOpen(false)}
                className="p-2 rounded-xl bg-[#1C3229] text-[#C5D5CC] hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#0C1814] border border-[#274136]">
                <div className="text-xs font-semibold text-[#A6BBB0] mb-2">
                  Host Private Table ({playerCount}P · {mode})
                </div>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handleCreatePrivate}
                  className="w-full py-3 rounded-xl font-display font-bold text-sm game-btn-gold cursor-pointer disabled:opacity-60"
                >
                  {busyAction === 'private' ? 'Creating Room...' : 'CREATE PRIVATE CODE'}
                </button>
              </div>

              <form
                onSubmit={handleJoinCode}
                className="p-3.5 rounded-2xl bg-[#0C1814] border border-[#274136] space-y-2.5"
              >
                <div className="text-xs font-semibold text-[#A6BBB0]">
                  Enter Friend’s 6-Character Code
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
                      )
                    }
                    maxLength={6}
                    placeholder="R7K2M9"
                    className="flex-1 min-w-0 bg-[#1A2F26] border-2 border-[#325245] rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold tracking-[0.2em] text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#EAB957]"
                  />
                  <button
                    type="submit"
                    disabled={joinCode.length !== 6 || busyAction !== null}
                    className="px-5 py-2.5 rounded-xl font-display font-bold text-sm game-btn-green disabled:opacity-45 cursor-pointer whitespace-nowrap"
                  >
                    JOIN
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Live Open Tables Sheet */}
      {tablesSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Live Open Tables"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#14251E] border-t-2 sm:border-2 border-[#3D6153] p-5 pb-7 sm:p-6 shadow-2xl animate-pop-in">
            <div className="w-10 h-1 rounded-full bg-[#3D6153] mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#274136]">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#EAB957]" />
                <h2 className="font-display text-lg font-bold text-white">Live Open Tables</h2>
              </div>
              <div className="flex items-center gap-1.5">
                {isSignedIn && (
                  <button
                    type="button"
                    onClick={() => refreshOpenRooms()}
                    className="p-2 rounded-xl bg-[#1C3229] text-[#A6BBB0] hover:text-white cursor-pointer"
                    aria-label="Refresh tables"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTablesSheetOpen(false)}
                  className="p-2 rounded-xl bg-[#1C3229] text-[#C5D5CC] hover:text-white cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[50dvh] overflow-y-auto no-scrollbar">
              {!isSignedIn ? (
                <div className="rounded-2xl bg-[#0C1814] border border-[#274136] p-4 text-center">
                  <p className="text-xs text-[#9BB0A5]">
                    Sign in with Google to join real-time players on other devices.
                  </p>
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className="mt-3 w-full py-2.5 rounded-xl font-display font-bold text-xs game-btn-gold cursor-pointer"
                  >
                    Sign In with Google
                  </button>
                </div>
              ) : openRooms.length === 0 ? (
                <div className="rounded-2xl bg-[#0C1814] border border-[#274136] p-4 text-xs text-[#94A3B8] text-center">
                  No open tables waiting right now. Tap <strong className="text-white">PLAY ONLINE</strong> to host one!
                </div>
              ) : (
                <div className="space-y-2">
                  {openRooms.map((room) => (
                    <div
                      key={room.id}
                      className="p-3 rounded-2xl bg-[#0C1814] border border-[#274136] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold text-[#EAB957]">
                          {room.roomCode}
                        </div>
                        <div className="text-xs text-[#9BB0A5] truncate">
                          {room.seats[0]?.name} · {room.seats.length}/{room.maxPlayers}P · {room.mode}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTablesSheetOpen(false);
                          joinRoom(room.roomCode);
                        }}
                        className="px-4 py-2 rounded-xl font-display font-bold text-xs game-btn-green cursor-pointer shrink-0"
                      >
                        JOIN
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Board Skins Sheet */}
      {skinsSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quick Board Skins"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#14251E] border-t-2 sm:border-2 border-[#3D6153] p-5 pb-7 sm:p-6 shadow-2xl animate-pop-in">
            <div className="w-10 h-1 rounded-full bg-[#3D6153] mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#274136]">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#EAB957]" />
                <h2 className="font-display text-lg font-bold text-white">Board Skins</h2>
              </div>
              <button
                type="button"
                onClick={() => setSkinsSheetOpen(false)}
                className="p-2 rounded-xl bg-[#1C3229] text-[#C5D5CC] hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {BOARD_THEMES.map((t) => {
                const active = profile.boardTheme === t.id;
                const unlocked = t.priceCoins === 0 || wallet.unlockedCosmetics.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleQuickBoardSwitch(t.id)}
                    className={`p-3 rounded-2xl border-2 text-left transition-transform active:scale-95 cursor-pointer ${
                      active
                        ? 'bg-[#1A2F75] border-[#EAB957]'
                        : 'bg-[#0C1814] border-[#2A463B]'
                    }`}
                  >
                    <div
                      className="h-10 rounded-xl border border-white/20 mb-2 flex items-center justify-center"
                      style={{ backgroundColor: t.frameBg }}
                    >
                      <span
                        className="w-8 h-4 rounded-sm border border-white/40"
                        style={{ backgroundColor: t.swatchHex }}
                      />
                    </div>
                    <div className="font-display text-xs font-bold text-white truncate">{t.name}</div>
                    <div className="text-[10px] text-[#A6BBB0] mt-0.5">
                      {active ? 'Equipped' : unlocked ? 'Tap to Equip' : `${t.priceCoins} Coins (Shop)`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
