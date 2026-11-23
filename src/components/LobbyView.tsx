import React, { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Play, RefreshCw, Shield, Users } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { HERO_TABLE_IMAGE, LEAGUE_META } from '../data/catalog';
import { AiDifficulty, GameMode } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

export function LobbyView() {
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
    signInWithGoogle,
    setActiveTab,
  } = useApp();

  const [onlineMode, setOnlineMode] = useState<GameMode>('quick');
  const [onlinePlayers, setOnlinePlayers] = useState<2 | 4>(4);
  const [joinCode, setJoinCode] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Offline Practice controls
  const [practiceMode, setPracticeMode] = useState<GameMode>('quick');
  const [practicePlayers, setPracticePlayers] = useState<2 | 4>(4);
  const [practiceDifficulty, setPracticeDifficulty] = useState<AiDifficulty>('tactical');

  useEffect(() => {
    if (isSignedIn) {
      refreshOpenRooms().catch(() => {});
    }
  }, [isSignedIn, refreshOpenRooms]);

  const winRate =
    profile.gamesPlayed > 0 ? Math.round((profile.wins / profile.gamesPlayed) * 100) : 0;

  const handleQuickMatch = async () => {
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setBusyAction('quick');
    try {
      await startQuickMatchmaking({
        mode: onlineMode,
        maxPlayers: onlinePlayers,
        entryStake: 100,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleHostPrivate = async () => {
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setBusyAction('private');
    try {
      await createPrivateRoom({
        mode: onlineMode,
        maxPlayers: onlinePlayers,
        entryStake: 100,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setBusyAction('join');
    try {
      await joinRoom(joinCode);
      setJoinCode('');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Hero Split (2-column balanced with items-stretch) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between py-2">
          <div>
            <p className="text-xs font-medium text-[#D4A446] tracking-wide">
              {LEAGUE_META[profile.league].name} · Cross-Platform Multiplayer
            </p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold text-[#F5F2EB] leading-[1.12] tracking-tight">
              Roll together across every device.
            </h1>
            <p className="mt-4 text-base text-[#B5C8BF] leading-relaxed max-w-xl">
              Play real-time synchronized Ludo with friends or ranked opponents, chat right at the
              table, climb league brackets, or sharpen tactics offline against adaptive AI.
            </p>
          </div>

          <div className="mt-7 space-y-4">
            {/* Single Dominant Primary CTA + Quiet Secondary Practice Trigger */}
            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={handleQuickMatch}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                <Play className="w-4 h-4" />
                {busyAction === 'quick'
                  ? 'Finding Table...'
                  : isSignedIn
                    ? 'Quick Online Match'
                    : 'Sign In & Play Online'}
              </button>

              <button
                type="button"
                onClick={() =>
                  launchOfflinePractice({
                    mode: practiceMode,
                    playerCount: practicePlayers,
                    difficulty: practiceDifficulty,
                  })
                }
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#133227] border border-[#285141] text-sm font-medium text-[#F5F2EB] hover:bg-[#194032] transition-colors whitespace-nowrap cursor-pointer"
              >
                Offline Practice
                <ArrowRight className="w-4 h-4 text-[#D4A446]" />
              </button>
            </div>

            {/* Quiet signed-in identity strip */}
            <div className="pt-2 flex items-center gap-3 text-xs text-[#9EB5AA]">
              <PlayerAvatar
                avatarId={profile.avatarId}
                frameId={profile.avatarFrame}
                size="xs"
                alt={profile.displayName}
              />
              <span>
                Playing as <strong className="text-[#F5F2EB] font-medium">{profile.displayName}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setActiveTab('atelier')}
                className="text-[#E5B95C] hover:underline cursor-pointer"
              >
                Customize Avatar
              </button>
            </div>
          </div>
        </div>

        {/* Hero Visual Frame */}
        <div className="lg:col-span-6">
          <div className="relative w-full h-full min-h-[260px] lg:min-h-[340px] rounded-2xl overflow-hidden border border-[#264D3E] bg-[#102B22]">
            {!imgError ? (
              <img
                src={HERO_TABLE_IMAGE}
                alt="Handcrafted walnut Ludo table with ivory dice and enamel pawns on emerald felt"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover lg:h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#123328] p-8 text-center">
                <span className="font-display text-2xl text-[#E5B95C]">Ludo Crown Tabletop</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#081A14]/85 via-[#081A14]/25 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs text-[#E5B95C]">Real-Time Firestore Sync</div>
                <div className="text-sm font-medium text-[#F5F2EB] mt-0.5">
                  Instant turn verification · Live table chat · Multi-device tables
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Player KPI Strip (below hero split, zero pills, tabular numerals) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-[#1E3F32] py-5">
        <div>
          <div className="text-xs text-[#8FA99C]">ELO Rating</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-[#F5F2EB]">
            {profile.elo}
          </div>
          <div className="text-xs text-[#A5BDB2] mt-0.5">{LEAGUE_META[profile.league].name}</div>
        </div>
        <div>
          <div className="text-xs text-[#8FA99C]">Win Rate</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-[#F5F2EB]">
            {winRate}%
          </div>
          <div className="text-xs text-[#A5BDB2] mt-0.5 font-mono tabular-nums">
            {profile.wins}W / {profile.gamesPlayed}G
          </div>
        </div>
        <div>
          <div className="text-xs text-[#8FA99C]">Treasury</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-[#E5B95C]">
            {wallet.coins.toLocaleString()}
          </div>
          <div className="text-xs text-[#A5BDB2] mt-0.5 font-mono tabular-nums">
            Coins · {wallet.gems} Gems
          </div>
        </div>
        <div>
          <div className="text-xs text-[#8FA99C]">Progression</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-[#F5F2EB]">
            Lv. {profile.level}
          </div>
          <div className="text-xs text-[#A5BDB2] mt-0.5 font-mono tabular-nums">
            {profile.trophies} Trophies · {wallet.freeTournamentTickets} Tickets
          </div>
        </div>
      </section>

      {/* Two-Column Matchmaking & Offline Practice Workbench */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Real-Time Online Matchmaking & Private Tables */}
        <div className="lg:col-span-7 rounded-2xl bg-[#102B22] border border-[#234739] p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#F5F2EB]">
                Live Multiplayer Tables
              </h2>
              <p className="text-xs text-[#9EB5AA] mt-1">
                Match securely with online players or share a 6-letter code with friends.
              </p>
            </div>
            {isSignedIn && (
              <button
                type="button"
                onClick={() => refreshOpenRooms()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C8D8D0] hover:text-white cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            )}
          </div>

          {/* Segmented Match Configuration Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-[#9EB5AA] mb-2">Ruleset</div>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0A1D16] border border-[#1E3D31]">
                {(['quick', 'classic'] as GameMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setOnlineMode(m)}
                    className={`py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      onlineMode === m
                        ? 'bg-[#1D4637] text-[#F5F2EB]'
                        : 'text-[#8FA99C] hover:text-white'
                    }`}
                  >
                    {m === 'quick' ? 'Quick Match' : 'Classic Rules'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#9EB5AA] mb-2">Table Size</div>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0A1D16] border border-[#1E3D31]">
                {([2, 4] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setOnlinePlayers(cnt)}
                    className={`py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      onlinePlayers === cnt
                        ? 'bg-[#1D4637] text-[#F5F2EB]'
                        : 'text-[#8FA99C] hover:text-white'
                    }`}
                  >
                    {cnt} Players
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Host Private or Join by Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1D3E31]">
            <button
              type="button"
              onClick={handleHostPrivate}
              disabled={busyAction !== null}
              className="py-2.5 px-4 rounded-xl bg-[#183C2F] border border-[#2C5947] text-sm font-medium text-[#F5F2EB] hover:bg-[#1F4B3B] transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-[#D4A446]" />
              {busyAction === 'private' ? 'Creating...' : 'Create Private Table'}
            </button>

            <form onSubmit={handleJoinCode} className="flex items-center gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="6-CHAR CODE"
                maxLength={6}
                className="flex-1 min-w-0 bg-[#0A1D16] border border-[#254A3B] rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest text-[#F5F2EB] placeholder:text-[#617E71] focus:outline-none focus:border-[#D4A446]"
              />
              <button
                type="submit"
                disabled={joinCode.length !== 6 || busyAction !== null}
                className="px-4 py-2.5 rounded-xl bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] disabled:opacity-45 whitespace-nowrap cursor-pointer"
              >
                Join
              </button>
            </form>
          </div>

          {/* Open Public Rooms Directory */}
          <div className="pt-2 border-t border-[#1D3E31]">
            <div className="text-xs font-medium text-[#9EB5AA] mb-3">
              Open Public Tables Waiting for Players
            </div>
            {!isSignedIn ? (
              <div className="rounded-xl bg-[#0B1F18] border border-[#1E3E31] p-4 flex items-center justify-between gap-4">
                <div className="text-xs text-[#A5BDB2]">
                  Sign in with Google to browse live cross-device tables and ranked matchmaking.
                </div>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-3.5 py-2 rounded-lg bg-[#D4A446] text-[#0B231B] text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  Google Sign-In
                </button>
              </div>
            ) : openRooms.length === 0 ? (
              <div className="rounded-xl bg-[#0B1F18] border border-[#1E3E31] p-4 text-xs text-[#8FA99C]">
                No public tables waiting right now. Click <strong className="text-[#F5F2EB]">Quick Online Match</strong> above to open one immediately.
              </div>
            ) : (
              <div className="divide-y divide-[#1C3B2F] rounded-xl border border-[#1E3E31] bg-[#0B1F18] overflow-hidden">
                {openRooms.slice(0, 5).map((room) => (
                  <div
                    key={room.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#F5F2EB] flex items-center gap-2">
                        <span className="font-mono text-[#E5B95C]">{room.roomCode}</span>
                        <span className="text-xs text-[#9EB5AA] truncate">
                          Host: {room.seats[0]?.name || 'Player'}
                        </span>
                      </div>
                      <div className="text-xs text-[#88A598] mt-0.5">
                        {room.mode === 'quick' ? 'Quick' : 'Classic'} ·{' '}
                        <span className="font-mono tabular-nums">
                          {room.seats.length}/{room.maxPlayers}
                        </span>{' '}
                        seated · Stake {room.entryStake}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => joinRoom(room.roomCode)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#1A3F31] border border-[#2E5D4B] text-xs font-medium text-[#F5F2EB] hover:bg-[#235240] whitespace-nowrap cursor-pointer"
                    >
                      Join Table
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Offline Practice Mode Setup */}
        <div className="lg:col-span-5 rounded-2xl bg-[#102B22] border border-[#234739] p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#F5F2EB]">
                Offline Practice Arena
              </h2>
              <p className="text-xs text-[#9EB5AA] mt-1">
                Zero internet required. Practice tactics, earn daily challenge progress, and train
                against adaptive AI.
              </p>
            </div>

            <div>
              <div className="text-xs text-[#9EB5AA] mb-2">AI Difficulty</div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#0A1D16] border border-[#1E3D31]">
                {(['casual', 'tactical', 'grandmaster'] as AiDifficulty[]).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setPracticeDifficulty(diff)}
                    className={`py-2 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap cursor-pointer ${
                      practiceDifficulty === diff
                        ? 'bg-[#1D4637] text-[#F5F2EB]'
                        : 'text-[#8FA99C] hover:text-white'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-[#9EB5AA] mb-2">Opponents</div>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0A1D16] border border-[#1E3D31]">
                  {([2, 4] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setPracticePlayers(cnt)}
                      className={`py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        practicePlayers === cnt
                          ? 'bg-[#1D4637] text-[#F5F2EB]'
                          : 'text-[#8FA99C] hover:text-white'
                      }`}
                    >
                      {cnt === 2 ? '1v1' : '4-Way'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-[#9EB5AA] mb-2">Speed</div>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0A1D16] border border-[#1E3D31]">
                  {(['quick', 'classic'] as GameMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPracticeMode(m)}
                      className={`py-2 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap cursor-pointer ${
                        practiceMode === m
                          ? 'bg-[#1D4637] text-[#F5F2EB]'
                          : 'text-[#8FA99C] hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B1F18] border border-[#1D3D31] space-y-2 text-xs text-[#A5BDB2]">
              <div className="flex items-center gap-2 text-[#F5F2EB] font-medium">
                <Shield className="w-4 h-4 text-[#D4A446]" />
                Fair Play &amp; Smooth Retention
              </div>
              <p className="leading-relaxed">
                Practice wins credit coins, XP, and daily challenge milestones immediately. Online
                ranked matches enforce strict rule validation with zero pay-to-win advantages.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              launchOfflinePractice({
                mode: practiceMode,
                playerCount: practicePlayers,
                difficulty: practiceDifficulty,
              })
            }
            className="w-full py-3 px-5 rounded-xl bg-[#1A4234] border border-[#306350] text-sm font-semibold text-[#F5F2EB] hover:bg-[#225341] transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Users className="w-4 h-4 text-[#D4A446]" />
            Start Offline Practice Match
          </button>
        </div>
      </section>
    </div>
  );
}
