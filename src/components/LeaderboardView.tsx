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
    <div className="max-w-[1260px] mx-auto px-3 sm:px-6 py-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            RANKINGS &amp; STATS
          </h1>
          <p className="text-xs text-[#A6BBB0] mt-0.5">
            Live global ELO standings and your personal career stats.
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
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A2F26] border border-[#2F4E42] text-xs font-bold text-[#C5D5CC] hover:text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {/* Personal Stats Card */}
      <section className="rounded-3xl bg-[#14251E]/95 border-2 border-[#2E4C40] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#274136]">
          <div className="flex items-center gap-3.5">
            <PlayerAvatar
              avatarId={profile.avatarId}
              frameId={profile.avatarFrame}
              size="md"
              alt={profile.displayName}
            />
            <div>
              <div className="text-xs font-bold text-[#EAB957]">
                {LEAGUE_META[profile.league].name.toUpperCase()}
              </div>
              <h2 className="font-display text-xl font-extrabold text-white">
                {profile.displayName}
              </h2>
              <div className="text-xs text-[#9BB0A5] font-mono tabular-nums">
                LV.{profile.level} · {xpIntoLevel}/250 XP
                {myRank > 0 && ` · Rank #${myRank}`}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-52">
            <div className="flex justify-between text-[11px] text-[#A6BBB0] mb-1 font-mono">
              <span>NEXT LEVEL</span>
              <span>{xpPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#0C1814] overflow-hidden">
              <div className="h-full bg-[#EAB957]" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
          {[
            { label: 'ELO', value: String(profile.elo), gold: true },
            { label: 'WINS', value: `${profile.wins}/${profile.gamesPlayed}` },
            { label: 'WIN %', value: `${winRate}%` },
            { label: 'CAPTURES', value: `${profile.captures} (${avgCaptures})` },
            { label: 'SIXES', value: String(profile.sixesRolled) },
            { label: 'STREAK', value: `${profile.bestStreak} · ${profile.trophies} Cups` },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-3 rounded-2xl bg-[#0C1814] border border-[#274136]"
            >
              <div className="text-[10px] font-bold text-[#94A3B8]">{stat.label}</div>
              <div
                className={`mt-1 font-mono tabular-nums text-sm sm:text-base font-bold ${
                  stat.gold ? 'text-[#EAB957]' : 'text-white'
                }`}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Global Leaderboard */}
      <section className="rounded-3xl bg-[#14251E]/95 border-2 border-[#2E4C40] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#274136] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#EAB957]" />
            <h2 className="font-display text-lg font-bold text-white">Global Leaderboard</h2>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0C1814] border border-[#274136]">
            {(
              [
                ['elo', 'ELO'],
                ['wins', 'Wins'],
                ['captures', 'Captures'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold cursor-pointer ${
                  sortBy === key
                    ? 'bg-[#EAB957] text-[#1A1000]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!isSignedIn ? (
          <div className="p-8 text-center">
            <p className="text-xs text-[#9BB0A5] max-w-sm mx-auto">
              Sign in with Google to appear on the live global leaderboard across devices.
            </p>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="mt-4 px-5 py-2.5 rounded-2xl font-display font-bold text-xs game-btn-gold cursor-pointer"
            >
              Sign In with Google
            </button>
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#A6BBB0]">
            {loading ? 'Loading live standings...' : 'Play your first match to claim #1!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#274136] text-[11px] font-bold text-[#A6BBB0]">
                  <th className="py-3 px-5 w-14">#</th>
                  <th className="py-3 px-3">PLAYER</th>
                  <th className="py-3 px-3">LEAGUE</th>
                  <th className="py-3 px-3 text-right">WINS</th>
                  <th className="py-3 px-3 text-right">RATE</th>
                  <th className="py-3 px-5 text-right">ELO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3170] text-sm">
                {sortedRows.map((row, idx) => {
                  const isMe = row.uid === profile.uid;
                  const rowRate =
                    row.gamesPlayed > 0 ? Math.round((row.wins / row.gamesPlayed) * 100) : 0;
                  return (
                    <tr
                      key={row.uid}
                      className={isMe ? 'bg-[#1D3480]/90' : 'hover:bg-[#162766]/60'}
                    >
                      <td className="py-3 px-5 font-mono tabular-nums text-xs font-bold text-[#EAB957]">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <PlayerAvatar
                            avatarId={row.avatarId}
                            frameId={row.avatarFrame}
                            size="xs"
                            alt={row.displayName}
                          />
                          <span className="font-semibold text-white whitespace-nowrap text-xs sm:text-sm">
                            {row.displayName}
                            {isMe && <span className="ml-1.5 text-[11px] text-[#EAB957]">(You)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-[#9BB0A5] whitespace-nowrap">
                        {LEAGUE_META[row.league].name}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-white">
                        {row.wins}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-[#CBD5E1]">
                        {rowRate}%
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums text-xs font-bold text-[#EAB957]">
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
