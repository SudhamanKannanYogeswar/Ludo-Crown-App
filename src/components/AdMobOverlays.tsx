import { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Play, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  AdConsentMode,
  getAdConsentMode,
  hasCapacitorAdMobPlugin,
  setAdConsentMode,
  syncNativeBannerVisibility,
} from '../services/adMobService';

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
      className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={adModal.title}
    >
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto no-scrollbar bg-white border-2 border-[#111827] shadow-[0_6px_0_#111827] rounded-3xl animate-pop-in">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#475569] font-bold">
              <span className="px-1.5 py-0.5 rounded bg-[#FACC15] border border-[#111827] text-[#111827] text-[10px] font-black">
                AD
              </span>
              <span>
                {adModal.kind === 'rewarded' ? 'Rewarded Bonus' : 'Sponsored Break'}
              </span>
            </div>
            <h2 className="font-display text-lg font-extrabold text-[#111827] truncate mt-1">
              {adModal.title}
            </h2>
          </div>
          {adModal.kind === 'interstitial' || isComplete ? (
            <button
              type="button"
              onClick={isComplete ? adModal.onComplete : adModal.onDismiss}
              disabled={!isComplete}
              className="p-2 rounded-xl bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0] disabled:opacity-40 cursor-pointer"
              aria-label="Close ad"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={adModal.onDismiss}
              className="text-xs font-bold text-[#64748B] hover:text-[#111827] whitespace-nowrap cursor-pointer"
            >
              Exit (No Reward)
            </button>
          )}
        </div>

        <div className="p-6">
          <div className="rounded-2xl border-2 border-[#111827] bg-[#EFF6FF] p-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#FACC15] border-2 border-[#111827] text-[#111827] mx-auto flex items-center justify-center">
              {isComplete ? <CheckCircle2 className="w-7 h-7" /> : <Play className="w-6 h-6" />}
            </div>
            <p className="mt-3 font-display text-xl font-extrabold text-[#111827]">
              {isComplete ? 'Reward Unlocked!' : adModal.rewardLabel}
            </p>
            <p className="mt-1.5 text-xs text-[#475569] leading-relaxed">
              {adModal.kind === 'rewarded'
                ? isComplete
                  ? 'Bonus ready! Tap Claim Reward to add it to your balance right away.'
                  : `Credits in ${secondsLeft}s. Closing early cancels without penalty.`
                : isComplete
                  ? 'Break complete. Tap Continue to return to the lobby.'
                  : `Resuming in ${secondsLeft}s.`}
            </p>

            <div className="mt-5 h-2.5 rounded-full bg-white border border-[#93C5FD] overflow-hidden">
              <div
                className="h-full bg-[#1D4ED8] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            {!isComplete && (
              <span className="text-xs font-mono font-bold tabular-nums text-[#64748B] mr-auto">
                {secondsLeft}s remaining
              </span>
            )}
            <button
              type="button"
              disabled={!isComplete}
              onClick={adModal.onComplete}
              className="px-6 py-2.5 rounded-xl font-display font-extrabold text-sm game-btn-blue disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              {adModal.kind === 'rewarded' ? 'Claim Reward' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Policy-Compliant Adaptive Banner Safe Zone
 * - Never displays raw App IDs, Ad Unit IDs, or placeholder text when an ad is not loaded.
 * - On Web (where native AdMob does not run), renders nothing.
 * - Inside native Android/iOS APK, reserves a clean, blank 64px non-interactive safe zone
 *   so the native AdMob Adaptive Banner overlays cleanly without covering any buttons.
 */
export function AdaptiveBannerAd({
  onInspectPolicy: _onInspectPolicy,
  onOpenRewards: _onOpenRewards,
}: {
  onInspectPolicy?: () => void;
  onOpenRewards?: () => void;
}) {
  if (!hasCapacitorAdMobPlugin()) {
    return null;
  }

  return (
    <aside
      aria-label="Banner Safe Area"
      className="relative z-10 w-full h-[64px] pointer-events-none select-none"
    />
  );
}

const PRIVACY_HIGHLIGHTS = [
  {
    title: 'Zero Gameplay Interruption',
    detail:
      'Banners only appear on menu screens and stay completely hidden while your Ludo match is active.',
  },
  {
    title: 'Opt-In Rewarded First',
    detail:
      '2x match coins, extra Lucky Spins, Free Cup Tickets, and +300 Low Coin Rescue only play when you choose to watch.',
  },
  {
    title: 'No Forced Popups by Default',
    detail:
      'Matches flow straight into instant Rematch without unexpected full-screen ad interruptions.',
  },
  {
    title: 'Privacy & Notification Control',
    detail:
      'Non-Personalized Ads are on by default, and Push Notifications require explicit opt-in with per-alert toggles in Rewards.',
  },
];

export function AdPolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeTab } = useApp();
  const [consentMode, setConsentModeState] = useState<AdConsentMode>(() => getAdConsentMode());

  if (!open) return null;

  const handleConsentChange = (next: AdConsentMode) => {
    setConsentModeState(next);
    setAdConsentMode(next);
    syncNativeBannerVisibility(activeTab !== 'play');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F172A]/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Privacy and Ad Preferences"
    >
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto no-scrollbar rounded-3xl bg-white border-2 border-[#111827] shadow-[0_6px_0_#111827] p-5 sm:p-6 animate-pop-in">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] border-2 border-[#111827] flex items-center justify-center text-[#1D4ED8] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#111827]">
                Privacy &amp; Ad Preferences
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Control how sponsored rewards and ads appear on your device
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] hover:border-[#111827] cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Privacy & Ad Consent Toggle */}
        <div className="mt-4 p-4 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1]">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#111827]">
            <Lock className="w-4 h-4 text-[#1D4ED8]" />
            <span>Ad Personalization Preference</span>
          </div>
          <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">
            Non-Personalized Ads are selected by default to protect your privacy. You can change
            this anytime.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleConsentChange('non_personalized')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border-2 transition-colors cursor-pointer ${
                consentMode === 'non_personalized'
                  ? 'game-btn-blue'
                  : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#111827]'
              }`}
            >
              Non-Personalized
            </button>
            <button
              type="button"
              onClick={() => handleConsentChange('personalized')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border-2 transition-colors cursor-pointer ${
                consentMode === 'personalized'
                  ? 'game-btn-gold'
                  : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#111827]'
              }`}
            >
              Personalized Ads
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {PRIVACY_HIGHLIGHTS.map((item) => (
            <div
              key={item.title}
              className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-extrabold text-[#111827]">{item.title}</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-display font-extrabold text-sm game-btn-blue cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** Intentionally returns null so no raw AdMob App IDs or Ad Unit IDs are ever shown in UI. */
export function AndroidAdMobGuideCard() {
  return null;
}
