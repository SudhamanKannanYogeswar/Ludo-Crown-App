import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob';

export type RewardedPlacementId =
  | 'double_match_reward'
  | 'daily_bonus_coins'
  | 'bonus_gems'
  | 'bonus_wheel_spin'
  | 'free_tournament_ticket'
  | 'tactical_reroll';

export type MobilePlatform = 'android' | 'ios' | 'web';

export type AdConsentMode = 'non_personalized' | 'personalized';

export interface AdMobPlacementConfig {
  appIdAndroid: string;
  appIdIos: string;
  bannerUnitIdAndroid: string;
  bannerUnitIdIos: string;
  interstitialUnitIdAndroid: string;
  interstitialUnitIdIos: string;
  rewardedUnitIdAndroid: string;
  rewardedUnitIdIos: string;
  // Active platform resolved aliases
  bannerUnitId: string;
  interstitialUnitId: string;
  rewardedUnitId: string;
  interstitialEveryNMatches: number;
  minInterstitialCooldownMs: number;
  dailyRewardedCap: number;
}

export interface ActiveAdModalState {
  kind: 'rewarded' | 'interstitial';
  placementId: string;
  title: string;
  rewardLabel: string;
  unitId: string;
  durationSeconds: number;
  onComplete: () => void;
  onDismiss: () => void;
}

declare global {
  interface Window {
    AndroidAdMob?: {
      showRewardedAd?: (unitId: string, placementId: string, npa?: boolean) => Promise<boolean> | boolean;
      showInterstitialAd?: (unitId: string, npa?: boolean) => Promise<boolean> | boolean;
      setBannerVisible?: (visible: boolean, unitId: string, npa?: boolean) => void;
    };
  }
}

const CONSENT_STORAGE_KEY = 'ludo_crown_ad_consent_mode_v1';

export function detectMobilePlatform(): MobilePlatform {
  if (typeof window === 'undefined') return 'web';
  const capPlatform = Capacitor.getPlatform();
  if (capPlatform === 'android' || capPlatform === 'ios') return capPlatform;
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'web';
}

export function getAdConsentMode(): AdConsentMode {
  try {
    const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (saved === 'personalized' || saved === 'non_personalized') return saved;
  } catch {
    // ignore storage errors
  }
  // Safe default for GDPR (Google UMP) & Apple ATT until explicit consent
  return 'non_personalized';
}

export function setAdConsentMode(mode: AdConsentMode): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

/**
 * Google AdMob Android & iOS Unit IDs.
 * - Android Adaptive Banner and Android Rewarded Video are wired to your live AdMob Unit IDs.
 * - Optional live Android Interstitial ID can be injected at build time via VITE_ADMOB_ANDROID_INTERSTITIAL_ID.
 *   When left unset, native builds skip interstitials rather than serving a Google "Test Ad" popup to Play Store users.
 */
const GOOGLE_TEST_PUB_PREFIX = 'ca-app-pub-3940256099942544/';
const ENV_ANDROID_INTERSTITIAL = (
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_ADMOB_ANDROID_INTERSTITIAL_ID || ''
).trim();

const ANDROID_UNIT_IDS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-7279678697929131/9701826584',
  interstitial: ENV_ANDROID_INTERSTITIAL || 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-7279678697929131/9754631621',
};

const IOS_TEST_IDS = {
  appId: 'ca-app-pub-3940256099942544~1458002511',
  banner: 'ca-app-pub-3940256099942544/2934735716',
  interstitial: 'ca-app-pub-3940256099942544/4411468910',
  rewarded: 'ca-app-pub-3940256099942544/1712485313',
};

const resolvedPlatform = detectMobilePlatform();
const activeIds = resolvedPlatform === 'ios' ? IOS_TEST_IDS : ANDROID_UNIT_IDS;

export function isTestAdUnitId(unitId: string): boolean {
  return !unitId || unitId.startsWith(GOOGLE_TEST_PUB_PREFIX);
}

export const ADMOB_CONFIG: AdMobPlacementConfig = {
  appIdAndroid: ANDROID_UNIT_IDS.appId,
  appIdIos: IOS_TEST_IDS.appId,
  bannerUnitIdAndroid: ANDROID_UNIT_IDS.banner,
  bannerUnitIdIos: IOS_TEST_IDS.banner,
  interstitialUnitIdAndroid: ANDROID_UNIT_IDS.interstitial,
  interstitialUnitIdIos: IOS_TEST_IDS.interstitial,
  rewardedUnitIdAndroid: ANDROID_UNIT_IDS.rewarded,
  rewardedUnitIdIos: IOS_TEST_IDS.rewarded,
  bannerUnitId: activeIds.banner,
  interstitialUnitId: activeIds.interstitial,
  rewardedUnitId: activeIds.rewarded,
  interstitialEveryNMatches: 3,
  minInterstitialCooldownMs: 90_000,
  dailyRewardedCap: 15,
};

export const REWARDED_PLACEMENTS: Record<
  RewardedPlacementId,
  { title: string; rewardLabel: string; durationSeconds: number }
> = {
  double_match_reward: {
    title: 'Double Match Payout',
    rewardLabel: '2x Match Coins',
    durationSeconds: 5,
  },
  daily_bonus_coins: {
    title: 'Sponsored Parlor Bonus',
    rewardLabel: '+250 Coins',
    durationSeconds: 5,
  },
  bonus_gems: {
    title: 'Sponsored Gem Vault',
    rewardLabel: '+5 Bonus Gems',
    durationSeconds: 5,
  },
  bonus_wheel_spin: {
    title: 'Lucky Crown Bonus Spin',
    rewardLabel: '1 Extra Wheel Spin',
    durationSeconds: 5,
  },
  free_tournament_ticket: {
    title: 'Sponsored League Entry',
    rewardLabel: '+1 Free Tournament Ticket',
    durationSeconds: 5,
  },
  tactical_reroll: {
    title: 'Second Chance Dice Roll',
    rewardLabel: '1 Re-Roll (Practice Mode)',
    durationSeconds: 4,
  },
};

export function hasCapacitorAdMobPlugin(): boolean {
  return Capacitor.isNativePlatform();
}

export function hasNativeAndroidAdBridge(): boolean {
  return (
    typeof window !== 'undefined' &&
    (typeof window.AndroidAdMob?.showRewardedAd === 'function' || hasCapacitorAdMobPlugin())
  );
}

let capacitorInitialized = false;
let lastBannerMargin: number | null = null;
let bannerCreated = false;
let bannerCurrentlyShown = false;

async function ensureCapacitorAdMobInitialized() {
  if (capacitorInitialized) return;
  capacitorInitialized = true;
  try {
    await AdMob.initialize({});
  } catch {
    capacitorInitialized = false;
  }
}

export function initNativeAdMob(): void {
  if (hasCapacitorAdMobPlugin()) {
    ensureCapacitorAdMobInitialized().catch(() => {});
  }
}

export interface NativeRewardedResult {
  earned: boolean;
  error?: string;
}

export async function showNativeRewardedAd(
  placementId: RewardedPlacementId
): Promise<NativeRewardedResult | null> {
  const npa = getAdConsentMode() === 'non_personalized';
  if (hasCapacitorAdMobPlugin()) {
    try {
      await ensureCapacitorAdMobInitialized();
      await AdMob.prepareRewardVideoAd({ adId: ADMOB_CONFIG.rewardedUnitId, npa });
      const reward = await AdMob.showRewardVideoAd();
      return { earned: Boolean(reward && (reward.amount === undefined || reward.amount > 0)) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'Ad unavailable');
      return { earned: false, error: msg };
    }
  }
  if (typeof window !== 'undefined' && typeof window.AndroidAdMob?.showRewardedAd === 'function') {
    const earned = await Promise.resolve(
      window.AndroidAdMob.showRewardedAd(ADMOB_CONFIG.rewardedUnitId, placementId, npa)
    );
    return { earned: Boolean(earned) };
  }
  return null;
}

export async function showNativeInterstitialAd(): Promise<boolean> {
  const npa = getAdConsentMode() === 'non_personalized';
  // Never serve Google's "Test Ad" interstitial popup to real Play Store users unless a live Interstitial Unit ID is configured
  if (hasCapacitorAdMobPlugin()) {
    if (isTestAdUnitId(ADMOB_CONFIG.interstitialUnitId)) {
      return false;
    }
    try {
      await ensureCapacitorAdMobInitialized();
      await AdMob.prepareInterstitial({ adId: ADMOB_CONFIG.interstitialUnitId, npa });
      await AdMob.showInterstitial();
      return true;
    } catch {
      return false;
    }
  }
  if (typeof window !== 'undefined' && typeof window.AndroidAdMob?.showInterstitialAd === 'function') {
    if (isTestAdUnitId(ADMOB_CONFIG.interstitialUnitId)) return false;
    await Promise.resolve(window.AndroidAdMob.showInterstitialAd(ADMOB_CONFIG.interstitialUnitId, npa));
    return true;
  }
  return false;
}

export function syncNativeBannerVisibility(visible: boolean, bottomMarginPx?: number) {
  const npa = getAdConsentMode() === 'non_personalized';
  if (hasCapacitorAdMobPlugin()) {
    if (visible) {
      const resolvedMargin =
        typeof bottomMarginPx === 'number'
          ? bottomMarginPx
          : typeof window !== 'undefined' && window.innerWidth < 768
            ? 60
            : 0;

      if (bannerCreated && bannerCurrentlyShown && lastBannerMargin === resolvedMargin) {
        return;
      }

      ensureCapacitorAdMobInitialized()
        .then(async () => {
          if (bannerCreated && lastBannerMargin === resolvedMargin) {
            await AdMob.resumeBanner();
            bannerCurrentlyShown = true;
            return;
          }
          if (bannerCreated) {
            await AdMob.removeBanner().catch(() => {});
            bannerCreated = false;
            bannerCurrentlyShown = false;
          }
          await AdMob.showBanner({
            adId: ADMOB_CONFIG.bannerUnitId,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: resolvedMargin,
            npa,
          });
          bannerCreated = true;
          bannerCurrentlyShown = true;
          lastBannerMargin = resolvedMargin;
        })
        .catch(() => {});
    } else if (bannerCreated && bannerCurrentlyShown) {
      bannerCurrentlyShown = false;
      AdMob.hideBanner().catch(() => {});
    }
    return;
  }
  if (typeof window !== 'undefined' && typeof window.AndroidAdMob?.setBannerVisible === 'function') {
    window.AndroidAdMob.setBannerVisible(visible, ADMOB_CONFIG.bannerUnitId, npa);
  }
}
