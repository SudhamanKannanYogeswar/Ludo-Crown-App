import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BarChart3,
  Coins,
  Gem,
  Gift,
  Home,
  LogOut,
  Play,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AdaptiveBannerAd, AdMobModalHost, AdPolicyModal } from './components/AdMobOverlays';
import { AnimatedGameBackdrop } from './components/AnimatedGameBackdrop';
import { AtelierView } from './components/AtelierView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FriendsView } from './components/FriendsView';
import { LeaderboardView } from './components/LeaderboardView';
import { LobbyView } from './components/LobbyView';
import { LuckySpinModal } from './components/LuckySpinModal';
import { MatchArena } from './components/MatchArena';
import { PlayerAvatar } from './components/PlayerAvatar';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { RewardsView } from './components/RewardsView';
import { TournamentsView } from './components/TournamentsView';
import { AppProvider, useApp } from './contexts/AppContext';
import { ActiveTab } from './types';

const MENU_TABS: { id: ActiveTab; label: string; icon: typeof Home }[] = [
  { id: 'lobby', label: 'Home', icon: Home },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'leaderboard', label: 'Ranks', icon: BarChart3 },
  { id: 'tournaments', label: 'Cups', icon: Trophy },
  { id: 'rewards', label: 'Rewards', icon: Gift },
];

function LudoCrownShell() {
  const {
    isSignedIn,
    profile,
    wallet,
    activeTab,
    setActiveTab,
    soundMuted,
    toggleSoundMuted,
    backdropThemeId,
    activeRoom,
    myActiveRooms,
    activeMatchConflict,
    dismissActiveMatchConflict,
    confirmExitAndStartNewMatch,
    rejoinActiveRoom,
    offlineMatch,
    signInWithGoogle,
    signOutUser,
    toast,
    friendships,
    incomingInvites,
  } = useApp();

  const [wheelOpen, setWheelOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);

  const isPlaying = activeTab === 'play';
  const primaryRunningRoom = activeRoom || myActiveRooms[0] || null;
  const showGlobalResumeStrip =
    !isPlaying &&
    (Boolean(offlineMatch) || (Boolean(primaryRunningRoom) && activeTab !== 'lobby'));

  const pendingFriendRequests = friendships.filter(
    (f) => f.status === 'pending' && f.recipientUid === profile.uid
  ).length;
  const friendsBadgeCount = incomingInvites.length + pendingFriendRequests;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex flex-col text-[#111827] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <AnimatedGameBackdrop backdropThemeId={backdropThemeId} />

      {!isPlaying && (
        <div className="shrink-0 z-30">
          <AdaptiveBannerAd
            position="top"
            onInspectPolicy={() => setPolicyOpen(true)}
            onOpenRewards={() => setActiveTab('rewards')}
          />
        </div>
      )}

      {!isPlaying && (
        <header className="shrink-0 z-30 bg-white/95 backdrop-blur-md border-b-2 border-[#BAE6FD] shadow-[0_2px_10px_rgba(37,99,235,0.08)]">
          <div className="max-w-[1160px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('atelier')}
              className="flex items-center gap-2 min-w-0 cursor-pointer group"
              title="Customize Profile, Board & Dice Shop"
            >
              <PlayerAvatar
                avatarId={profile.avatarId}
                frameId={profile.avatarFrame}
                size="xs"
                alt={profile.displayName}
              />
              <div className="text-left min-w-0">
                <div className="font-display text-xs sm:text-sm font-extrabold text-[#111827] truncate max-w-[96px] sm:max-w-[140px] group-hover:text-[#2563EB] transition-colors leading-tight">
                  {profile.displayName}
                </div>
                <div className="text-[10px] font-mono font-bold tabular-nums text-[#2563EB] leading-none mt-0.5">
                  LV.{profile.level} · {profile.elo} pts
                </div>
              </div>
            </button>

            <nav
              aria-label="Game menu"
              className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-[#E0F2FE] border-2 border-[#111827] shadow-[0_2px_0_#111827]"
            >
              {MENU_TABS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                const showBadge = item.id === 'friends' && friendsBadgeCount > 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-display font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-gradient-to-b from-[#38BDF8] to-[#1D4ED8] text-white border border-[#111827] shadow-xs'
                        : 'text-[#1E293B] hover:text-[#111827] hover:bg-white/90'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                    {showBadge && (
                      <span className="ml-0.5 inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-gradient-to-b from-[#FF5E7E] to-[#E11D48] text-white text-[10px] font-mono font-extrabold border border-[#111827] animate-badge-bob">
                        {friendsBadgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('rewards')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-b from-[#FFF066] to-[#FACC15] border-2 border-[#111827] shadow-[0_2px_0_#111827] text-[11px] sm:text-xs font-mono font-extrabold tabular-nums text-[#111827] cursor-pointer hover:brightness-105 transition-all"
                title="Open Rewards & Coin Refill"
              >
                <Coins className="w-3.5 h-3.5 shrink-0 text-[#B45309]" />
                <span>{wallet.coins.toLocaleString()}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('atelier')}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-b from-[#FFE4EC] to-[#FDA4AF] border-2 border-[#111827] shadow-[0_2px_0_#111827] text-xs font-mono font-extrabold tabular-nums text-[#111827] cursor-pointer hover:brightness-105 transition-all"
                title="Open Atelier & Cosmetic Shop"
              >
                <Gem className="w-3.5 h-3.5 text-[#E11D48] shrink-0" />
                <span>{wallet.gems}</span>
              </button>

              <PWAInstallButton />

              <button
                type="button"
                onClick={toggleSoundMuted}
                className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-[#F1F5F9] border-2 border-[#CBD5E1] hover:border-[#111827] text-[#111827] cursor-pointer"
                aria-label={soundMuted ? 'Unmute game audio' : 'Mute game audio'}
              >
                {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {isSignedIn ? (
                <button
                  type="button"
                  onClick={signOutUser}
                  className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-[#FEE2E2] border-2 border-[#CBD5E1] hover:border-[#111827] text-[#111827] cursor-pointer"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl font-display font-extrabold text-[11px] sm:text-xs game-btn-blue whitespace-nowrap cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {showGlobalResumeStrip && (
        <div className="relative shrink-0 z-20 bg-[#FEF9C3] border-b-2 border-[#111827] px-3 py-1.5">
          <div className="max-w-[1160px] mx-auto flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#111827] truncate">
              {primaryRunningRoom
                ? `Live table ${primaryRunningRoom.roomCode} is ${
                    primaryRunningRoom.status === 'playing'
                      ? 'running (Auto-Play active).'
                      : 'waiting for players.'
                  }`
                : 'Match paused on the board.'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (primaryRunningRoom && !activeRoom) {
                  rejoinActiveRoom(primaryRunningRoom.id);
                } else {
                  setActiveTab('play');
                }
              }}
              className="px-3 py-1 rounded-lg font-display font-extrabold text-[11px] game-btn-blue whitespace-nowrap cursor-pointer"
            >
              {primaryRunningRoom ? 'Rejoin' : 'Resume'}
            </button>
          </div>
        </div>
      )}

      <main className="relative flex-1 min-h-0 w-full overflow-y-auto no-scrollbar">
        {activeTab === 'lobby' && (
          <LobbyView
            onOpenWheel={() => setWheelOpen(true)}
            onOpenAdPolicy={() => setPolicyOpen(true)}
          />
        )}
        {activeTab === 'friends' && <FriendsView />}
        {activeTab === 'play' && <MatchArena />}
        {activeTab === 'tournaments' && <TournamentsView />}
        {activeTab === 'leaderboard' && <LeaderboardView />}
        {activeTab === 'rewards' && <RewardsView />}
        {activeTab === 'atelier' && <AtelierView />}
      </main>

      {!isPlaying && (
        <nav
          aria-label="Mobile game navigation"
          className="md:hidden shrink-0 z-30 h-15 bg-white/98 backdrop-blur-md border-t-2 border-[#BAE6FD] grid grid-cols-5"
        >
          {MENU_TABS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const showBadge = item.id === 'friends' && friendsBadgeCount > 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-display font-extrabold cursor-pointer transition-colors ${
                  active ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                <span
                  className={`relative px-2.5 py-0.5 rounded-xl transition-colors ${
                    active ? 'bg-[#DBEAFE] border border-[#60A5FA]' : ''
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-gradient-to-b from-[#FF5E7E] to-[#E11D48] text-white text-[9px] font-mono font-extrabold flex items-center justify-center border border-[#111827] animate-badge-bob">
                      {friendsBadgeCount}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-15 right-3 sm:right-6 z-50 max-w-xs px-4 py-2.5 rounded-2xl border-2 border-[#111827] shadow-[0_4px_0_#111827] text-xs font-extrabold animate-pop-in ${
            toast.tone === 'error'
              ? 'bg-[#E11D48] text-white'
              : toast.tone === 'success'
                ? 'bg-[#FACC15] text-[#111827]'
                : 'bg-[#1D4ED8] text-white'
          }`}
        >
          {toast.text}
        </div>
      )}

      {!(isPlaying && activeRoom) && <OfflineIndicator />}
      <LuckySpinModal open={wheelOpen} onClose={() => setWheelOpen(false)} />
      <AdPolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />
      <AdMobModalHost />

      {activeMatchConflict &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Active match already running"
            onClick={(e) => {
              if (e.target === e.currentTarget && !conflictBusy) {
                dismissActiveMatchConflict();
              }
            }}
          >
            <div className="w-full max-w-sm rounded-3xl bg-white border-2 border-[#111827] shadow-[0_6px_0_#111827] p-5 space-y-4 animate-pop-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#FEF3C7] border-2 border-[#111827] flex items-center justify-center text-[#D97706] shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-[#111827] leading-tight">
                      Active Match Running
                    </h2>
                    <p className="text-[11px] font-mono font-bold text-[#1D4ED8]">
                      Room {activeMatchConflict.room.roomCode} · {activeMatchConflict.room.maxPlayers}P{' '}
                      {activeMatchConflict.room.mode === 'quick' ? 'Quick' : 'Classic'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={conflictBusy}
                  onClick={dismissActiveMatchConflict}
                  className="p-1.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] cursor-pointer disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-2xl bg-[#FEF9C3] border border-[#FACC15] p-3 text-xs text-[#713F12] leading-relaxed">
                You can only play <strong>one match at a time</strong>. Rejoin your current table,
                or permanently exit it to start a new game.{' '}
                {activeMatchConflict.room.status === 'playing' && (
                  <strong>Exiting forfeits all rewards from the current match.</strong>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={conflictBusy}
                  onClick={async () => {
                    const roomId = activeMatchConflict.room.id;
                    dismissActiveMatchConflict();
                    await rejoinActiveRoom(roomId);
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl game-btn-blue btn-gloss-sheen font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Rejoin Table {activeMatchConflict.room.roomCode}</span>
                </button>
                <button
                  type="button"
                  disabled={conflictBusy}
                  onClick={async () => {
                    setConflictBusy(true);
                    try {
                      await confirmExitAndStartNewMatch();
                    } finally {
                      setConflictBusy(false);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#B91C1C] border-2 border-[#111827] shadow-[0_3px_0_#111827] font-display font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>
                    {conflictBusy
                      ? 'Exiting & Starting...'
                      : `Exit Current Match & ${activeMatchConflict.actionLabel}`}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <LudoCrownShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
