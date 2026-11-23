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
    selectedTier === 'all'
      ? tournaments
      : tournaments.filter((t) => t.tier === selectedTier);

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
        newTitle.trim() || `${LEAGUE_META[newTier].name} Invitational`,
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
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header & Host Action */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F5F2EB]">
            Competitive Leagues &amp; Tournaments
          </h1>
          <p className="mt-2 text-sm text-[#A5BDB2] max-w-2xl">
            Enter knockout cups to win coin prize pools and championship trophies. Pay with coins or
            redeem a free Rewarded Video Entry Ticket.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              triggerRewardedAd('free_tournament_ticket', () => {
                showToast('+1 Free Tournament Entry Ticket added to your account!', 'success');
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#173B2E] border border-[#2D5C4A] text-xs font-medium text-[#E5B95C] hover:bg-[#1E4A3A] whitespace-nowrap cursor-pointer"
          >
            <Ticket className="w-4 h-4" />
            Free Ticket (Watch Ad · You have {wallet.freeTournamentTickets})
          </button>

          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4A446] text-[#0B231B] text-xs font-semibold hover:bg-[#E1B45B] whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Organize Cup
          </button>
        </div>
      </div>

      {/* League Progression Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {TIERS.map((tier) => {
          const meta = LEAGUE_META[tier];
          const isCurrent = profile.league === tier;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setSelectedTier((prev) => (prev === tier ? 'all' : tier))}
              className={`text-left rounded-xl p-4 border transition-colors cursor-pointer ${
                selectedTier === tier
                  ? 'bg-[#183E30] border-[#D4A446]'
                  : isCurrent
                    ? 'bg-[#123026] border-[#2E5D4B]'
                    : 'bg-[#0E261E] border-[#1E3F32] hover:border-[#2C5544]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#F5F2EB]">{meta.name}</span>
                {isCurrent && (
                  <span className="text-[11px] font-medium text-[#E5B95C]">Your Tier</span>
                )}
              </div>
              <div className="mt-2 text-xs text-[#9EB5AA] font-mono tabular-nums">
                {meta.minElo}+ ELO · Prize {meta.prizePool.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Create Tournament Drawer */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl bg-[#102B22] border border-[#2B5544] p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div className="md:col-span-2">
            <label className="block text-xs text-[#9EB5AA] mb-1.5">Tournament Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={64}
              placeholder="e.g., Weekend Parlor Championship"
              className="w-full bg-[#0A1D16] border border-[#254A3B] rounded-xl px-3.5 py-2.5 text-sm text-[#F5F2EB] placeholder:text-[#638073] focus:outline-none focus:border-[#D4A446]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9EB5AA] mb-1.5">League Tier</label>
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value as LeagueTier)}
              className="w-full bg-[#0A1D16] border border-[#254A3B] rounded-xl px-3 py-2.5 text-sm text-[#F5F2EB] focus:outline-none focus:border-[#D4A446]"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {LEAGUE_META[t].name} ({LEAGUE_META[t].entryFee} Coins)
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={newSize}
              onChange={(e) => setNewSize(Number(e.target.value) as 4 | 8)}
              className="w-24 bg-[#0A1D16] border border-[#254A3B] rounded-xl px-3 py-2.5 text-sm text-[#F5F2EB] focus:outline-none focus:border-[#D4A446]"
            >
              <option value={4}>4P</option>
              <option value={8}>8P</option>
            </select>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] whitespace-nowrap cursor-pointer"
            >
              {creating ? 'Creating...' : 'Launch Cup'}
            </button>
          </div>
        </form>
      )}

      {/* Active Tournaments & Interactive Bracket */}
      {!isSignedIn ? (
        <div className="rounded-2xl bg-[#102B22] border border-[#234739] p-8 text-center">
          <Trophy className="w-8 h-8 text-[#D4A446] mx-auto" />
          <h2 className="mt-3 font-display text-xl font-semibold text-[#F5F2EB]">
            Sign in to Enter Competitive Leagues
          </h2>
          <p className="mt-2 text-sm text-[#A5BDB2] max-w-md mx-auto">
            Connect with Google to join live multi-device tournaments, track league brackets, and
            display trophies on the global leaderboard.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="mt-5 px-6 py-2.5 rounded-xl bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tournament Directory */}
          <div className="lg:col-span-5 space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl bg-[#102B22] border border-[#234739] p-6 text-sm text-[#9EB5AA]">
                No tournaments in this tier yet. Click <strong className="text-[#F5F2EB]">Organize Cup</strong> above to launch the first bracket.
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
                    className={`rounded-xl p-4 border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#163A2D] border-[#D4A446]'
                        : 'bg-[#102B22] border-[#234739] hover:border-[#315F4E]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#F5F2EB] truncate">
                          {t.title}
                        </div>
                        <div className="mt-1 text-xs text-[#9EB5AA]">
                          {LEAGUE_META[t.tier].name} ·{' '}
                          <span className="font-mono tabular-nums">
                            {t.entrants.length}/{t.maxEntrants}
                          </span>{' '}
                          Players ·{' '}
                          <span className="capitalize">{t.status}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums text-sm font-semibold text-[#E5B95C]">
                          {t.prizePool.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-[#8FA99C]">Prize Pool</div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#1E3F32] flex items-center justify-between text-xs">
                      <span className="text-[#9EB5AA] font-mono tabular-nums">
                        Entry: {t.entryFee} Coins
                      </span>
                      <span className={enrolled ? 'text-[#4ADE80] font-medium' : 'text-[#E5B95C]'}>
                        {t.status === 'completed'
                          ? `Champion: ${t.winnerName}`
                          : enrolled
                            ? 'Enrolled'
                            : 'Open for Entry'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Bracket Detail */}
          <div className="lg:col-span-7 rounded-2xl bg-[#102B22] border border-[#234739] p-6">
            {selectedTournament ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#1E3E31]">
                  <div>
                    <div className="text-xs text-[#E5B95C]">
                      {LEAGUE_META[selectedTournament.tier].name} · {selectedTournament.maxEntrants}-Player Knockout
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-semibold text-[#F5F2EB]">
                      {selectedTournament.title}
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#8FA99C]">Grand Prize</div>
                    <div className="font-mono tabular-nums text-xl font-semibold text-[#E5B95C]">
                      {selectedTournament.prizePool.toLocaleString()} Coins
                    </div>
                  </div>
                </div>

                {/* Knockout Bracket Visualization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-[#9EB5AA]">Semifinal Seeds</div>
                    {Array.from({ length: Math.min(4, selectedTournament.maxEntrants) }).map(
                      (_, idx) => {
                        const entrant = selectedTournament.entrants[idx];
                        const fallbackBot = BOT_ROSTER[idx % BOT_ROSTER.length];
                        return (
                          <div
                            key={`seed-${idx}`}
                            className="p-3 rounded-xl bg-[#0B1E17] border border-[#1E3F32] flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-xs text-[#7F9B8E] w-4">
                                #{idx + 1}
                              </span>
                              <PlayerAvatar
                                avatarId={entrant ? entrant.avatarId : fallbackBot.avatarId}
                                size="xs"
                                alt={entrant ? entrant.name : 'Seed Contender'}
                              />
                              <span className="text-xs font-medium text-[#F5F2EB] truncate">
                                {entrant ? entrant.name : `${fallbackBot.name} (Seed)`}
                              </span>
                            </div>
                            <span className="font-mono tabular-nums text-[11px] text-[#8FA99C]">
                              {entrant ? entrant.elo : fallbackBot.elo}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>

                  <div className="flex flex-col justify-between p-4 rounded-xl bg-[#0B1E17] border border-[#1E3F32]">
                    <div>
                      <div className="text-xs font-medium text-[#9EB5AA]">Championship Final</div>
                      <div className="mt-4 flex items-center gap-3">
                        <Award className="w-7 h-7 text-[#E5B95C] shrink-0" />
                        <div>
                          <div className="text-sm font-semibold text-[#F5F2EB]">
                            {selectedTournament.status === 'completed'
                              ? selectedTournament.winnerName
                              : 'Crown Trophy + Prize Pool'}
                          </div>
                          <div className="text-xs text-[#9EB5AA] mt-0.5">
                            {selectedTournament.status === 'completed'
                              ? 'Tournament concluded'
                              : 'Win your semifinal and final matches to claim the title.'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-2.5">
                      {selectedTournament.status === 'completed' ? (
                        <div className="text-xs text-[#4ADE80] font-medium">
                          Completed · Trophy awarded to {selectedTournament.winnerName}
                        </div>
                      ) : selectedTournament.entrantUids.includes(profile.uid) ? (
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            onClick={() => handlePlayBracketMatch(selectedTournament, 'semifinal')}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#1A4234] border border-[#2F614E] text-xs font-semibold text-[#F5F2EB] hover:bg-[#225341] flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 text-[#D4A446]" />
                            Play Semifinal Match
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePlayBracketMatch(selectedTournament, 'final')}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#D4A446] text-[#0B231B] text-xs font-semibold hover:bg-[#E1B45B] flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Trophy className="w-3.5 h-3.5" />
                            Play Championship Final
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            onClick={() => registerForTournament(selectedTournament, false)}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#D4A446] text-[#0B231B] text-xs font-semibold hover:bg-[#E1B45B] cursor-pointer"
                          >
                            Enter for {selectedTournament.entryFee} Coins
                          </button>
                          <button
                            type="button"
                            onClick={() => registerForTournament(selectedTournament, true)}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#183C2F] border border-[#2E5D4B] text-xs font-medium text-[#E5B95C] hover:bg-[#204C3C] cursor-pointer"
                          >
                            Use Free Ticket ({wallet.freeTournamentTickets} available)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-[#9EB5AA] py-12 text-center">
                Select or organize a tournament to inspect its knockout bracket.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
