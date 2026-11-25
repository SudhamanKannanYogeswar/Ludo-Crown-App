import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Check, Lock, Play, ShieldCheck, Smartphone, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  ADMOB_CONFIG,
  AdConsentMode,
  detectMobilePlatform,
  getAdConsentMode,
  hasCapacitorAdMobPlugin,
  hasNativeAndroidAdBridge,
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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={adModal.title}
    >
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto no-scrollbar bg-[#14251E] border-2 border-[#3D6153] rounded-3xl shadow-2xl animate-pop-in">
        <div className="px-5 py-4 border-b border-[#2A463B] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#EAB957] font-semibold">
              <span className="px-1.5 py-0.5 rounded bg-[#EAB957] text-[#1A1000] text-[10px] font-bold">
                AD
              </span>
              <span>
                {adModal.kind === 'rewarded'
                  ? 'Google AdMob Rewarded Video'
                  : 'Google AdMob Interstitial'}
              </span>
            </div>
            <h2 className="font-display text-lg font-bold text-white truncate mt-1">
              {adModal.title}
            </h2>
          </div>
          {adModal.kind === 'interstitial' || isComplete ? (
            <button
              type="button"
              onClick={isComplete ? adModal.onComplete : adModal.onDismiss}
              disabled={!isComplete}
              className="p-2 rounded-xl text-[#9BB0A5] hover:text-white hover:bg-[#1E3275] disabled:opacity-40 cursor-pointer"
              aria-label="Close ad"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={adModal.onDismiss}
              className="text-xs text-[#9BB0A5] hover:text-white whitespace-nowrap cursor-pointer"
            >
              Exit (No Reward)
            </button>
          )}
        </div>

        <div className="p-6 bg-[#0D1A15]">
          <div className="rounded-2xl border border-[#2D4A3E] bg-[#1A2F26] p-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#EAB957]/15 border border-[#EAB957]/45 text-[#EAB957] mx-auto flex items-center justify-center">
              {isComplete ? <CheckCircle2 className="w-7 h-7" /> : <Play className="w-6 h-6" />}
            </div>
            <p className="mt-3 font-display text-xl font-bold text-white">
              {isComplete ? 'Reward Unlocked!' : adModal.rewardLabel}
            </p>
            <p className="mt-1.5 text-xs text-[#C5D5CC] leading-relaxed">
              {adModal.kind === 'rewarded'
                ? isComplete
                  ? 'Video complete. Tap Claim Reward to credit your balance immediately.'
                  : `Opt-in rewarded placement · Credits in ${secondsLeft}s. Closing early cancels without penalty.`
                : isComplete
                  ? 'Natural break complete. Return to your lobby.'
                  : `Resuming in ${secondsLeft}s · Frequency-capped (1 per 3 matches, never mid-turn).`}
            </p>

            <div className="mt-5 h-2.5 rounded-full bg-[#0A1410] overflow-hidden">
              <div
                className="h-full bg-[#EAB957] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="mt-4 pt-3 border-t border-[#274136] flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
              <span className="truncate">Unit: {adModal.unitId}</span>
              <span className="shrink-0 ml-2 text-[#EAB957]">
                {hasCapacitorAdMobPlugin()
                  ? 'Capacitor AdMob'
                  : hasNativeAndroidAdBridge()
                    ? 'Android Bridge'
                    : 'Test Mode'}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            {!isComplete && (
              <span className="text-xs font-mono tabular-nums text-[#9BB0A5] mr-auto">
                {secondsLeft}s remaining
              </span>
            )}
            <button
              type="button"
              disabled={!isComplete}
              onClick={adModal.onComplete}
              className="px-6 py-2.5 rounded-xl font-display font-bold text-sm game-btn-gold disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
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
 * Policy-Compliant Adaptive Banner Ad Slot
 * - Clearly labeled with "AD" attribution (Google AdMob requirement)
 * - Strictly mounted ONLY in non-gameplay menu screens (auto-hidden when activeTab === 'play')
 * - Clean safe margin separation from interactive navigation buttons to prevent accidental clicks
 */
export function AdaptiveBannerAd({
  onInspectPolicy,
  onOpenRewards,
}: {
  onInspectPolicy: () => void;
  onOpenRewards: () => void;
}) {
  return (
    <aside
      aria-label="Google AdMob Adaptive Banner Slot"
      className="relative z-20 w-full bg-[#0B1612] border-t border-[#263F35] px-3 sm:px-6 py-1"
    >
      <div className="max-w-[1260px] mx-auto flex items-center justify-between gap-2.5 min-h-[30px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-[#EAB957] text-[#1A1000] text-[9px] font-extrabold shrink-0">
            AD
          </span>
          <Smartphone className="w-3.5 h-3.5 text-[#60A5FA] shrink-0 hidden sm:block" />
          <div className="text-[11px] text-[#CBD5E1] truncate">
            <span className="font-semibold text-white">AdMob Banner</span>
            <span className="mx-1.5 text-[#475569] hidden sm:inline" aria-hidden="true">·</span>
            <span className="font-mono text-[10px] text-[#94A3B8] hidden sm:inline">{ADMOB_CONFIG.bannerUnitId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onInspectPolicy}
            className="text-[11px] font-semibold text-[#A6BBB0] hover:text-white whitespace-nowrap cursor-pointer"
          >
            Policy
          </button>
          <button
            type="button"
            onClick={onOpenRewards}
            className="px-2 py-0.5 rounded-lg bg-[#1C3229] border border-[#3B5E50] text-[10px] font-bold text-[#EAB957] hover:bg-[#233A85] whitespace-nowrap cursor-pointer"
          >
            +250 Coins
          </button>
        </div>
      </div>
    </aside>
  );
}

const COMPLIANCE_ITEMS = [
  {
    title: 'Zero Gameplay Overlap (Anti-Accidental Click)',
    detail: 'Adaptive Banner automatically unmounts whenever the Ludo board is active.',
  },
  {
    title: 'Explicit "AD" Attribution Label',
    detail: 'Every banner, interstitial, and rewarded placement displays a clear AD indicator.',
  },
  {
    title: 'Strict Opt-In Rewarded Video Disclosure',
    detail: 'Players see exact reward value before opting in; closing early cancels safely.',
  },
  {
    title: 'Natural-Break Frequency & 90s Cooldown Cap',
    detail:
      'Interstitials only trigger after every 3rd completed match with a 90s minimum cooldown — never on launch or mid-turn.',
  },
  {
    title: 'GDPR (Google UMP) & Apple ATT Privacy Default',
    detail:
      'Requests Non-Personalized Ads (npa: true) by default until the player grants consent on Android or iOS.',
  },
  {
    title: 'Android Banner Live ID Wired (Test IDs for Other Slots)',
    detail:
      'Android Adaptive Banner is wired to your live AdMob Unit ID; Rewarded, Interstitial, and iOS units remain on Google test IDs until added.',
  },
];

export function AdPolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeTab } = useApp();
  const [copiedBridge, setCopiedBridge] = useState(false);
  const [consentMode, setConsentModeState] = useState<AdConsentMode>(() => getAdConsentMode());
  const [unitTab, setUnitTab] = useState<'android' | 'ios'>(() =>
    detectMobilePlatform() === 'ios' ? 'ios' : 'android'
  );

  if (!open) return null;

  const handleConsentChange = (next: AdConsentMode) => {
    setConsentModeState(next);
    setAdConsentMode(next);
    syncNativeBannerVisibility(activeTab !== 'play');
  };

  const capacitorSnippet = `# Zero-Install Cloud Build via GitHub Actions
# Workflow included: .github/workflows/mobile-cloud-build.yml
# 1. Push this project to a GitHub repository
# 2. Add secret ADMOB_ANDROID_APP_ID in GitHub Settings -> Secrets -> Actions
# 3. Open GitHub Actions tab -> Download "LudoCrown-Android-APK"
#    (Add ANDROID_KEYSTORE_* secrets to also build signed Play Store .aab)
# See MOBILE_STORE_BUILD.md for full Android & iOS steps.`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(capacitorSnippet).catch(() => {});
    setCopiedBridge(true);
    setTimeout(() => setCopiedBridge(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="AdMob Policy and Store Release"
    >
      <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto no-scrollbar rounded-3xl bg-[#12221C] border-2 border-[#3B5E50] p-5 sm:p-6 shadow-2xl animate-pop-in">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#274136]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1E362C] border border-[#456C5C] flex items-center justify-center text-[#34D399] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                AdMob Policy &amp; Store Release Guide
              </h2>
              <p className="text-xs text-[#9BB0A5] mt-0.5">
                Google Play (.apk / .aab) &amp; Apple App Store (.ipa) compliance + Capacitor bridge
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1C3229] text-[#C5D5CC] hover:text-white cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Privacy & Ad Consent Toggle (UMP / Apple ATT) */}
        <div className="mt-4 p-4 rounded-2xl bg-[#0D1A15] border border-[#2E4C40]">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Lock className="w-4 h-4 text-[#EAB957]" />
            <span>Privacy &amp; Ad Consent (GDPR UMP / Apple ATT)</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
            Required by Google Play &amp; App Store guidelines. Defaults to Non-Personalized Ads
            (<code className="font-mono text-[#A6BBB0]">npa: true</code>) unless the player opts in.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleConsentChange('non_personalized')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                consentMode === 'non_personalized'
                  ? 'bg-[#EAB957] text-[#1A1000] border-[#FDE68A]'
                  : 'bg-[#1A2F26] text-[#CBD5E1] border-[#2D4A3E] hover:text-white'
              }`}
            >
              Non-Personalized (Default)
            </button>
            <button
              type="button"
              onClick={() => handleConsentChange('personalized')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                consentMode === 'personalized'
                  ? 'bg-[#34D399] text-[#052E16] border-[#6EE7B7]'
                  : 'bg-[#1A2F26] text-[#CBD5E1] border-[#2D4A3E] hover:text-white'
              }`}
            >
              Personalized Ads
            </button>
          </div>
        </div>

        {/* Compliance Checklist */}
        <div className="mt-4 space-y-2">
          {COMPLIANCE_ITEMS.map((item) => (
            <div
              key={item.title}
              className="p-3 rounded-xl bg-[#0D1A15] border border-[#274136] flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-white">{item.title}</div>
                <div className="text-[11px] text-[#94A3B8] mt-0.5">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Platform-Specific Google AdMob Unit IDs */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold text-[#C5D5CC]">Google AdMob Unit IDs</span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0D1A15] border border-[#274136]">
              <button
                type="button"
                onClick={() => setUnitTab('android')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  unitTab === 'android' ? 'bg-[#EAB957] text-[#1A1000]' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Android
              </button>
              <button
                type="button"
                onClick={() => setUnitTab('ios')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  unitTab === 'ios' ? 'bg-[#EAB957] text-[#1A1000]' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                iOS
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#0D1A15] border border-[#274136]">
              <div className="text-[#94A3B8]">{unitTab === 'android' ? 'Android' : 'iOS'} App ID (Test — swap in manifest)</div>
              <div className="mt-1 font-mono text-[11px] text-[#EAB957] break-all">
                {unitTab === 'android' ? ADMOB_CONFIG.appIdAndroid : ADMOB_CONFIG.appIdIos}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#0D1A15] border border-[#274136]">
              <div className="text-[#94A3B8]">
                Adaptive Banner Unit {unitTab === 'android' ? '(Live)' : '(Test)'}
              </div>
              <div className="mt-1 font-mono text-[11px] text-white break-all">
                {unitTab === 'android' ? ADMOB_CONFIG.bannerUnitIdAndroid : ADMOB_CONFIG.bannerUnitIdIos}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#0D1A15] border border-[#274136]">
              <div className="text-[#94A3B8]">Rewarded Video Unit</div>
              <div className="mt-1 font-mono text-[11px] text-white break-all">
                {unitTab === 'android' ? ADMOB_CONFIG.rewardedUnitIdAndroid : ADMOB_CONFIG.rewardedUnitIdIos}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#0D1A15] border border-[#274136]">
              <div className="text-[#94A3B8]">Interstitial Unit (1/3 matches · 90s cap)</div>
              <div className="mt-1 font-mono text-[11px] text-white break-all">
                {unitTab === 'android'
                  ? ADMOB_CONFIG.interstitialUnitIdAndroid
                  : ADMOB_CONFIG.interstitialUnitIdIos}
              </div>
            </div>
          </div>
        </div>

        {/* Capacitor Native .apk / .aab / .ipa Build Steps */}
        <div className="mt-4 rounded-xl bg-[#0B1612] border border-[#274136] p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-[#C5D5CC]">
              Capacitor Native Build (.apk / .aab &amp; .ipa)
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs text-[#EAB957] hover:text-white cursor-pointer"
            >
              {copiedBridge ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedBridge ? 'Copied' : 'Copy Commands'}
            </button>
          </div>
          <pre className="text-[11px] font-mono text-[#A6BBB0] overflow-x-auto leading-relaxed">
            {capacitorSnippet}
          </pre>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-display font-bold text-sm game-btn-gold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function AndroidAdMobGuideCard() {
  return (
    <div className="rounded-2xl bg-[#14251E]/90 border border-[#2F4E42] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold text-white">
            Play Store &amp; App Store AdMob Readiness
          </h3>
          <p className="mt-1 text-xs text-[#9BB0A5] max-w-2xl">
            Pre-wired with official Google AdMob Android &amp; iOS test Unit IDs, automatic{' '}
            <code className="font-mono text-[#EAB957]">@capacitor-community/admob</code> &amp;{' '}
            <code className="font-mono text-[#EAB957]">window.AndroidAdMob</code> bridge detection,
            UMP/ATT non-personalized default, gameplay banner hiding, and 1-per-
            {ADMOB_CONFIG.interstitialEveryNMatches} matches / 90s interstitial cooldown.
          </p>
        </div>
        <ShieldCheck className="w-5 h-5 text-[#34D399] shrink-0 mt-0.5" />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-[#0C1814] border border-[#274136]">
          <div className="text-[#94A3B8]">Adaptive Banner</div>
          <div className="mt-1 font-mono text-white break-all">{ADMOB_CONFIG.bannerUnitId}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#0C1814] border border-[#274136]">
          <div className="text-[#94A3B8]">Rewarded Video</div>
          <div className="mt-1 font-mono text-[#EAB957] break-all">{ADMOB_CONFIG.rewardedUnitId}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#0C1814] border border-[#274136]">
          <div className="text-[#94A3B8]">Interstitial</div>
          <div className="mt-1 font-mono text-white break-all">{ADMOB_CONFIG.interstitialUnitId}</div>
        </div>
      </div>
    </div>
  );
}
