import { useState } from 'react';
import {
  BarChart3,
  Coins,
  Gem,
  Gift,
  Home,
  LogOut,
  Trophy,
  Users,
  Volume2,
  VolumeX,
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
    activeRoom,
    offlineMatch,
    signInWithGoogle,
    signOutUser,
    toast,
    friendships,
    incomingInvites,
  } = useApp();

  const [wheelOpen, setWheelOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const hasActiveMatch = Boolean(activeRoom || offlineMatch);
  const isPlaying = activeTab === 'play';

  const pendingFriendRequests = friendships.filter(
    (f) => f.status === 'pending' && f.recipientUid === profile.uid
  ).length;
  const friendsBadgeCount = incomingInvites.length + pendingFriendRequests;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex flex-col text-[#111827] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <AnimatedGameBackdrop />

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

      {hasActiveMatch && !isPlaying && (
        <div className="relative shrink-0 z-20 bg-[#FEF9C3] border-b-2 border-[#111827] px-3 py-1.5">
          <div className="max-w-[1160px] mx-auto flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#111827] truncate">
              {activeRoom
                ? `Live table ${activeRoom.roomCode} is active.`
                : 'Match paused on the board.'}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('play')}
              className="px-3 py-1 rounded-lg font-display font-extrabold text-[11px] game-btn-blue whitespace-nowrap cursor-pointer"
            >
              Resume
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
        <div className="shrink-0 z-20">
          <AdaptiveBannerAd
            onInspectPolicy={() => setPolicyOpen(true)}
            onOpenRewards={() => setActiveTab('rewards')}
          />
        </div>
      )}

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

      <OfflineIndicator />
      <LuckySpinModal open={wheelOpen} onClose={() => setWheelOpen(false)} />
      <AdPolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />
      <AdMobModalHost />
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
