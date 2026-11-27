import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  type AdMobBannerSize,
} from '@capacitor-community/admob';

export type RewardedPlacementId =
  | 'double_match_reward'
  | 'daily_bonus_coins'
  | 'bonus_gems'
  | 'bonus_wheel_spin'
  | 'free_tournament_ticket'
  | 'low_coin_rescue'
  | 'tactical_reroll';

export type MobilePlatform = 'android' | 'ios' | 'web';

export type AdConsentMode = 'non_personalized' | 'personalized';

export type BannerPositionMode = 'top' | 'bottom';

export interface BannerSyncOptions {
  position?: BannerPositionMode;
  marginPx?: number;
  forceReload?: boolean;
}

export interface NativeBannerMetrics {
  heightPx: number;
  loaded: boolean;
  position: BannerPositionMode;
}

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
const DEFAULT_ADAPTIVE_BANNER_HEIGHT_PX = 60;
const BANNER_RETRY_DELAYS_MS = [8_000, 18_000, 35_000, 60_000];

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
 * - Android Adaptive Banner, Rewarded Video, and Post-Match Interstitial are all wired to live AdMob Unit IDs.
 * - Optional override via VITE_ADMOB_ANDROID_INTERSTITIAL_ID is still supported if you ever rotate the unit.
 */
const GOOGLE_TEST_PUB_PREFIX = 'ca-app-pub-3940256099942544/';
const ENV_ANDROID_INTERSTITIAL = (
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_ADMOB_ANDROID_INTERSTITIAL_ID || ''
).trim();

const ANDROID_UNIT_IDS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-7279678697929131/9701826584',
  interstitial: ENV_ANDROID_INTERSTITIAL || 'ca-app-pub-7279678697929131/6274263600',
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
  interstitialEveryNMatches: 2,
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
  low_coin_rescue: {
    title: 'Treasury Coin Rescue',
    rewardLabel: '+300 Rescue Coins',
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
let capacitorInitPromise: Promise<void> | null = null;
let bannerListenersRegistered = false;

let bannerCreated = false;
let bannerCurrentlyShown = false;
let activeBannerPosition: BannerPositionMode | null = null;
let activeBannerMargin: number | null = null;
let activeBannerNpa: boolean | null = null;

let desiredBannerVisible = false;
let desiredBannerPosition: BannerPositionMode = 'top';
let desiredBannerMargin = 0;

let bannerRetryAttempt = 0;
let bannerRetryTimer: ReturnType<typeof setTimeout> | null = null;
let bannerOpChain: Promise<void> = Promise.resolve();

let rewardedPrepared = false;
let rewardedPrepareInFlight = false;
let interstitialPrepared = false;
let interstitialPrepareInFlight = false;

const bannerMetrics: NativeBannerMetrics = {
  heightPx: DEFAULT_ADAPTIVE_BANNER_HEIGHT_PX,
  loaded: false,
  position: 'top',
};

const metricsSubscribers = new Set<(metrics: NativeBannerMetrics) => void>();

function emitBannerMetrics() {
  const snapshot: NativeBannerMetrics = { ...bannerMetrics };
  metricsSubscribers.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function getNativeBannerMetrics(): NativeBannerMetrics {
  return { ...bannerMetrics };
}

export function subscribeNativeBannerMetrics(
  listener: (metrics: NativeBannerMetrics) => void
): () => void {
  metricsSubscribers.add(listener);
  listener({ ...bannerMetrics });
  return () => {
    metricsSubscribers.delete(listener);
  };
}

function clearBannerRetryTimer() {
  if (bannerRetryTimer) {
    clearTimeout(bannerRetryTimer);
    bannerRetryTimer = null;
  }
}

function scheduleBannerRetry() {
  clearBannerRetryTimer();
  if (!desiredBannerVisible || !hasCapacitorAdMobPlugin()) return;
  if (bannerRetryAttempt >= BANNER_RETRY_DELAYS_MS.length) return;
  const delay = BANNER_RETRY_DELAYS_MS[bannerRetryAttempt];
  bannerRetryAttempt += 1;
  bannerRetryTimer = setTimeout(() => {
    bannerRetryTimer = null;
    if (!desiredBannerVisible) return;
    syncNativeBannerVisibility(true, {
      position: desiredBannerPosition,
      marginPx: desiredBannerMargin,
      forceReload: true,
    });
  }, delay);
}

function registerBannerListenersOnce() {
  if (bannerListenersRegistered || !hasCapacitorAdMobPlugin()) return;
  bannerListenersRegistered = true;

  AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
    bannerRetryAttempt = 0;
    clearBannerRetryTimer();
    bannerMetrics.loaded = true;
    emitBannerMetrics();
  }).catch(() => {});

  AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
    if (size && typeof size.height === 'number' && size.height > 0) {
      // Clamp adaptive banner height to sensible safe-zone bounds (50px-90px)
      const clamped = Math.max(50, Math.min(90, Math.round(size.height)));
      if (bannerMetrics.heightPx !== clamped) {
        bannerMetrics.heightPx = clamped;
        emitBannerMetrics();
      }
    }
  }).catch(() => {});

  AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
    // BannerExecutor.java destroys mAdView on load failure, so reset local tracking flags
    bannerCreated = false;
    bannerCurrentlyShown = false;
    bannerMetrics.loaded = false;
    emitBannerMetrics();
    scheduleBannerRetry();
  }).catch(() => {});
}

/**
 * Awaits a single shared AdMob.initialize() promise so early startup calls
 * (e.g. initial Home banner) NEVER race SDK initialization and silently fail.
 */
async function ensureCapacitorAdMobInitialized(): Promise<void> {
  if (!hasCapacitorAdMobPlugin()) return;
  if (capacitorInitialized) return;
  if (!capacitorInitPromise) {
    capacitorInitPromise = AdMob.initialize({})
      .then(() => {
        capacitorInitialized = true;
        registerBannerListenersOnce();
      })
      .catch((err) => {
        capacitorInitialized = false;
        capacitorInitPromise = null;
        throw err;
      });
  }
  await capacitorInitPromise;
}

export function initNativeAdMob(): void {
  if (hasCapacitorAdMobPlugin()) {
    ensureCapacitorAdMobInitialized().catch(() => {});
  }
}

export function preloadNativeRewardedAd(): void {
  if (!hasCapacitorAdMobPlugin() || rewardedPrepared || rewardedPrepareInFlight) return;
  rewardedPrepareInFlight = true;
  const npa = getAdConsentMode() === 'non_personalized';
  ensureCapacitorAdMobInitialized()
    .then(() => AdMob.prepareRewardVideoAd({ adId: ADMOB_CONFIG.rewardedUnitId, npa }))
    .then(() => {
      rewardedPrepared = true;
    })
    .catch(() => {
      rewardedPrepared = false;
    })
    .finally(() => {
      rewardedPrepareInFlight = false;
    });
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
      if (!rewardedPrepared) {
        await AdMob.prepareRewardVideoAd({ adId: ADMOB_CONFIG.rewardedUnitId, npa });
      }
      rewardedPrepared = false;
      const reward = await AdMob.showRewardVideoAd();
      // Gently warm up the next rewarded ad in the background for snappy UX
      setTimeout(() => preloadNativeRewardedAd(), 1500);
      return { earned: Boolean(reward && (reward.amount === undefined || reward.amount > 0)) };
    } catch (err) {
      rewardedPrepared = false;
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

export function preloadNativeInterstitialAd(): void {
  if (
    !hasCapacitorAdMobPlugin() ||
    interstitialPrepared ||
    interstitialPrepareInFlight ||
    isTestAdUnitId(ADMOB_CONFIG.interstitialUnitId)
  ) {
    return;
  }
  interstitialPrepareInFlight = true;
  const npa = getAdConsentMode() === 'non_personalized';
  ensureCapacitorAdMobInitialized()
    .then(() => AdMob.prepareInterstitial({ adId: ADMOB_CONFIG.interstitialUnitId, npa }))
    .then(() => {
      interstitialPrepared = true;
    })
    .catch(() => {
      interstitialPrepared = false;
    })
    .finally(() => {
      interstitialPrepareInFlight = false;
    });
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
      if (!interstitialPrepared) {
        await AdMob.prepareInterstitial({ adId: ADMOB_CONFIG.interstitialUnitId, npa });
      }
      interstitialPrepared = false;
      await AdMob.showInterstitial();
      // Gently warm up the next post-match interstitial in the background
      setTimeout(() => preloadNativeInterstitialAd(), 2500);
      return true;
    } catch {
      interstitialPrepared = false;
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

/**
 * Policy-safe, serialized Adaptive Banner controller.
 * - Supports TOP_CENTER (during active matches, docked above the Match Header Bar)
 *   and BOTTOM_CENTER (on menu screens above the mobile tab bar, and in Waiting Rooms).
 * - Guarantees SDK initialization finishes before calling showBanner().
 * - Automatically retries on transient no-fill / network startup errors.
 */
export function syncNativeBannerVisibility(
  visible: boolean,
  optionsOrMargin?: number | BannerSyncOptions
) {
  const npa = getAdConsentMode() === 'non_personalized';
  const opts: BannerSyncOptions =
    typeof optionsOrMargin === 'number'
      ? { marginPx: optionsOrMargin, position: 'top' }
      : optionsOrMargin || {};

  const resolvedPosition: BannerPositionMode = opts.position || 'top';
  const resolvedMargin =
    typeof opts.marginPx === 'number'
      ? opts.marginPx
      : resolvedPosition === 'top'
        ? 0
        : typeof window !== 'undefined' && window.innerWidth < 768
          ? 60
          : 0;
  const forceReload = Boolean(opts.forceReload);

  if (hasCapacitorAdMobPlugin()) {
    const placementChanged =
      desiredBannerVisible !== visible ||
      desiredBannerPosition !== resolvedPosition ||
      desiredBannerMargin !== resolvedMargin;

    desiredBannerVisible = visible;
    desiredBannerPosition = resolvedPosition;
    desiredBannerMargin = resolvedMargin;

    if (bannerMetrics.position !== resolvedPosition) {
      bannerMetrics.position = resolvedPosition;
      emitBannerMetrics();
    }

    if (placementChanged && !forceReload) {
      bannerRetryAttempt = 0;
      clearBannerRetryTimer();
    }

    if (!visible) {
      clearBannerRetryTimer();
    }

    bannerOpChain = bannerOpChain
      .then(async () => {
        if (!desiredBannerVisible) {
          if (bannerCreated && bannerCurrentlyShown) {
            bannerCurrentlyShown = false;
            await AdMob.hideBanner().catch(() => {});
          }
          return;
        }

        await ensureCapacitorAdMobInitialized();

        // Check desired state again in case another screen change happened during init
        if (!desiredBannerVisible) return;

        const sameConfig =
          bannerCreated &&
          activeBannerPosition === desiredBannerPosition &&
          activeBannerMargin === desiredBannerMargin &&
          activeBannerNpa === npa;

        if (sameConfig && !forceReload) {
          if (!bannerCurrentlyShown) {
            await AdMob.resumeBanner();
            bannerCurrentlyShown = true;
          }
          return;
        }

        if (bannerCreated) {
          await AdMob.removeBanner().catch(() => {});
          bannerCreated = false;
          bannerCurrentlyShown = false;
          // Allow Android BannerExecutor runOnUiThread() to complete destroying mAdView
          await new Promise((resolve) => setTimeout(resolve, 120));
        }

        const nativePosition =
          desiredBannerPosition === 'top'
            ? BannerAdPosition.TOP_CENTER
            : BannerAdPosition.BOTTOM_CENTER;

        await AdMob.showBanner({
          adId: ADMOB_CONFIG.bannerUnitId,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: nativePosition,
          margin: desiredBannerMargin,
          npa,
        });

        bannerCreated = true;
        bannerCurrentlyShown = true;
        activeBannerPosition = desiredBannerPosition;
        activeBannerMargin = desiredBannerMargin;
        activeBannerNpa = npa;
      })
      .catch(() => {
        bannerCreated = false;
        bannerCurrentlyShown = false;
        scheduleBannerRetry();
      });
    return;
  }

  if (typeof window !== 'undefined' && typeof window.AndroidAdMob?.setBannerVisible === 'function') {
    window.AndroidAdMob.setBannerVisible(visible, ADMOB_CONFIG.bannerUnitId, npa);
  }
}
