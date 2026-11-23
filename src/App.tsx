import { Gift, Home, LogOut, Palette, Trophy, Users } from 'lucide-react';
import { AdaptiveBannerAd, AdMobModalHost } from './components/AdMobOverlays';
import { AtelierView } from './components/AtelierView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LeaderboardView } from './components/LeaderboardView';
import { LobbyView } from './components/LobbyView';
import { MatchArena } from './components/MatchArena';
import { RewardsView } from './components/RewardsView';
import { TournamentsView } from './components/TournamentsView';
import { AppProvider, useApp } from './contexts/AppContext';
import { ActiveTab } from './types';

const NAV_ITEMS: { id: ActiveTab; label: string; icon: typeof Home }[] = [
  { id: 'lobby', label: 'Lobby', icon: Home },
  { id: 'tournaments', label: 'Leagues', icon: Trophy },
  { id: 'leaderboard', label: 'Rankings', icon: Users },
  { id: 'rewards', label: 'Rewards', icon: Gift },
  { id: 'atelier', label: 'Atelier', icon: Palette },
];

function LudoCrownShell() {
  const {
    isSignedIn,
    profile,
    activeTab,
    setActiveTab,
    activeRoom,
    offlineMatch,
    signInWithGoogle,
    signOutUser,
    toast,
  } = useApp();

  const hasActiveMatch = Boolean(activeRoom || offlineMatch);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B231B] text-[#F5F2EB]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#0B231B]/95 backdrop-blur-md border-b border-[#1D3E31]">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('lobby')}
            className="font-display text-xl font-semibold tracking-tight text-[#F5F2EB] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ludo Crown
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                    active
                      ? 'text-[#F5F2EB] border-[#D4A446]'
                      : 'text-[#9EB5AA] border-transparent hover:text-[#F5F2EB]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center shrink-0">
            {isSignedIn ? (
              <button
                type="button"
                onClick={signOutUser}
                title={`Signed in as ${profile.displayName}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14352A] border border-[#285141] text-xs font-medium text-[#F5F2EB] hover:bg-[#1B4436] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="max-w-[120px] truncate">{profile.displayName}</span>
                <LogOut className="w-3.5 h-3.5 text-[#9EB5AA]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-4 py-2 rounded-lg bg-[#D4A446] text-[#0B231B] text-xs font-semibold hover:bg-[#E1B45B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Quiet Resume Active Match Bar if user browsed another tab mid-game */}
      {hasActiveMatch && activeTab !== 'play' && (
        <div className="bg-[#15392C] border-b border-[#2A5846] px-4 py-2">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4 text-xs">
            <span className="text-[#D8E5DF]">
              {activeRoom
                ? `Live multiplayer table ${activeRoom.roomCode} is currently open.`
                : 'Your offline practice match is paused and ready.'}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('play')}
              className="font-semibold text-[#E5B95C] hover:underline whitespace-nowrap cursor-pointer"
            >
              Return to Board
            </button>
          </div>
        </div>
      )}

      {/* Main Content Stage */}
      <main className="flex-1 pb-16 md:pb-6">
        {activeTab === 'lobby' && <LobbyView />}
        {activeTab === 'play' && <MatchArena />}
        {activeTab === 'tournaments' && <TournamentsView />}
        {activeTab === 'leaderboard' && <LeaderboardView />}
        {activeTab === 'rewards' && <RewardsView />}
        {activeTab === 'atelier' && <AtelierView />}
      </main>

      {/* Non-Intrusive Adaptive Banner Ad Slot (Strictly hidden during active board play) */}
      {activeTab !== 'play' && (
        <div className="hidden md:block">
          <AdaptiveBannerAd onOpenRewards={() => setActiveTab('rewards')} />
        </div>
      )}

      {/* Quiet Footer (Desktop) */}
      <footer className="hidden md:block border-t border-[#18352A] bg-[#081B14] py-4 px-6">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between text-xs text-[#789588]">
          <span>Ludo Crown · Cross-Platform Tabletop &amp; Competitive Leagues</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveTab('rewards')}
              className="hover:text-[#F5F2EB] cursor-pointer"
            >
              Android AdMob Config
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('atelier')}
              className="hover:text-[#F5F2EB] cursor-pointer"
            >
              Cosmetics
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Thumb Navigation Bar (Slim 56px height to respect <=15% mobile sticky cap) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-[#091D16]/95 backdrop-blur-md border-t border-[#1E3F32] grid grid-cols-5"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
                active ? 'text-[#E5B95C]' : 'text-[#8FA99C]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Global Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 max-w-sm px-4 py-3 rounded-xl border text-xs font-medium shadow-2xl ${
            toast.tone === 'error'
              ? 'bg-[#3D151B] border-[#7F2430] text-[#FDE8E8]'
              : toast.tone === 'success'
                ? 'bg-[#123629] border-[#2E6B53] text-[#E6F7EE]'
                : 'bg-[#122D24] border-[#285141] text-[#F5F2EB]'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Rewarded Video & Frequency-Capped Interstitial Ad Modal Host */}
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
