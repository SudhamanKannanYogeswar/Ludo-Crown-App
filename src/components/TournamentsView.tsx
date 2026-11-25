import React, { useEffect, useState } from 'react';
import { Award, Play, Plus, Ticket, Trophy } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { BOT_ROSTER, LEAGUE_META } from '../data/catalog';
import { LeagueTier, TournamentDoc } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

const TIERS: LeagueTier[] = ['bronze', 'silver', 'gold', 'grandmaster'];

export function TournamentsView() {
  const {
    isSignedIn,
    profile,
    wallet,
    tournaments,
    refreshTournaments,
    hostNewTournament,
    registerForTournament,
    triggerRewardedAd,
    launchOfflinePractice,
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

  useEffect(() => {
    if (isSignedIn) {
      refreshTournaments().catch(() => {});
    }
  }, [isSignedIn, refreshTournaments]);

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
    const oppBot = round === 'semifinal' ? BOT_ROSTER[0] : BOT_ROSTER[1];
    launchOfflinePractice({
      mode: 'quick',
      playerCount: 2,
      difficulty: tournament.tier === 'bronze' ? 'tactical' : 'grandmaster',
      tournamentContext: {
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        round,
        prizePool: tournament.prizePool,
        opponentName:
          tournament.entrants.find((e) => e.uid !== profile.uid)?.name || oppBot.name,
      },
    });
  };

  return (
    <div className="max-w-[1260px] mx-auto px-3 sm:px-6 py-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            LEAGUE CUPS &amp; BRACKETS
          </h1>
          <p className="text-xs text-[#A6BBB0] mt-0.5">
            Enter knockout tournaments with Coins or a Free Ad Ticket.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              triggerRewardedAd('free_tournament_ticket', () => {
                showToast('+1 Free Tournament Ticket earned!', 'success');
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl font-display font-bold text-xs game-btn-green cursor-pointer"
          >
            <Ticket className="w-4 h-4" />
            Free Pass (Ad · {wallet.freeTournamentTickets})
          </button>

          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-display font-bold text-xs game-btn-gold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Host Cup
          </button>
        </div>
      </div>

      {/* League Tier Selector Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TIERS.map((tier) => {
          const meta = LEAGUE_META[tier];
          const isCurrent = profile.league === tier;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setSelectedTier((prev) => (prev === tier ? 'all' : tier))}
              className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer ${
                selectedTier === tier
                  ? 'bg-[#1D3580] border-[#EAB957]'
                  : isCurrent
                    ? 'bg-[#1A2F26] border-[#456C5C]'
                    : 'bg-[#14251E]/90 border-[#2A463B] hover:border-[#456C5C]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold text-white">{meta.name}</span>
                {isCurrent && (
                  <span className="text-[10px] font-bold text-[#EAB957]">YOUR TIER</span>
                )}
              </div>
              <div className="mt-1.5 text-xs text-[#A6BBB0] font-mono tabular-nums">
                {meta.minElo}+ ELO · Prize {meta.prizePool.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-3xl bg-[#14251E]/95 border-2 border-[#3D6153] p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-pop-in"
        >
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#A6BBB0] mb-1.5">Cup Name</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={64}
              placeholder="e.g., Friday Night Crown Cup"
              className="w-full bg-[#0C1814] border border-[#2F4E42] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#EAB957]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#A6BBB0] mb-1.5">Tier</label>
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value as LeagueTier)}
              className="w-full bg-[#0C1814] border border-[#2F4E42] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#EAB957]"
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
              className="w-20 bg-[#0C1814] border border-[#2F4E42] rounded-xl px-2.5 py-2.5 text-sm text-white"
            >
              <option value={4}>4P</option>
              <option value={8}>8P</option>
            </select>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 py-2.5 px-4 rounded-xl font-display font-bold text-xs game-btn-gold cursor-pointer"
            >
              {creating ? 'LAUNCHING...' : 'LAUNCH CUP'}
            </button>
          </div>
        </form>
      )}

      {!isSignedIn ? (
        <div className="rounded-3xl bg-[#14251E]/95 border-2 border-[#2E4C40] p-8 text-center">
          <Trophy className="w-10 h-10 text-[#EAB957] mx-auto" />
          <h2 className="mt-3 font-display text-xl font-bold text-white">
            Sign In to Enter Live Cups
          </h2>
          <p className="mt-1.5 text-xs text-[#9BB0A5] max-w-sm mx-auto">
            Connect with Google to join competitive leagues and win prize pools across devices.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="mt-5 px-6 py-3 rounded-2xl font-display font-bold text-sm game-btn-gold cursor-pointer"
          >
            Sign In with Google
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-3xl bg-[#14251E]/90 border-2 border-[#2E4C40] p-6 text-xs text-[#9BB0A5]">
                No active cups in this league yet. Tap <strong className="text-white">Host Cup</strong> to open one!
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
                        ? 'bg-[#1A2F75] border-[#EAB957]'
                        : 'bg-[#14251E]/90 border-[#2A463B] hover:border-[#456C5C]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-display text-sm font-bold text-white truncate">
                          {t.title}
                        </div>
                        <div className="mt-1 text-xs text-[#A6BBB0]">
                          {LEAGUE_META[t.tier].name} · {t.entrants.length}/{t.maxEntrants}P ·{' '}
                          <span className="uppercase font-semibold">{t.status}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums text-sm font-bold text-[#EAB957]">
                          {t.prizePool.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[#94A3B8]">PRIZE</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#274136] flex items-center justify-between text-xs">
                      <span className="text-[#CBD5E1] font-mono">Entry: {t.entryFee}</span>
                      <span className={enrolled ? 'text-[#34D399] font-bold' : 'text-[#EAB957] font-bold'}>
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

          <div className="lg:col-span-7 rounded-3xl bg-[#14251E]/95 border-2 border-[#2E4C40] p-6">
            {selectedTournament ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#274136]">
                  <div>
                    <div className="text-xs font-bold text-[#EAB957]">
                      {LEAGUE_META[selectedTournament.tier].name.toUpperCase()} · {selectedTournament.maxEntrants}P KNOCKOUT
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-extrabold text-white">
                      {selectedTournament.title}
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#A6BBB0]">Grand Prize</div>
                    <div className="font-mono tabular-nums text-xl font-bold text-[#EAB957]">
                      {selectedTournament.prizePool.toLocaleString()} Coins
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-[#A6BBB0]">BRACKET SEEDS</div>
                    {Array.from({ length: Math.min(4, selectedTournament.maxEntrants) }).map((_, idx) => {
                      const entrant = selectedTournament.entrants[idx];
                      const fallbackBot = BOT_ROSTER[idx % BOT_ROSTER.length];
                      return (
                        <div
                          key={`seed-${idx}`}
                          className="p-3 rounded-2xl bg-[#0C1814] border border-[#274136] flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono text-xs text-[#EAB957] font-bold w-5">
                              #{idx + 1}
                            </span>
                            <PlayerAvatar
                              avatarId={entrant ? entrant.avatarId : fallbackBot.avatarId}
                              size="xs"
                              alt={entrant ? entrant.name : 'Seed'}
                            />
                            <span className="text-xs font-bold text-white truncate">
                              {entrant ? entrant.name : `${fallbackBot.name} (Seed)`}
                            </span>
                          </div>
                          <span className="font-mono tabular-nums text-[11px] text-[#A6BBB0]">
                            {entrant ? entrant.elo : fallbackBot.elo}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col justify-between p-4 rounded-2xl bg-[#0C1814] border border-[#274136]">
                    <div>
                      <div className="text-xs font-bold text-[#A6BBB0]">CHAMPIONSHIP FINAL</div>
                      <div className="mt-4 flex items-center gap-3">
                        <Award className="w-8 h-8 text-[#EAB957] shrink-0" />
                        <div>
                          <div className="font-display text-sm font-bold text-white">
                            {selectedTournament.status === 'completed'
                              ? selectedTournament.winnerName
                              : 'Crown Trophy + Prize'}
                          </div>
                          <div className="text-xs text-[#9BB0A5] mt-0.5">
                            Win Semifinal &amp; Final to claim the Cup!
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2.5">
                      {selectedTournament.status === 'completed' ? (
                        <div className="text-xs font-bold text-[#34D399]">
                          Completed · Champion: {selectedTournament.winnerName}
                        </div>
                      ) : selectedTournament.entrantUids.includes(profile.uid) ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePlayBracketMatch(selectedTournament, 'semifinal')}
                            className="w-full py-2.5 px-4 rounded-xl font-display font-bold text-xs game-btn-blue flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            PLAY SEMIFINAL
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePlayBracketMatch(selectedTournament, 'final')}
                            className="w-full py-2.5 px-4 rounded-xl font-display font-bold text-xs game-btn-gold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Trophy className="w-3.5 h-3.5" />
                            PLAY GRAND FINAL
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => registerForTournament(selectedTournament, false)}
                            className="w-full py-2.5 px-4 rounded-xl font-display font-bold text-xs game-btn-gold cursor-pointer"
                          >
                            ENTER · {selectedTournament.entryFee} COINS
                          </button>
                          <button
                            type="button"
                            onClick={() => registerForTournament(selectedTournament, true)}
                            className="w-full py-2.5 px-4 rounded-xl font-display font-bold text-xs game-btn-green cursor-pointer"
                          >
                            USE FREE PASS ({wallet.freeTournamentTickets} LEFT)
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#A6BBB0] py-12 text-center">
                Select or host a cup to view its knockout bracket.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
