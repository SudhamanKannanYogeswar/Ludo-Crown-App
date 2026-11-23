import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { LEAGUE_META } from '../data/catalog';
import { PlayerAvatar } from './PlayerAvatar';

type SortMetric = 'elo' | 'wins' | 'captures';

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
  const avgCaptures =
    profile.gamesPlayed > 0 ? (profile.captures / profile.gamesPlayed).toFixed(1) : '0.0';
  const xpIntoLevel = profile.xp % 250;
  const xpPct = Math.round((xpIntoLevel / 250) * 100);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F5F2EB]">
            Performance &amp; Global Rankings
          </h1>
          <p className="mt-2 text-sm text-[#A5BDB2]">
            Detailed match telemetry, league progression, and real-time cross-device standings.
          </p>
        </div>

        {isSignedIn && (
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              refreshLeaderboard()
                .catch(() => {})
                .finally(() => setLoading(false));
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#123026] border border-[#24493A] text-xs font-medium text-[#C8D8D0] hover:text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Standings
          </button>
        )}
      </div>

      {/* Personal Performance Analytics Panel */}
      <section className="rounded-2xl bg-[#102B22] border border-[#234739] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#1E3F32]">
          <div className="flex items-center gap-4">
            <PlayerAvatar
              avatarId={profile.avatarId}
              frameId={profile.avatarFrame}
              size="lg"
              alt={profile.displayName}
            />
            <div>
              <div className="text-xs text-[#E5B95C]">{LEAGUE_META[profile.league].name}</div>
              <h2 className="font-display text-2xl font-semibold text-[#F5F2EB]">
                {profile.displayName}
              </h2>
              <div className="text-xs text-[#9EB5AA] mt-0.5 font-mono tabular-nums">
                Level {profile.level} · {xpIntoLevel}/250 XP to Level {profile.level + 1}
                {myRank > 0 && ` · Global Rank #${myRank}`}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-56">
            <div className="flex items-center justify-between text-xs text-[#9EB5AA] mb-1.5">
              <span>Season XP Progress</span>
              <span className="font-mono tabular-nums">{xpPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#0A1D16] overflow-hidden">
              <div className="h-full bg-[#D4A446]" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
          <div>
            <div className="text-xs text-[#8FA99C]">ELO Rating</div>
            <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-[#E5B95C]">
              {profile.elo}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8FA99C]">Matches Won</div>
            <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-[#F5F2EB]">
              {profile.wins}
              <span className="text-sm text-[#8FA99C] font-normal">/{profile.gamesPlayed}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8FA99C]">Win Rate</div>
            <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-[#F5F2EB]">
              {winRate}%
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8FA99C]">Total Captures</div>
            <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-[#F5F2EB]">
              {profile.captures}
            </div>
            <div className="text-[11px] text-[#8FA99C] font-mono tabular-nums">
              {avgCaptures} / match
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8FA99C]">Sixes Rolled</div>
            <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-[#F5F2EB]">
              {profile.sixesRolled}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8FA99C]">Best Streak</div>
            <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-[#F5F2EB]">
              {profile.bestStreak}
            </div>
            <div className="text-[11px] text-[#8FA99C] font-mono tabular-nums">
              Current: {profile.winStreak} · {profile.trophies} Cups
            </div>
          </div>
        </div>
      </section>

      {/* Global Leaderboard Table */}
      <section className="rounded-2xl bg-[#102B22] border border-[#234739] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E3F32] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-4 h-4 text-[#D4A446]" />
            <h2 className="font-display text-xl font-semibold text-[#F5F2EB]">
              Global Club Leaderboard
            </h2>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0A1D16] border border-[#1E3D31]">
            {(
              [
                ['elo', 'ELO Rating'],
                ['wins', 'Total Wins'],
                ['captures', 'Captures'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  sortBy === key
                    ? 'bg-[#1D4637] text-[#F5F2EB]'
                    : 'text-[#8FA99C] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!isSignedIn ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#A5BDB2] max-w-md mx-auto">
              Sign in with Google to publish your performance stats to the global leaderboard and
              compare ratings across devices.
            </p>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="mt-4 px-5 py-2.5 rounded-xl bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] cursor-pointer"
            >
              Sign in with Google
            </button>
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9EB5AA]">
            {loading ? 'Loading live standings...' : 'Play your first match to claim #1 on the board.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1D3D31] text-xs text-[#8FA99C]">
                  <th className="py-3.5 px-6 font-medium w-16">Rank</th>
                  <th className="py-3.5 px-4 font-medium">Player</th>
                  <th className="py-3.5 px-4 font-medium">League</th>
                  <th className="py-3.5 px-4 font-medium text-right">Wins</th>
                  <th className="py-3.5 px-4 font-medium text-right">Win Rate</th>
                  <th className="py-3.5 px-4 font-medium text-right">Captures</th>
                  <th className="py-3.5 px-6 font-medium text-right">ELO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A382C] text-sm">
                {sortedRows.map((row, idx) => {
                  const isMe = row.uid === profile.uid;
                  const rowRate =
                    row.gamesPlayed > 0 ? Math.round((row.wins / row.gamesPlayed) * 100) : 0;
                  return (
                    <tr
                      key={row.uid}
                      className={isMe ? 'bg-[#173B2E]/80' : 'hover:bg-[#133328]/60'}
                    >
                      <td className="py-3.5 px-6 font-mono tabular-nums text-xs text-[#E5B95C]">
                        #{idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <PlayerAvatar
                            avatarId={row.avatarId}
                            frameId={row.avatarFrame}
                            size="xs"
                            alt={row.displayName}
                          />
                          <span className="font-medium text-[#F5F2EB] whitespace-nowrap">
                            {row.displayName}
                            {isMe && <span className="ml-2 text-xs text-[#E5B95C]">(You)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#A5BDB2] whitespace-nowrap">
                        {LEAGUE_META[row.league].name}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#F5F2EB]">
                        {row.wins}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#B8C9C1]">
                        {rowRate}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#B8C9C1]">
                        {row.captures}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono tabular-nums font-semibold text-[#E5B95C]">
                        {row.elo}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
