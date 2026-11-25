import { useState } from 'react';
import {
  Coins,
  Gem,
  Gift,
  Home,
  LogOut,
  Palette,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AdaptiveBannerAd, AdMobModalHost, AdPolicyModal } from './components/AdMobOverlays';
import { AnimatedGameBackdrop } from './components/AnimatedGameBackdrop';
import { AtelierView } from './components/AtelierView';
import { ErrorBoundary } from './components/ErrorBoundary';
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
  { id: 'tournaments', label: 'Cups', icon: Trophy },
  { id: 'leaderboard', label: 'Rank', icon: Users },
  { id: 'rewards', label: 'Rewards', icon: Gift },
  { id: 'atelier', label: 'Shop', icon: Palette },
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
  } = useApp();

  const [wheelOpen, setWheelOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const hasActiveMatch = Boolean(activeRoom || offlineMatch);
  const isPlaying = activeTab === 'play';

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex flex-col text-[#F5F0E6]">
      <AnimatedGameBackdrop />

      {!isPlaying && (
        <header className="shrink-0 z-30 bg-[#0D1A15]/92 backdrop-blur-md border-b border-[#D6BC84]/18">
          <div className="max-w-[1260px] mx-auto px-3 sm:px-6 h-13 sm:h-14 flex items-center justify-between gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('atelier')}
              className="flex items-center gap-2 min-w-0 cursor-pointer group"
            >
              <PlayerAvatar
                avatarId={profile.avatarId}
                frameId={profile.avatarFrame}
                size="xs"
                alt={profile.displayName}
              />
              <div className="text-left min-w-0">
                <div className="font-display text-xs sm:text-sm font-bold text-white truncate max-w-[96px] sm:max-w-[140px] group-hover:text-[#F6C343] transition-colors leading-tight">
                  {profile.displayName}
                </div>
                <div className="text-[10px] font-mono tabular-nums text-[#9BB0A5] leading-none mt-0.5">
                  LV.{profile.level} · {profile.elo}
                </div>
              </div>
            </button>

            <nav
              aria-label="Game menu"
              className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-[#091310] border border-[#243B32]"
            >
              {MENU_TABS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#E5B852] text-[#1A1000]'
                        : 'text-[#B8C7BF] hover:text-[#F5F0E6] hover:bg-[#162922]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('rewards')}
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-[#152620] border border-[#2B463B] hover:border-[#E5B852] text-[11px] sm:text-xs font-mono font-bold tabular-nums text-[#EBC46A] cursor-pointer"
                title="Open Rewards & Coin Refill"
              >
                <Coins className="w-3.5 h-3.5 shrink-0" />
                <span>{wallet.coins.toLocaleString()}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('atelier')}
                className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-xl bg-[#152620] border border-[#2B463B] hover:border-[#D49A2A] text-xs font-mono font-bold tabular-nums text-[#EADCC0] cursor-pointer"
                title="Gems Balance"
              >
                <Gem className="w-3.5 h-3.5 text-[#D8A4E8] shrink-0" />
                <span>{wallet.gems}</span>
              </button>

              <PWAInstallButton />

              <button
                type="button"
                onClick={toggleSoundMuted}
                className="p-1.5 sm:p-2 rounded-xl bg-[#152620] border border-[#2B463B] text-[#C8D6CE] hover:text-white cursor-pointer"
                aria-label={soundMuted ? 'Unmute game audio' : 'Mute game audio'}
              >
                {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {isSignedIn ? (
                <button
                  type="button"
                  onClick={signOutUser}
                  className="p-1.5 sm:p-2 rounded-xl bg-[#152620] border border-[#2B463B] text-[#9BB0A5] hover:text-white cursor-pointer"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl font-display font-bold text-[11px] sm:text-xs game-btn-gold whitespace-nowrap cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {hasActiveMatch && !isPlaying && (
        <div className="relative shrink-0 z-20 bg-[#1B3329] border-b border-[#D6BC84]/25 px-3 py-1">
          <div className="max-w-[1260px] mx-auto flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-white truncate">
              {activeRoom
                ? `Live table ${activeRoom.roomCode} is active.`
                : 'Match paused on the board.'}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('play')}
              className="px-3 py-1 rounded-lg font-display font-bold text-[11px] game-btn-gold whitespace-nowrap cursor-pointer"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      <main className="relative z-10 flex-1 min-h-0 w-full overflow-y-auto no-scrollbar">
        {activeTab === 'lobby' && (
          <LobbyView
            onOpenWheel={() => setWheelOpen(true)}
            onOpenAdPolicy={() => setPolicyOpen(true)}
          />
        )}
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
          className="md:hidden shrink-0 z-30 h-14 bg-[#0B1713]/96 backdrop-blur-md border-t border-[#D6BC84]/18 grid grid-cols-5"
        >
          {MENU_TABS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-display font-bold cursor-pointer transition-colors ${
                  active ? 'text-[#EBC46A]' : 'text-[#8FA59A]'
                }`}
              >
                <Icon className="w-4 h-4" />
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
          className={`fixed top-14 right-3 sm:right-6 z-50 max-w-xs px-3.5 py-2.5 rounded-2xl border text-xs font-semibold shadow-2xl animate-pop-in ${
            toast.tone === 'error'
              ? 'bg-[#3D1219] border-[#D64545] text-[#FFE4E6]'
              : toast.tone === 'success'
                ? 'bg-[#103023] border-[#2B9464] text-[#D1FAE5]'
                : 'bg-[#152620] border-[#D6BC84]/40 text-[#F5F0E6]'
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
