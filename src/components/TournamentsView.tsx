import React, { useEffect, useMemo, useState } from 'react';
import { Award, Clock, Crown, LifeBuoy, Play, Plus, Ticket, Trophy } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { BOT_ROSTER, getWeekendCupSchedule, LEAGUE_META } from '../data/catalog';
import { LeagueTier, TournamentDoc } from '../types';
import { FriendActionButton } from './FriendActionButton';
import { PlayerAvatar } from './PlayerAvatar';

const TIERS: LeagueTier[] = ['bronze', 'silver', 'gold', 'grandmaster'];

export function TournamentsView() {
  const {
    isSignedIn,
    profile,
    wallet,
    leaderboard,
    refreshLeaderboard,
    tournaments,
    refreshTournaments,
    hostNewTournament,
    registerForTournament,
    triggerRewardedAd,
    launchOfflinePractice,
    signingIn,
    signInWithGoogle,
    showToast,
  } = useApp();

  const [selectedTier, setSelectedTier] = useState<LeagueTier | 'all'>('all');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTier, setNewTier] = useState<LeagueTier>('bronze');
  const [newSize, setNewSize] = useState<4 | 8>(4);
  const [creating, setCreating] = useState(false);
  const [weekendCup, setWeekendCup] = useState(() => getWeekendCupSchedule());
  const [joiningWeekendCup, setJoiningWeekendCup] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setWeekendCup(getWeekendCupSchedule()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      refreshTournaments().catch(() => {});
      refreshLeaderboard().catch(() => {});
    }
  }, [isSignedIn, refreshTournaments, refreshLeaderboard]);

  const existingWeekendCup = tournaments.find((t) => t.title === weekendCup.cupTitle) || null;

  const weeklyEventPlayers = useMemo(() => {
    const enrolled = (existingWeekendCup?.entrants || [])
      .filter((e) => e.uid !== profile.uid)
      .map((e) => ({
        uid: e.uid,
        displayName: e.name,
        avatarId: e.avatarId,
        elo: e.elo,
      }));
    if (enrolled.length > 0) return enrolled.slice(0, 6);
    return [...leaderboard]
      .filter((p) => p.uid !== profile.uid)
      .sort((a, b) => b.elo - a.elo || b.wins - a.wins)
      .slice(0, 6)
      .map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        avatarId: p.avatarId,
        elo: p.elo,
      }));
  }, [existingWeekendCup, leaderboard, profile.uid]);

  const handleWeekendCupAction = async () => {
    if (!weekendCup.isLive) {
      // Weekday qualifier warm-up match
      launchOfflinePractice({
        mode: 'quick',
        playerCount: 2,
        difficulty: 'tactical',
        tournamentContext: {
          tournamentId: `weekend_qualifier_${weekendCup.weekNumber}`,
          tournamentTitle: `${weekendCup.cupTitle} Qualifier`,
          round: 'semifinal',
          prizePool: 400,
          opponentName: BOT_ROSTER[0].name,
        },
      });
      return;
    }
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setJoiningWeekendCup(true);
    try {
      if (existingWeekendCup) {
        setSelectedTournamentId(existingWeekendCup.id);
        if (existingWeekendCup.entrantUids.includes(profile.uid)) {
          handlePlayBracketMatch(existingWeekendCup, 'semifinal');
        } else {
          const useTicket = wallet.freeTournamentTickets > 0;
          await registerForTournament(existingWeekendCup, useTicket);
        }
      } else {
        await hostNewTournament(weekendCup.cupTitle, 'gold', 8);
      }
    } finally {
      setJoiningWeekendCup(false);
    }
  };

  const filtered =
    selectedTier === 'all' ? tournaments : tournaments.filter((t) => t.tier === selectedTier);

  const selectedTournament: TournamentDoc | null =
    filtered.find((t) => t.id === selectedTournamentId) || filtered[0] || null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      await signInWithGoogle();
      return;
    }
    setCreating(true);
    try {
      await hostNewTournament(
        newTitle.trim() || `${LEAGUE_META[newTier].name} Cup`,
        newTier,
        newSize
      );
      setNewTitle('');
      setShowCreateForm(false);
    } finally {
      setCreating(false);
    }
  };

  const handlePlayBracketMatch = (tournament: TournamentDoc, round: 'semifinal' | 'final') => {
    const oppBot =
      round === 'semifinal'
        ? BOT_ROSTER[0]
        : BOT_ROSTER[2 % BOT_ROSTER.length];
    launchOfflinePractice({
      mode: 'quick',
      playerCount: 2,
      difficulty: tournament.tier === 'bronze' ? 'tactical' : 'grandmaster',
      tournamentContext: {
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        round,
        prizePool: tournament.prizePool,
        opponentName: oppBot.name,
      },
    });
  };

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-5 pb-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            League Cups
          </h1>
          <p className="text-xs text-[#475569] mt-0.5">
            Enter knockout brackets with Coins or a Free Pass.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              triggerRewardedAd('free_tournament_ticket', () => {
                showToast('+1 Free Tournament Pass earned!', 'success');
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-display font-extrabold text-xs game-btn-green cursor-pointer"
          >
            <Ticket className="w-4 h-4" />
            Free Pass ({wallet.freeTournamentTickets})
          </button>

          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl font-display font-extrabold text-xs game-btn-blue cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Host Cup
          </button>
        </div>
      </div>

      {/* Timed Weekend Crown Mini-Cup Featured Banner */}
      <section className="rounded-3xl bg-gradient-to-r from-[#FFF599] via-[#FDE047] to-[#DBEAFE] border-2 border-[#111827] shadow-[0_5px_0_#111827] p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#FF5E7E] to-[#E11D48] border-2 border-[#111827] shadow-[0_3px_0_#111827] flex items-center justify-center text-white shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#111827] text-[10px] font-display font-black ${
                    weekendCup.isLive
                      ? 'bg-[#10B981] text-white'
                      : 'bg-white text-[#1D4ED8]'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {weekendCup.isLive ? 'LIVE WEEKEND CUP' : 'WEEKEND MINI-CUP'}
                </span>
                <span className="font-mono text-xs font-extrabold text-[#111827]">
                  {weekendCup.countdownLabel}
                </span>
              </div>
              <h2 className="font-display text-lg sm:text-xl font-black text-[#111827] mt-1 truncate">
                {weekendCup.cupTitle}
              </h2>
              <p className="text-xs font-semibold text-[#334155] mt-0.5">
                Prize Pool: {weekendCup.prizeCoins.toLocaleString()} Coins + {weekendCup.prizeGems} Gems · Fri 6PM – Sun Midnight
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={joiningWeekendCup}
            onClick={handleWeekendCupAction}
            className="px-5 py-3 rounded-2xl font-display font-extrabold text-xs sm:text-sm game-btn-blue btn-gloss-sheen inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-60"
          >
            <Trophy className="w-4 h-4" />
            <span>
              {joiningWeekendCup
                ? 'Opening...'
                : weekendCup.isLive
                  ? existingWeekendCup?.entrantUids.includes(profile.uid)
                    ? 'Play Mini-Cup'
                    : 'Enter Weekend Cup'
                  : 'Play Qualifier Warm-Up'}
            </span>
          </button>
        </div>

        {/* Weekly Event Contenders — One-Tap Add Friend Strip */}
        {isSignedIn && weeklyEventPlayers.length > 0 && (
          <div className="pt-3 border-t border-[#111827]/15 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-display font-extrabold uppercase tracking-wide text-[#334155]">
                {existingWeekendCup && existingWeekendCup.entrants.length > 1
                  ? 'Weekly Event Entrants'
                  : 'Weekly Event Contenders'}
              </span>
              <span className="text-[10px] font-bold text-[#475569]">Add rivals to your squad</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {weeklyEventPlayers.map((player) => (
                <div
                  key={player.uid}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-white/95 border border-[#111827]/20 shrink-0 shadow-xs"
                >
                  <PlayerAvatar avatarId={player.avatarId} size="xs" alt={player.displayName} />
                  <div className="min-w-0 max-w-[105px]">
                    <div className="font-display text-xs font-extrabold text-[#111827] truncate">
                      {player.displayName}
                    </div>
                    <div className="font-mono text-[10px] font-bold text-[#64748B]">
                      {player.elo} pts
                    </div>
                  </div>
                  <FriendActionButton target={player} compact />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Low-Coin Opt-In Rescue Strip */}
      {wallet.coins < 200 && (
        <div className="rounded-2xl bg-[#FEF9C3] border-2 border-[#111827] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-bold text-[#111827]">
            <LifeBuoy className="w-4 h-4 text-[#1D4ED8] shrink-0" />
            <span>Running low on coins for Cup entry? Watch an opt-in video for +300 Rescue Coins.</span>
          </div>
          <button
            type="button"
            onClick={() =>
              triggerRewardedAd('low_coin_rescue', () => {
                showToast('+300 Rescue Coins credited!', 'success');
              })
            }
            className="px-3.5 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-gold cursor-pointer whitespace-nowrap"
          >
            +300 Free Coins
          </button>
        </div>
      )}

      {/* League Tier Selector Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TIERS.map((tier) => {
          const meta = LEAGUE_META[tier];
          const isCurrent = profile.league === tier;
          const active = selectedTier === tier;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setSelectedTier((prev) => (prev === tier ? 'all' : tier))}
              className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer ${
                active
                  ? 'bg-[#FEF9C3] border-[#111827] shadow-[0_3px_0_#111827]'
                  : isCurrent
                    ? 'bg-[#EFF6FF] border-[#1D4ED8]'
                    : 'bg-white border-[#CBD5E1] hover:border-[#111827]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-extrabold text-[#111827]">
                  {meta.name}
                </span>
                {isCurrent && (
                  <span className="text-[10px] font-extrabold text-[#1D4ED8]">YOUR TIER</span>
                )}
              </div>
              <div className="mt-1 text-xs text-[#475569] font-mono tabular-nums">
                {meta.minElo}+ pts · Prize {meta.prizePool.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="studio-card rounded-3xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-pop-in"
        >
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-[#475569] mb-1.5">Cup Name</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={64}
              placeholder="e.g., Friday Night Crown Cup"
              className="w-full bg-[#F8FAFC] border-2 border-[#111827] rounded-xl px-3.5 py-2.5 text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#475569] mb-1.5">Tier</label>
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value as LeagueTier)}
              className="w-full bg-[#F8FAFC] border-2 border-[#111827] rounded-xl px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {LEAGUE_META[t].name} ({LEAGUE_META[t].entryFee})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={newSize}
              onChange={(e) => setNewSize(Number(e.target.value) as 4 | 8)}
              className="w-20 bg-[#F8FAFC] border-2 border-[#111827] rounded-xl px-2.5 py-2.5 text-sm text-[#111827]"
            >
              <option value={4}>4P</option>
              <option value={8}>8P</option>
            </select>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 py-2.5 px-4 rounded-xl font-display font-extrabold text-xs game-btn-gold cursor-pointer"
            >
              {creating ? 'Launching...' : 'Launch Cup'}
            </button>
          </div>
        </form>
      )}

      {!isSignedIn ? (
        <div className="studio-card rounded-3xl p-8 text-center">
          <Trophy className="w-10 h-10 text-[#EAB308] mx-auto" />
          <h2 className="mt-3 font-display text-xl font-extrabold text-[#111827]">
            Sign In to Enter Live Cups
          </h2>
          <p className="mt-1.5 text-xs text-[#475569] max-w-sm mx-auto">
            Connect with Google to join competitive leagues and win prize pools across devices.
          </p>
          <button
            type="button"
            disabled={signingIn}
            onClick={signInWithGoogle}
            className="mt-5 px-6 py-3 rounded-2xl font-display font-extrabold text-sm game-btn-blue cursor-pointer disabled:opacity-60"
          >
            {signingIn ? 'Signing in...' : 'Sign In with Google'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-3">
            {filtered.length === 0 ? (
              <div className="studio-card-soft rounded-3xl p-6 text-xs text-[#64748B]">
                No active cups in this league yet. Tap <strong className="text-[#111827]">Host Cup</strong> to open one!
              </div>
            ) : (
              filtered.map((t) => {
                const enrolled = t.entrantUids.includes(profile.uid);
                const selected = selectedTournament?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTournamentId(t.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedTournamentId(t.id);
                    }}
                    className={`rounded-2xl p-4 border-2 transition-all cursor-pointer ${
                      selected
                        ? 'bg-[#FEF9C3] border-[#111827] shadow-[0_3px_0_#111827]'
                        : 'bg-white border-[#CBD5E1] hover:border-[#111827]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-display text-sm font-extrabold text-[#111827] truncate">
                          {t.title}
                        </div>
                        <div className="mt-1 text-xs text-[#475569]">
                          {LEAGUE_META[t.tier].name} · {t.entrants.length}/{t.maxEntrants}P ·{' '}
                          <span className="uppercase font-bold">{t.status}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums text-sm font-extrabold text-[#1D4ED8]">
                          {t.prizePool.toLocaleString()}
                        </div>
                        <div className="text-[10px] font-bold text-[#64748B]">PRIZE</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                      <span className="text-[#64748B] font-mono">Entry: {t.entryFee}</span>
                      <span className={enrolled ? 'text-[#047857] font-extrabold' : 'text-[#1D4ED8] font-extrabold'}>
                        {t.status === 'completed'
                          ? `Winner: ${t.winnerName}`
                          : enrolled
                            ? 'JOINED'
                            : 'OPEN'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="lg:col-span-7 studio-card rounded-3xl p-5 sm:p-6">
            {selectedTournament ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
                  <div>
                    <div className="text-xs font-extrabold text-[#1D4ED8]">
                      {LEAGUE_META[selectedTournament.tier].name.toUpperCase()} · {selectedTournament.maxEntrants}P KNOCKOUT
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-extrabold text-[#111827]">
                      {selectedTournament.title}
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-semibold text-[#64748B]">Grand Prize</div>
                    <div className="font-mono tabular-nums text-xl font-black text-[#111827]">
                      {selectedTournament.prizePool.toLocaleString()} Coins
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#475569]">
                        BRACKET SEEDS ({selectedTournament.entrants.length}/{selectedTournament.maxEntrants})
                      </span>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
                      {Array.from({ length: selectedTournament.maxEntrants }).map((_, idx) => {
                        const entrant = selectedTournament.entrants[idx];
                        const fallbackBot = BOT_ROSTER[idx % BOT_ROSTER.length];
                        const isMe = entrant?.uid === profile.uid;
                        return (
                          <div
                            key={`seed-${idx}`}
                            className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-xs text-[#1D4ED8] font-extrabold w-5 shrink-0">
                                #{idx + 1}
                              </span>
                              <PlayerAvatar
                                avatarId={entrant ? entrant.avatarId : fallbackBot.avatarId}
                                size="xs"
                                alt={entrant ? entrant.name : 'Seed'}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-[#111827] truncate">
                                  {entrant ? entrant.name : `${fallbackBot.name} (Seed)`}
                                  {isMe && <span className="ml-1 text-[#1D4ED8]">(You)</span>}
                                </div>
                                <div className="font-mono tabular-nums text-[10px] font-bold text-[#64748B]">
                                  {entrant ? entrant.elo : fallbackBot.elo} pts
                                </div>
                              </div>
                            </div>
                            {entrant && !isMe && (
                              <FriendActionButton
                                target={{
                                  uid: entrant.uid,
                                  displayName: entrant.name,
                                  avatarId: entrant.avatarId,
                                }}
                                compact
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between p-4 rounded-2xl bg-[#EFF6FF] border-2 border-[#111827]">
                    <div>
                      <div className="text-xs font-extrabold text-[#1D4ED8]">CHAMPIONSHIP FINAL</div>
                      <div className="mt-4 flex items-center gap-3">
                        <Award className="w-8 h-8 text-[#EAB308] shrink-0" />
                        <div>
                          <div className="font-display text-sm font-extrabold text-[#111827]">
                            {selectedTournament.status === 'completed'
                              ? selectedTournament.winnerName
                              : 'Crown Trophy + Prize'}
                          </div>
                          <div className="text-xs text-[#475569] mt-0.5">
                            Win Semifinal &amp; Final to claim the Cup!
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2.5">
                      {selectedTournament.status === 'completed' ? (
                        <div className="text-xs font-extrabold text-[#047857]">
                          Completed · Champion: {selectedTournament.winnerName}
                        </div>
                      ) : selectedTournament.entrantUids.includes(profile.uid) ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePlayBracketMatch(selectedTournament, 'semifinal')}
                            className="w-full py-2.5 px-4 rounded-xl font-display font-extrabold text-xs game-btn-blue flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Play Semifinal
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePlayBracketMatch(selectedTournament, 'final')}
                            className="w-full py-2.5 px-4 rounded-xl font-display font-extrabold text-xs game-btn-gold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Trophy className="w-3.5 h-3.5" />
                            Play Grand Final
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => registerForTournament(selectedTournament, false)}
                            className="w-full py-2.5 px-4 rounded-xl font-display font-extrabold text-xs game-btn-gold cursor-pointer"
                          >
                            Enter · {selectedTournament.entryFee} Coins
                          </button>
                          <button
                            type="button"
                            onClick={() => registerForTournament(selectedTournament, true)}
                            className="w-full py-2.5 px-4 rounded-xl font-display font-extrabold text-xs game-btn-green cursor-pointer"
                          >
                            Use Free Pass ({wallet.freeTournamentTickets} left)
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#64748B] py-12 text-center">
                Select or host a cup to view its knockout bracket.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
