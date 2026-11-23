export type RewardedPlacementId =
  | 'double_match_reward'
  | 'daily_bonus_coins'
  | 'free_tournament_ticket'
  | 'tactical_reroll';

export interface AdMobPlacementConfig {
  appIdAndroid: string;
  bannerUnitId: string;
  interstitialUnitId: string;
  rewardedUnitId: string;
  interstitialEveryNMatches: number;
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
      showRewardedAd?: (unitId: string, placementId: string) => Promise<boolean> | boolean;
      showInterstitialAd?: (unitId: string) => Promise<boolean> | boolean;
      setBannerVisible?: (visible: boolean, unitId: string) => void;
    };
  }
}

/**
 * Official Google AdMob Android Test Unit IDs ready to swap with production IDs on Google Play release.
 */
export const ADMOB_CONFIG: AdMobPlacementConfig = {
  appIdAndroid: 'ca-app-pub-3940256099942544~3347511713',
  bannerUnitId: 'ca-app-pub-3940256099942544/6300978111',
  interstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
  interstitialEveryNMatches: 3,
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

export function hasNativeAndroidAdBridge(): boolean {
  return typeof window !== 'undefined' && typeof window.AndroidAdMob?.showRewardedAd === 'function';
}

export function syncNativeBannerVisibility(visible: boolean) {
  if (typeof window !== 'undefined' && typeof window.AndroidAdMob?.setBannerVisible === 'function') {
    window.AndroidAdMob.setBannerVisible(visible, ADMOB_CONFIG.bannerUnitId);
  }
}
