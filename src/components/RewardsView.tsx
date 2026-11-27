import { Bell, BellRing, Check, Crown, Gem, Gift, LifeBuoy, Play, Ticket } from 'lucide-react';
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
    notificationPrefs,
    notificationPermission,
    enablePushNotifications,
    updateNotificationPref,
    showToast,
  } = useApp();

  const today = getTodayDateString();
  const claimedToday = wallet.lastDailyClaimDate === today;
  const nextDayIndex = (wallet.dailyStreak % 7) + 1;
  const rewardedUsedToday = wallet.adDate === today ? wallet.adRewardedCountToday : 0;
  const isLowCoins = wallet.coins < 200;
  const hasGoldenDice = wallet.unlockedCosmetics.includes('dice_jade');

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-5 pb-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            Rewards &amp; Quests
          </h1>
          <p className="text-xs text-[#475569] mt-0.5">
            Climb the 7-day streak for the Golden Crown Dice, complete quests, or collect opt-in bonuses.
          </p>
        </div>

        <button
          type="button"
          disabled={claimedToday}
          onClick={() => claimDailyStreak()}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-display font-extrabold text-xs whitespace-nowrap cursor-pointer ${
            claimedToday
              ? 'bg-[#DCFCE7] border-2 border-[#10B981] text-[#047857] cursor-default'
              : 'game-btn-gold animate-chest-wiggle'
          }`}
        >
          {claimedToday ? <Check className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
          {claimedToday ? 'Day Claimed' : `Claim Day ${nextDayIndex} Gift`}
        </button>
      </div>

      {/* 7-Day Escalating Streak Row with Day 7 Cosmetic Grand Prize */}
      <section className="studio-card rounded-3xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-extrabold text-[#475569]">
            7-DAY ESCALATING STREAK · DAY {wallet.dailyStreak}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FEF9C3] border-2 border-[#111827] text-[11px] font-display font-extrabold text-[#111827]">
            <Crown className="w-3.5 h-3.5 text-[#D97706]" />
            <span>
              Day 7 Grand Prize: {hasGoldenDice ? 'Crystal Pearl Board / +25 Gems' : 'Golden Crown Dice'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {DAILY_STREAK_REWARDS.map((item) => {
            const isPast =
              item.day <= (wallet.dailyStreak % 7) ||
              (wallet.dailyStreak > 0 && wallet.dailyStreak % 7 === 0);
            const isTodayTarget = !claimedToday && item.day === nextDayIndex;
            const isDay7 = item.day === 7;
            return (
              <div
                key={item.day}
                className={`rounded-2xl p-3 border-2 text-center flex flex-col justify-between ${
                  isDay7 ? 'col-span-2 sm:col-span-2 lg:col-span-1' : ''
                } ${
                  isTodayTarget
                    ? 'bg-gradient-to-b from-[#FFF599] to-[#FDE047] border-[#111827] shadow-[0_3px_0_#111827]'
                    : isDay7
                      ? 'bg-gradient-to-b from-[#FEF9C3] to-[#FDE68A] border-[#D97706]'
                      : isPast
                        ? 'bg-[#F1F5F9] border-[#CBD5E1] opacity-65'
                        : 'bg-white border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[11px] font-extrabold text-[#64748B]">
                  {isDay7 && <Crown className="w-3.5 h-3.5 text-[#D97706]" />}
                  <span>DAY {item.day}</span>
                </div>
                <div className="mt-1.5 font-mono tabular-nums text-base font-black text-[#111827]">
                  +{item.coins}
                </div>
                <div className="text-[10px] font-bold text-[#475569] mt-0.5 leading-tight">
                  {isDay7
                    ? `${item.gems} Gems + Golden Dice`
                    : item.gems > 0
                      ? `Coins + ${item.gems} Gems`
                      : 'Coins'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Daily Quests */}
        <section className="lg:col-span-7 studio-card rounded-3xl p-5 space-y-3">
          <div className="font-display text-lg font-extrabold text-[#111827]">Daily Table Quests</div>
          <div className="divide-y divide-[#E2E8F0]">
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
                      <span className="font-display text-sm font-extrabold text-[#111827]">{ch.title}</span>
                      <span className="text-xs font-mono font-extrabold text-[#1D4ED8]">
                        +{ch.rewardCoins} Coins · +{ch.rewardGems} Gems
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">{ch.description}</p>
                    <div className="mt-2 flex items-center gap-2.5">
                      <div className="flex-1 h-2.5 rounded-full bg-[#E2E8F0] overflow-hidden max-w-xs">
                        <div className="h-full bg-[#10B981]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono font-bold tabular-nums text-[#334155]">
                        {clamped}/{ch.target}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canClaim}
                    onClick={() => claimDailyChallenge(ch.id)}
                    className={`px-4 py-2 rounded-xl font-display font-extrabold text-xs whitespace-nowrap ${
                      isClaimed
                        ? 'bg-[#DCFCE7] text-[#047857] border-2 border-[#10B981] cursor-default'
                        : canClaim
                          ? 'game-btn-gold cursor-pointer'
                          : 'bg-[#F1F5F9] text-[#94A3B8] border border-[#CBD5E1] cursor-not-allowed'
                    }`}
                  >
                    {isClaimed ? 'Done' : canClaim ? 'Claim' : 'Active'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Opt-In Rewarded Ad Vault */}
        <section className="lg:col-span-5 studio-card rounded-3xl p-5 space-y-4">
          <div>
            <div className="font-display text-lg font-extrabold text-[#111827]">Bonus Coin Vault</div>
            <div className="text-xs text-[#64748B] mt-0.5">
              100% opt-in rewarded videos ({rewardedUsedToday}/{ADMOB_CONFIG.dailyRewardedCap} today)
            </div>
          </div>

          <div className="space-y-3">
            {isLowCoins && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FFF599] to-[#FDE047] border-2 border-[#111827] shadow-[0_3px_0_#111827] flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-sm font-extrabold text-[#111827]">
                    Low Coin Rescue · +300
                  </div>
                  <div className="text-xs text-[#475569]">Quick opt-in refill to stay at the tables</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    triggerRewardedAd('low_coin_rescue', () => {
                      showToast('+300 Rescue Coins credited!', 'success');
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-display font-extrabold text-xs game-btn-blue cursor-pointer whitespace-nowrap"
                >
                  <LifeBuoy className="w-3.5 h-3.5" />
                  Refill
                </button>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[#FEF9C3] border-2 border-[#111827] flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-sm font-extrabold text-[#111827]">+250 Bonus Coins</div>
                <div className="text-xs text-[#475569]">Instant treasury refill</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  triggerRewardedAd('daily_bonus_coins', () => {
                    showToast('+250 Bonus Coins credited!', 'success');
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-display font-extrabold text-xs game-btn-blue cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                Watch Ad
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#FEE2E2] border-2 border-[#111827] flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-sm font-extrabold text-[#111827]">+5 Bonus Gems</div>
                <div className="text-xs text-[#475569]">Unlock dice &amp; board skins</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  triggerRewardedAd('bonus_gems', () => {
                    showToast('+5 Bonus Gems credited!', 'success');
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-display font-extrabold text-xs game-btn-red cursor-pointer whitespace-nowrap"
              >
                <Gem className="w-3.5 h-3.5" />
                Watch Ad
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#DCFCE7] border-2 border-[#111827] flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-sm font-extrabold text-[#111827]">Free Cup Ticket</div>
                <div className="text-xs text-[#475569]">Enter any tournament free</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  triggerRewardedAd('free_tournament_ticket', () => {
                    showToast('+1 Free Tournament Pass credited!', 'success');
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-display font-extrabold text-xs game-btn-green cursor-pointer whitespace-nowrap"
              >
                <Ticket className="w-3.5 h-3.5" />
                Watch Ad
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Push Notifications & Game Alerts Card (Android 13+ / FCM Opt-In Compliant) */}
      <section className="studio-card rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#EFF6FF] border-2 border-[#111827] flex items-center justify-center text-[#1D4ED8] shrink-0">
              {notificationPrefs.enabled ? (
                <BellRing className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#111827]">
                Push Notifications &amp; Alerts
              </h2>
              <p className="text-xs text-[#475569]">
                Get notified for friend table invites, accepted friend requests, and Daily Gift / Lucky Spin resets.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => enablePushNotifications()}
            disabled={notificationPermission === 'unsupported'}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-display font-extrabold text-xs whitespace-nowrap cursor-pointer disabled:opacity-50 ${
              notificationPrefs.enabled && notificationPermission === 'granted'
                ? 'bg-[#DCFCE7] border-2 border-[#10B981] text-[#047857]'
                : 'game-btn-blue'
            }`}
          >
            {notificationPrefs.enabled && notificationPermission === 'granted' ? (
              <>
                <Check className="w-4 h-4" />
                Alerts Active
              </>
            ) : notificationPermission === 'denied' ? (
              'Blocked in Device Settings'
            ) : (
              <>
                <BellRing className="w-4 h-4" />
                Enable Alerts
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              {
                key: 'roomInvites',
                title: 'Friend Table Invites',
                desc: 'Know immediately when your squad opens a room.',
              },
              {
                key: 'friendRequests',
                title: 'Friend Requests',
                desc: 'Alerts for new requests and accepted invites.',
              },
              {
                key: 'dailyRewards',
                title: 'Daily Gift & Spin Reset',
                desc: 'Protect your 7-Day Streak for Golden Crown Dice.',
              },
            ] as const
          ).map((row) => {
            const active = notificationPrefs[row.key];
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => updateNotificationPref(row.key, !active)}
                className={`p-3.5 rounded-2xl border-2 text-left transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                  active
                    ? 'bg-[#EFF6FF] border-[#1D4ED8]'
                    : 'bg-[#F8FAFC] border-[#CBD5E1] opacity-75'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-display text-xs font-extrabold text-[#111827]">
                    {row.title}
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{row.desc}</div>
                </div>
                <span
                  className={`w-9 h-5 rounded-full border-2 border-[#111827] flex items-center px-0.5 shrink-0 transition-colors ${
                    active ? 'bg-[#10B981] justify-end' : 'bg-[#CBD5E1] justify-start'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white border border-[#111827]" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <AndroidAdMobGuideCard />
    </div>
  );
}

