import { useEffect, useState } from 'react';
import { CheckCircle2, Play, ShieldCheck, Smartphone, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { ADMOB_CONFIG, hasNativeAndroidAdBridge } from '../services/adMobService';

export function AdMobModalHost() {
  const { adModal } = useApp();
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!adModal) return;
    setSecondsLeft(adModal.durationSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [adModal]);

  if (!adModal) return null;

  const isComplete = secondsLeft === 0;
  const progressPct =
    ((adModal.durationSeconds - secondsLeft) / Math.max(1, adModal.durationSeconds)) * 100;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={adModal.title}
    >
      <div className="w-full max-w-md bg-[#112A21] border border-[#2C5544] rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#224436] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-[#C9A24D] font-medium">
              {adModal.kind === 'rewarded'
                ? 'AdMob Rewarded Video Placement'
                : 'AdMob Interstitial Placement'}
            </div>
            <h2 className="font-display text-lg font-semibold text-[#F5F2EB] truncate mt-0.5">
              {adModal.title}
            </h2>
          </div>
          {adModal.kind === 'interstitial' || isComplete ? (
            <button
              type="button"
              onClick={isComplete ? adModal.onComplete : adModal.onDismiss}
              disabled={!isComplete}
              className="p-2 rounded-lg text-[#9EB5AA] hover:text-white hover:bg-[#1B3E31] disabled:opacity-40 cursor-pointer"
              aria-label="Close ad"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={adModal.onDismiss}
              className="text-xs text-[#9EB5AA] hover:text-white whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Clean visual sponsor preview stage */}
        <div className="p-6 bg-[#0B1E17]">
          <div className="rounded-xl border border-[#24493A] bg-[#133227] p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-[#D4A446]/15 border border-[#D4A446]/40 text-[#E5B95C] mx-auto flex items-center justify-center">
              {isComplete ? <CheckCircle2 className="w-6 h-6" /> : <Play className="w-5 h-5" />}
            </div>
            <p className="mt-3 font-display text-xl font-semibold text-[#F5F2EB]">
              {isComplete ? 'Reward Ready to Claim' : adModal.rewardLabel}
            </p>
            <p className="mt-1.5 text-xs text-[#A5BDB2] leading-relaxed">
              {adModal.kind === 'rewarded'
                ? isComplete
                  ? 'Thank you for watching. Tap below to credit your account immediately.'
                  : `Reward unlocks automatically in ${secondsLeft}s. Never interrupts an active turn.`
                : isComplete
                  ? 'Break complete. Return smoothly to the lobby.'
                  : `Continuing in ${secondsLeft}s · Frequency-capped at 1 per 3 matches.`}
            </p>

            {/* Progress bar */}
            <div className="mt-5 h-2 rounded-full bg-[#091812] overflow-hidden">
              <div
                className="h-full bg-[#D4A446] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="mt-4 pt-3 border-t border-[#1F4234] flex items-center justify-between text-[11px] font-mono text-[#88A598]">
              <span className="truncate">Unit: {adModal.unitId}</span>
              <span className="shrink-0 ml-2">
                {hasNativeAndroidAdBridge() ? 'Android SDK' : 'Web Preview'}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            {!isComplete && (
              <span className="text-xs font-mono tabular-nums text-[#9EB5AA] mr-auto">
                {secondsLeft}s remaining
              </span>
            )}
            <button
              type="button"
              disabled={!isComplete}
              onClick={adModal.onComplete}
              className="px-5 py-2.5 rounded-lg bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
            >
              {adModal.kind === 'rewarded' ? 'Claim Reward' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdaptiveBannerAd({ onOpenRewards }: { onOpenRewards: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <aside
      aria-label="Sponsored banner placement"
      className="w-full border-t border-[#1E4032] bg-[#091B14] px-4 py-2.5"
    >
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Smartphone className="w-4 h-4 text-[#D4A446] shrink-0" />
          <div className="text-xs text-[#B8C9C1] truncate">
            <span className="font-semibold text-[#F5F2EB]">AdMob Adaptive Banner Slot</span>
            <span className="mx-2 text-[#5B7B6D]" aria-hidden="true">·</span>
            <span className="font-mono text-[11px] text-[#8EA99C]">{ADMOB_CONFIG.bannerUnitId}</span>
            <span className="hidden sm:inline mx-2 text-[#5B7B6D]" aria-hidden="true">·</span>
            <span className="hidden sm:inline text-[#8EA99C]">
              Hidden automatically during active board play
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenRewards}
            className="text-xs font-medium text-[#E5B95C] hover:text-[#F4D284] whitespace-nowrap cursor-pointer"
          >
            Earn +250 Coins
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 text-[#7D998C] hover:text-white cursor-pointer"
            aria-label="Hide banner preview"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AndroidAdMobGuideCard() {
  return (
    <div className="rounded-xl bg-[#102B22] border border-[#234739] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-[#F5F2EB]">
            Android AdMob &amp; Retention Configuration
          </h3>
          <p className="mt-1 text-sm text-[#A5BDB2] max-w-2xl">
            Pre-wired with official Google AdMob Android test Unit IDs and a native{' '}
            <code className="font-mono text-xs text-[#E5B95C]">window.AndroidAdMob</code> bridge for
            Android WebView or Capacitor packaging. Ads never fire mid-turn.
          </p>
        </div>
        <ShieldCheck className="w-5 h-5 text-[#D4A446] shrink-0 mt-1" />
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-lg bg-[#0B2019] border border-[#1E3D31]">
          <div className="text-[#8FA99C]">Rewarded Video Unit (Android)</div>
          <div className="mt-1 font-mono text-[#F5F2EB] break-all">{ADMOB_CONFIG.rewardedUnitId}</div>
          <div className="mt-2 text-[#A5BDB2]">
            Placements: 2x Post-Match Coins, +250 Parlor Bonus, Free League Ticket, 1x Practice Re-Roll.
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#0B2019] border border-[#1E3D31]">
          <div className="text-[#8FA99C]">Interstitial &amp; Adaptive Banner Units</div>
          <div className="mt-1 font-mono text-[#F5F2EB] break-all">
            {ADMOB_CONFIG.interstitialUnitId}
          </div>
          <div className="mt-2 text-[#A5BDB2]">
            Banner hidden during board play. Interstitial strictly capped at 1 per{' '}
            {ADMOB_CONFIG.interstitialEveryNMatches} completed matches.
          </div>
        </div>
      </div>
    </div>
  );
}
