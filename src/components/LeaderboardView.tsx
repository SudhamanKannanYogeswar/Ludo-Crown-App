import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { LEAGUE_META } from '../data/catalog';

type SortMetric = 'elo' | 'wins' | 'captures';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'PL';
}

export function LeaderboardView() {
  const { isSignedIn, profile, leaderboard, refreshLeaderboard, signInWithGoogle } = useApp();
  const [sortBy, setSortBy] = useState<SortMetric>('elo');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      setLoading(true);
      refreshLeaderboard()
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isSignedIn, refreshLeaderboard]);

  const sortedRows = useMemo(() => {
    const copy = [...leaderboard];
    copy.sort((a, b) => {
      if (sortBy === 'wins') return b.wins - a.wins || b.elo - a.elo;
      if (sortBy === 'captures') return b.captures - a.captures || b.elo - a.elo;
      return b.elo - a.elo || b.wins - a.wins;
    });
    return copy;
  }, [leaderboard, sortBy]);

  const myRank = sortedRows.findIndex((p) => p.uid === profile.uid) + 1;
  const winRate =
    profile.gamesPlayed > 0 ? Math.round((profile.wins / profile.gamesPlayed) * 100) : 0;

  const top1 = sortedRows[0] || null;
  const top2 = sortedRows[1] || null;
  const top3 = sortedRows[2] || null;
  const restRows = sortedRows.slice(3);

  const formatMetric = (row: { elo: number; wins: number; captures: number }) => {
    if (sortBy === 'wins') return `${row.wins} wins`;
    if (sortBy === 'captures') return `${row.captures} caps`;
    return `${row.elo.toLocaleString()} pts`;
  };

  return (
    <div className="max-w-[780px] mx-auto px-4 sm:px-6 py-5 pb-8 space-y-6">
      {/* Header: Season Ranks + Weekly reset */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            Season Ranks
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">Live ELO standings &amp; league tiers</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#64748B]">Weekly reset</span>
          {isSignedIn && (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                refreshLeaderboard()
                  .catch(() => {})
                  .finally(() => setLoading(false));
              }}
              className="p-2 rounded-xl bg-white border-2 border-[#111827] text-[#111827] hover:bg-[#F1F5F9] cursor-pointer"
              aria-label="Refresh standings"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Personal Stats Card — Radiant Sky-Cobalt Gradient with Ink Border */}
      <section className="rounded-3xl bg-gradient-to-br from-[#BAE6FD] via-[#DBEAFE] to-[#EFF6FF] border-2 border-[#111827] shadow-[0_5px_0_#111827,0_10px_22px_rgba(37,99,235,0.14)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#38BDF8] to-[#1D4ED8] border-2 border-[#111827] text-white font-display font-black text-base flex items-center justify-center shrink-0 shadow-xs">
              {getInitials(profile.displayName)}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-extrabold text-[#111827] truncate">
                {profile.displayName} (You)
              </h2>
              <div className="text-xs font-extrabold text-[#1D4ED8]">
                {LEAGUE_META[profile.league].name}
                {myRank > 0 ? ` · #${myRank} overall` : ` · ${profile.elo} pts`}
              </div>
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#FFF066] to-[#FACC15] border-2 border-[#111827] flex items-center justify-center shrink-0 shadow-[0_3px_0_#111827]">
            <Trophy className="w-6 h-6 text-[#B45309] animate-badge-bob" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl bg-white/95 border-2 border-[#60A5FA] px-3 py-2.5 shadow-xs">
            <div className="font-display text-lg sm:text-xl font-extrabold text-[#111827] tabular-nums">
              {profile.wins}
            </div>
            <div className="text-[11px] font-bold text-[#2563EB]">Wins</div>
          </div>

          <div className="rounded-2xl bg-white/95 border-2 border-[#60A5FA] px-3 py-2.5 shadow-xs">
            <div className="font-display text-lg sm:text-xl font-extrabold text-[#111827] tabular-nums">
              {winRate}%
            </div>
            <div className="text-[11px] font-bold text-[#059669]">Win rate</div>
          </div>

          <div className="rounded-2xl bg-white/95 border-2 border-[#60A5FA] px-3 py-2.5 shadow-xs">
            <div className="font-display text-lg sm:text-xl font-extrabold text-[#111827] tabular-nums">
              {profile.bestStreak}
            </div>
            <div className="text-[11px] font-bold text-[#E11D48]">Best streak</div>
          </div>
        </div>
      </section>

      {/* Metric Filter Strip */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-extrabold text-[#111827]">Top Standings</span>
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white border-2 border-[#111827]">
          {(
            [
              ['elo', 'Points'],
              ['wins', 'Wins'],
              ['captures', 'Captures'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={`px-3 py-1 rounded-xl text-xs font-display font-extrabold cursor-pointer transition-colors ${
                sortBy === key
                  ? 'bg-[#1D4ED8] text-white'
                  : 'text-[#475569] hover:text-[#111827]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Body */}
      {!isSignedIn ? (
        <div className="studio-card rounded-3xl p-7 text-center space-y-3">
          <Trophy className="w-9 h-9 text-[#EAB308] mx-auto" />
          <div className="font-display text-base font-extrabold text-[#111827]">
            Join the global podium
          </div>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            Sign in with Google to save your ELO rating and climb the live Season Ranks leaderboard.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-5 py-2.5 rounded-2xl font-display font-extrabold text-xs game-btn-blue cursor-pointer"
          >
            Sign In with Google
          </button>
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="studio-card-soft rounded-3xl p-8 text-center text-xs text-[#64748B]">
          {loading ? 'Loading live standings...' : 'Play your first match to claim #1 on the podium!'}
        </div>
      ) : (
        <div className="space-y-5">
          {/* 3-STEP VISUAL PODIUM (Radiant Glossy Arcade Edition) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 items-end pt-3">
            {/* #2 Left Podium */}
            <div className="flex flex-col items-center">
              {top2 ? (
                <>
                  <div className="w-11 h-11 rounded-full bg-gradient-to-b from-[#FFF066] to-[#F59E0B] border-2 border-[#111827] text-[#111827] font-display font-black text-xs flex items-center justify-center mb-1.5 shadow-xs">
                    {getInitials(top2.displayName)}
                  </div>
                  <div className="font-display text-xs font-extrabold text-[#111827] truncate max-w-full px-1 mb-2">
                    {top2.displayName}
                  </div>
                  <div className="w-full rounded-t-2xl bg-gradient-to-b from-[#FFFFFF] to-[#E0F2FE] border-2 border-[#111827] shadow-[0_4px_0_#111827] py-4 px-2 text-center min-h-[96px] flex flex-col justify-center">
                    <div className="font-display text-xl font-black text-[#111827]">2</div>
                    <div className="font-mono text-[11px] font-extrabold text-[#1D4ED8] mt-0.5 truncate">
                      {formatMetric(top2)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full rounded-t-2xl bg-white/80 border-2 border-dashed border-[#93C5FD] py-4 text-center min-h-[96px] flex flex-col justify-center">
                  <div className="font-display text-lg font-extrabold text-[#94A3B8]">2</div>
                  <div className="text-[11px] text-[#94A3B8]">Open</div>
                </div>
              )}
            </div>

            {/* #1 Center Tall Radiant Sunburst Gold Podium */}
            <div className="flex flex-col items-center">
              {top1 && (
                <>
                  <Trophy className="w-6 h-6 text-[#FF2E54] fill-[#FFE033] mb-1 animate-badge-bob drop-shadow-xs" />
                  <div className="relative mb-1.5">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 36 36"
                      className="pointer-events-none absolute -top-2 -left-4 w-5 h-5 animate-sparkle"
                    >
                      <path
                        d="M18 2 L22 14 L34 18 L22 22 L18 34 L14 22 L2 18 L14 14 Z"
                        fill="#FFE033"
                        stroke="#111827"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 36 36"
                      className="pointer-events-none absolute -top-1 -right-4 w-4 h-4 animate-sparkle"
                      style={{ animationDelay: '0.8s' }}
                    >
                      <path
                        d="M18 2 L22 14 L34 18 L22 22 L18 34 L14 22 L2 18 L14 14 Z"
                        fill="#38BDF8"
                        stroke="#111827"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="w-13 h-13 rounded-full bg-gradient-to-b from-[#FF5E7E] to-[#E11D48] border-2 border-[#111827] text-white font-display font-black text-sm flex items-center justify-center shadow-[0_3px_0_#111827]">
                      {getInitials(top1.displayName)}
                    </div>
                  </div>
                  <div className="font-display text-xs sm:text-sm font-extrabold text-[#111827] truncate max-w-full px-1 mb-2">
                    {top1.displayName}
                  </div>
                  <div className="btn-gloss-sheen w-full rounded-t-2xl bg-gradient-to-b from-[#FFF066] via-[#FFD41F] to-[#F59E0B] border-2 border-[#111827] shadow-[inset_0_2px_0_rgba(255,255,255,0.7),0_5px_0_#111827] py-5 px-2 text-center min-h-[126px] flex flex-col justify-center">
                    <div className="font-display text-2xl font-black text-[#111827]">1</div>
                    <div className="font-mono text-xs font-extrabold text-[#111827] mt-0.5 truncate">
                      {formatMetric(top1)}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* #3 Right Podium */}
            <div className="flex flex-col items-center">
              {top3 ? (
                <>
                  <div className="w-11 h-11 rounded-full bg-gradient-to-b from-[#34F59F] to-[#059669] border-2 border-[#111827] text-white font-display font-black text-xs flex items-center justify-center mb-1.5 shadow-xs">
                    {getInitials(top3.displayName)}
                  </div>
                  <div className="font-display text-xs font-extrabold text-[#111827] truncate max-w-full px-1 mb-2">
                    {top3.displayName}
                  </div>
                  <div className="w-full rounded-t-2xl bg-gradient-to-b from-[#FFFFFF] to-[#DCFCE7] border-2 border-[#111827] shadow-[0_4px_0_#111827] py-3.5 px-2 text-center min-h-[82px] flex flex-col justify-center">
                    <div className="font-display text-xl font-black text-[#111827]">3</div>
                    <div className="font-mono text-[11px] font-extrabold text-[#047857] mt-0.5 truncate">
                      {formatMetric(top3)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full rounded-t-2xl bg-white/80 border-2 border-dashed border-[#93C5FD] py-3.5 text-center min-h-[82px] flex flex-col justify-center">
                  <div className="font-display text-lg font-extrabold text-[#94A3B8]">3</div>
                  <div className="text-[11px] text-[#94A3B8]">Open</div>
                </div>
              )}
            </div>
          </div>

          {/* Ranked List #4 and Beyond */}
          {restRows.length > 0 && (
            <div className="space-y-2.5">
              {restRows.map((row, i) => {
                const rank = i + 4;
                const isMe = row.uid === profile.uid;
                return (
                  <div
                    key={row.uid}
                    className={`rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 ${
                      isMe
                        ? 'bg-white border-2 border-[#111827] shadow-[0_3px_0_#111827]'
                        : 'studio-card-soft'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-extrabold text-[#64748B] w-7 shrink-0">
                        #{rank}
                      </span>
                      <span className="font-display text-sm font-extrabold text-[#111827] truncate">
                        {row.displayName}
                        {isMe && <span className="ml-1 text-[#1D4ED8]">(You)</span>}
                      </span>
                    </div>

                    <span className="font-mono text-xs sm:text-sm font-extrabold text-[#1D4ED8] tabular-nums shrink-0">
                      {formatMetric(row)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
