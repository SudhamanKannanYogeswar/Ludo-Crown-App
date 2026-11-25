export type RewardedPlacementId =
  | 'double_match_reward'
  | 'daily_bonus_coins'
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

interface CapacitorAdMobPlugin {
  initialize?: (opts?: { initializeForTesting?: boolean; testingDevices?: string[] }) => Promise<void>;
  showBanner?: (opts: {
    adId: string;
    adSize?: string;
    position?: string;
    margin?: number;
    isTesting?: boolean;
    npa?: boolean;
  }) => Promise<void>;
  hideBanner?: () => Promise<void>;
  prepareRewardVideoAd?: (opts: { adId: string; isTesting?: boolean; npa?: boolean }) => Promise<void>;
  showRewardVideoAd?: () => Promise<{ type?: string; amount?: number } | void>;
  prepareInterstitial?: (opts: { adId: string; isTesting?: boolean; npa?: boolean }) => Promise<void>;
  showInterstitial?: () => Promise<void>;
}

declare global {
  interface Window {
    AndroidAdMob?: {
      showRewardedAd?: (unitId: string, placementId: string, npa?: boolean) => Promise<boolean> | boolean;
      showInterstitialAd?: (unitId: string, npa?: boolean) => Promise<boolean> | boolean;
      setBannerVisible?: (visible: boolean, unitId: string, npa?: boolean) => void;
    };
    Capacitor?: {
      getPlatform?: () => string;
      Plugins?: {
        AdMob?: CapacitorAdMobPlugin;
      };
    };
  }
}

const CONSENT_STORAGE_KEY = 'ludo_crown_ad_consent_mode_v1';

export function detectMobilePlatform(): MobilePlatform {
  if (typeof window === 'undefined') return 'web';
  const capPlatform = window.Capacitor?.getPlatform?.();
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
 * - Android Banner uses the live AdMob Banner Unit ID configured for Ludo Crown.
 * - Interstitial, Rewarded, and iOS units stay on official Google Test IDs until live IDs are added.
 */
const ANDROID_UNIT_IDS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-7279678697929131/9701826584',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

const IOS_TEST_IDS = {
  appId: 'ca-app-pub-3940256099942544~1458002511',
  banner: 'ca-app-pub-3940256099942544/2934735716',
  interstitial: 'ca-app-pub-3940256099942544/4411468910',
  rewarded: 'ca-app-pub-3940256099942544/1712485313',
};

const resolvedPlatform = detectMobilePlatform();
const activeIds = resolvedPlatform === 'ios' ? IOS_TEST_IDS : ANDROID_UNIT_IDS;

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
  return typeof window !== 'undefined' && Boolean(window.Capacitor?.Plugins?.AdMob);
}

export function hasNativeAndroidAdBridge(): boolean {
  return (
    typeof window !== 'undefined' &&
    (typeof window.AndroidAdMob?.showRewardedAd === 'function' || hasCapacitorAdMobPlugin())
  );
}

let capacitorInitialized = false;

async function ensureCapacitorAdMobInitialized(plugin: CapacitorAdMobPlugin) {
  if (capacitorInitialized) return;
  capacitorInitialized = true;
  try {
    await plugin.initialize?.({});
  } catch {
    capacitorInitialized = false;
  }
}

export async function showNativeRewardedAd(placementId: RewardedPlacementId): Promise<boolean | null> {
  const npa = getAdConsentMode() === 'non_personalized';
  if (hasCapacitorAdMobPlugin()) {
    const plugin = window.Capacitor!.Plugins!.AdMob!;
    try {
      await ensureCapacitorAdMobInitialized(plugin);
      await plugin.prepareRewardVideoAd?.({ adId: ADMOB_CONFIG.rewardedUnitId, npa });
      const reward = await plugin.showRewardVideoAd?.();
      return Boolean(reward);
    } catch {
      return false;
    }
  }
  if (typeof window !== 'undefined' && typeof window.AndroidAdMob?.showRewardedAd === 'function') {
    const earned = await Promise.resolve(
      window.AndroidAdMob.showRewardedAd(ADMOB_CONFIG.rewardedUnitId, placementId, npa)
    );
    return Boolean(earned);
  }
  return null;
}

export async function showNativeInterstitialAd(): Promise<boolean> {
  const npa = getAdConsentMode() === 'non_personalized';
  if (hasCapacitorAdMobPlugin()) {
    const plugin = window.Capacitor!.Plugins!.AdMob!;
    try {
      await ensureCapacitorAdMobInitialized(plugin);
      await plugin.prepareInterstitial?.({ adId: ADMOB_CONFIG.interstitialUnitId, npa });
      await plugin.showInterstitial?.();
      return true;
    } catch {
      return false;
    }
  }
  if (typeof window !== 'undefined' && typeof window.AndroidAdMob?.showInterstitialAd === 'function') {
    await Promise.resolve(window.AndroidAdMob.showInterstitialAd(ADMOB_CONFIG.interstitialUnitId, npa));
    return true;
  }
  return false;
}

export function syncNativeBannerVisibility(visible: boolean) {
  const npa = getAdConsentMode() === 'non_personalized';
  if (hasCapacitorAdMobPlugin()) {
    const plugin = window.Capacitor!.Plugins!.AdMob!;
    if (visible) {
      ensureCapacitorAdMobInitialized(plugin)
        .then(() =>
          plugin.showBanner?.({
            adId: ADMOB_CONFIG.bannerUnitId,
            adSize: 'ADAPTIVE_BANNER',
            position: 'BOTTOM_CENTER',
            margin: 56,
            npa,
          })
        )
        .catch(() => {});
    } else {
      plugin.hideBanner?.().catch(() => {});
    }
    return;
  }
  if (typeof window !== 'undefined' && typeof window.AndroidAdMob?.setBannerVisible === 'function') {
    window.AndroidAdMob.setBannerVisible(visible, ADMOB_CONFIG.bannerUnitId, npa);
  }
}
