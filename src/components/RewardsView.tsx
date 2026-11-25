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
    <div className="max-w-[1260px] mx-auto px-3 sm:px-6 py-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            REWARDS &amp; DAILY QUESTS
          </h1>
          <p className="text-xs text-[#A6BBB0] mt-0.5">
            Claim your daily chest, finish quests, or watch opt-in rewarded videos.
          </p>
        </div>

        <button
          type="button"
          disabled={claimedToday}
          onClick={() => claimDailyStreak()}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-display font-bold text-xs whitespace-nowrap cursor-pointer ${
            claimedToday
              ? 'bg-[#1A2F26] border border-[#2F4E42] text-[#34D399] cursor-default'
              : 'game-btn-gold animate-chest-wiggle'
          }`}
        >
          {claimedToday ? <Check className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
          {claimedToday ? 'DAY CLAIMED' : `CLAIM DAY ${nextDayIndex} CHEST`}
        </button>
      </div>

      {/* 7-Day Streak Row */}
      <section className="rounded-3xl bg-[#14251E]/95 border-2 border-[#2E4C40] p-5">
        <div className="text-xs font-bold text-[#A6BBB0] mb-3">
          7-DAY LOGIN STREAK · DAY {wallet.dailyStreak}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {DAILY_STREAK_REWARDS.map((item) => {
            const isPast =
              item.day <= (wallet.dailyStreak % 7) ||
              (wallet.dailyStreak > 0 && wallet.dailyStreak % 7 === 0);
            const isTodayTarget = !claimedToday && item.day === nextDayIndex;
            return (
              <div
                key={item.day}
                className={`rounded-2xl p-3 border-2 text-center ${
                  isTodayTarget
                    ? 'bg-[#2B1F0A] border-[#EAB957]'
                    : isPast
                      ? 'bg-[#0C1814] border-[#1F3578] opacity-60'
                      : 'bg-[#0C1814] border-[#274136]'
                }`}
              >
                <div className="text-[11px] font-bold text-[#A6BBB0]">DAY {item.day}</div>
                <div className="mt-1.5 font-mono tabular-nums text-base font-bold text-[#EAB957]">
                  +{item.coins}
                </div>
                <div className="text-[10px] text-[#CBD5E1] mt-0.5">
                  {item.gems > 0 ? `Coins + ${item.gems} Gems` : 'Coins'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Daily Quests */}
        <section className="lg:col-span-7 rounded-3xl bg-[#14251E]/95 border-2 border-[#2E4C40] p-5 space-y-3">
          <div className="font-display text-lg font-bold text-white">Daily Table Quests</div>
          <div className="divide-y divide-[#274136]">
            {DAILY_CHALLENGES.map((ch) => {
              const progress = wallet.challengeProgress[ch.metric] || 0;
              const clamped = Math.min(ch.target, progress);
              const pct = Math.round((clamped / ch.target) * 100);
              const isClaimed = wallet.claimedChallenges.includes(ch.id);
              const canClaim = !isClaimed && progress >= ch.target;

              return (
                <div key={ch.id} className="py-3.5 first:pt-1 last:pb-0 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-white">{ch.title}</span>
                      <span className="text-xs font-mono font-bold text-[#EAB957]">
                        +{ch.rewardCoins} Coins · +{ch.rewardGems} Gems
                      </span>
                    </div>
                    <p className="text-xs text-[#9BB0A5] mt-0.5">{ch.description}</p>
                    <div className="mt-2 flex items-center gap-2.5">
                      <div className="flex-1 h-2 rounded-full bg-[#0C1814] overflow-hidden max-w-xs">
                        <div className="h-full bg-[#34D399]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-white">
                        {clamped}/{ch.target}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canClaim}
                    onClick={() => claimDailyChallenge(ch.id)}
                    className={`px-4 py-2 rounded-xl font-display font-bold text-xs whitespace-nowrap ${
                      isClaimed
                        ? 'bg-[#0C1814] text-[#34D399] border border-[#1E4D40] cursor-default'
                        : canClaim
                          ? 'game-btn-gold cursor-pointer'
                          : 'bg-[#1A2F26] text-[#64748B] border border-[#274136] cursor-not-allowed'
                    }`}
                  >
                    {isClaimed ? 'DONE' : canClaim ? 'CLAIM' : 'ACTIVE'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Opt-In Rewarded Ad Vault */}
        <section className="lg:col-span-5 rounded-3xl bg-[#14251E]/95 border-2 border-[#2E4C40] p-5 space-y-4">
          <div>
            <div className="font-display text-lg font-bold text-white">Sponsored Coin Vault</div>
            <div className="text-xs text-[#A6BBB0] mt-0.5">
              Opt-in AdMob Rewarded Videos ({rewardedUsedToday}/{ADMOB_CONFIG.dailyRewardedCap} today)
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-[#0C1814] border border-[#274136] flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-sm font-bold text-white">+250 Bonus Coins</div>
                <div className="text-xs text-[#9BB0A5]">Instant treasury refill</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  triggerRewardedAd('daily_bonus_coins', () => {
                    showToast('+250 Bonus Coins credited!', 'success');
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-display font-bold text-xs game-btn-gold cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                WATCH AD
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#0C1814] border border-[#274136] flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-sm font-bold text-white">Free Cup Ticket</div>
                <div className="text-xs text-[#9BB0A5]">Enter any tournament free</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  triggerRewardedAd('free_tournament_ticket', () => {
                    showToast('+1 Free Tournament Pass credited!', 'success');
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-display font-bold text-xs game-btn-green cursor-pointer whitespace-nowrap"
              >
                <Ticket className="w-3.5 h-3.5" />
                WATCH AD
              </button>
            </div>
          </div>
        </section>
      </div>

      <AndroidAdMobGuideCard />
    </div>
  );
}
