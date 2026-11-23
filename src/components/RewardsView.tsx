import { Check, Gift, Play, Ticket } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  DAILY_CHALLENGES,
  DAILY_STREAK_REWARDS,
  getTodayDateString,
} from '../data/catalog';
import { ADMOB_CONFIG } from '../services/adMobService';
import { AndroidAdMobGuideCard } from './AdMobOverlays';

export function RewardsView() {
  const {
    wallet,
    claimDailyStreak,
    claimDailyChallenge,
    triggerRewardedAd,
    showToast,
  } = useApp();

  const today = getTodayDateString();
  const claimedToday = wallet.lastDailyClaimDate === today;
  const nextDayIndex = (wallet.dailyStreak % 7) + 1;
  const rewardedUsedToday = wallet.adDate === today ? wallet.adRewardedCountToday : 0;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F5F2EB]">
            Daily Rewards &amp; Challenges
          </h1>
          <p className="mt-2 text-sm text-[#A5BDB2]">
            Build your 7-day login streak, complete table milestones, and opt into sponsored
            rewarded placements to earn bonus coins and free league tickets.
          </p>
        </div>

        <div className="text-right font-mono tabular-nums">
          <div className="text-xs text-[#8FA99C]">Current Treasury</div>
          <div className="text-xl font-semibold text-[#E5B95C]">
            {wallet.coins.toLocaleString()} Coins · {wallet.gems} Gems
          </div>
        </div>
      </div>

      {/* 7-Day Daily Streak Strip */}
      <section className="rounded-2xl bg-[#102B22] border border-[#234739] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#1E3F32]">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#F5F2EB]">
              7-Day Club Streak
            </h2>
            <p className="text-xs text-[#9EB5AA] mt-1">
              Current streak: <span className="font-mono tabular-nums text-[#E5B95C]">{wallet.dailyStreak}</span>{' '}
              days · Escalating rewards every visit.
            </p>
          </div>
          <button
            type="button"
            disabled={claimedToday}
            onClick={() => claimDailyStreak()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
          >
            {claimedToday ? <Check className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
            {claimedToday ? 'Claimed Today' : `Claim Day ${nextDayIndex} Reward`}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {DAILY_STREAK_REWARDS.map((item) => {
            const isPast = item.day <= (wallet.dailyStreak % 7) || (wallet.dailyStreak > 0 && wallet.dailyStreak % 7 === 0);
            const isTodayTarget = !claimedToday && item.day === nextDayIndex;
            return (
              <div
                key={item.day}
                className={`rounded-xl p-3.5 border text-center ${
                  isTodayTarget
                    ? 'bg-[#194032] border-[#D4A446]'
                    : isPast
                      ? 'bg-[#0C211A] border-[#1D3E31] opacity-70'
                      : 'bg-[#0C211A] border-[#1D3E31]'
                }`}
              >
                <div className="text-xs text-[#8FA99C]">Day {item.day}</div>
                <div className="mt-2 font-mono tabular-nums text-base font-semibold text-[#E5B95C]">
                  +{item.coins}
                </div>
                <div className="text-[11px] text-[#B8C9C1] mt-0.5">
                  {item.gems > 0 ? `Coins & ${item.gems} Gems` : 'Coins'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Daily Challenges + Opt-In Rewarded Video Placements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Challenges */}
        <section className="lg:col-span-7 rounded-2xl bg-[#102B22] border border-[#234739] p-6 space-y-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#F5F2EB]">
              Today’s Table Challenges
            </h2>
            <p className="text-xs text-[#9EB5AA] mt-1">
              Progress updates automatically across both Offline Practice and Online Multiplayer.
            </p>
          </div>

          <div className="divide-y divide-[#1D3E31]">
            {DAILY_CHALLENGES.map((ch) => {
              const progress = wallet.challengeProgress[ch.metric] || 0;
              const clamped = Math.min(ch.target, progress);
              const pct = Math.round((clamped / ch.target) * 100);
              const isClaimed = wallet.claimedChallenges.includes(ch.id);
              const canClaim = !isClaimed && progress >= ch.target;

              return (
                <div key={ch.id} className="py-4 first:pt-2 last:pb-0 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-[#F5F2EB]">{ch.title}</span>
                      <span className="text-xs font-mono tabular-nums text-[#E5B95C]">
                        +{ch.rewardCoins} Coins · +{ch.rewardGems} Gems
                      </span>
                    </div>
                    <p className="text-xs text-[#9EB5AA] mt-1">{ch.description}</p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-[#091A14] overflow-hidden max-w-xs">
                        <div
                          className="h-full bg-[#D4A446] transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-[#B8C9C1]">
                        {clamped}/{ch.target}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canClaim}
                    onClick={() => claimDailyChallenge(ch.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      isClaimed
                        ? 'bg-[#0C211A] text-[#4ADE80] border border-[#1E3F32] cursor-default'
                        : canClaim
                          ? 'bg-[#D4A446] text-[#0B231B] hover:bg-[#E1B45B] cursor-pointer'
                          : 'bg-[#143328] text-[#7D998C] border border-[#1F4234] cursor-not-allowed'
                    }`}
                  >
                    {isClaimed ? 'Claimed' : canClaim ? 'Claim Reward' : 'In Progress'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Opt-In Rewarded Video Vault */}
        <section className="lg:col-span-5 rounded-2xl bg-[#102B22] border border-[#234739] p-6 space-y-5">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#F5F2EB]">
              Sponsored Vault
            </h2>
            <p className="text-xs text-[#9EB5AA] mt-1">
              Opt-in AdMob Rewarded Video placements designed for smooth retention ({rewardedUsedToday}/
              {ADMOB_CONFIG.dailyRewardedCap} used today).
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="p-4 rounded-xl bg-[#0B1F18] border border-[#1F4234] flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[#F5F2EB]">Parlor Coin Refill</div>
                <div className="text-xs text-[#9EB5AA] mt-0.5">
                  Instant <span className="font-mono text-[#E5B95C]">+250 Coins</span> for unlocking
                  board &amp; dice cosmetics.
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  triggerRewardedAd('daily_bonus_coins', () => {
                    showToast('+250 Bonus Coins credited!', 'success');
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D4A446] text-[#0B231B] text-xs font-semibold hover:bg-[#E1B45B] whitespace-nowrap cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Watch Ad
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#0B1F18] border border-[#1F4234] flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[#F5F2EB]">Free Tournament Pass</div>
                <div className="text-xs text-[#9EB5AA] mt-0.5">
                  Earn <span className="font-mono text-[#E5B95C]">+1 League Ticket</span> to join any
                  cup without spending coins.
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  triggerRewardedAd('free_tournament_ticket', () => {
                    showToast('+1 Free Tournament Ticket credited!', 'success');
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1A4234] border border-[#2F614E] text-xs font-semibold text-[#F5F2EB] hover:bg-[#225341] whitespace-nowrap cursor-pointer"
              >
                <Ticket className="w-3.5 h-3.5 text-[#D4A446]" />
                Watch Ad
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Android AdMob Integration Reference */}
      <AndroidAdMobGuideCard />
    </div>
  );
}
