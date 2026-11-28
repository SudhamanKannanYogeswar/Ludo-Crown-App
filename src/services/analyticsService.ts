import { Capacitor } from '@capacitor/core';
import {
  ConsentStatus,
  ConsentType,
  FirebaseAnalytics,
} from '@capacitor-firebase/analytics';
import {
  Analytics,
  getAnalytics,
  isSupported,
  logEvent as webLogEvent,
  setAnalyticsCollectionEnabled as webSetAnalyticsCollectionEnabled,
  setUserId as webSetUserId,
  setUserProperties as webSetUserProperties,
} from 'firebase/analytics';
import firebaseConfig from '../../firebase-applet-config.json';
import { app } from '../firebase';
import { AdConsentMode, getAdConsentMode } from './adMobService';

type AnalyticsParamValue = string | number | boolean;
type AnalyticsParams = Record<string, AnalyticsParamValue>;

let initialized = false;
let webAnalytics: Analytics | null = null;
let webInitPromise: Promise<Analytics | null> | null = null;

function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

function getWebMeasurementId(): string {
  const envId = (
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_GA_MEASUREMENT_ID || ''
  ).trim();
  const cfgId = String((firebaseConfig as { measurementId?: string }).measurementId || '').trim();
  return envId || cfgId;
}

async function ensureWebAnalytics(): Promise<Analytics | null> {
  if (isNativePlatform()) return null;
  if (webAnalytics) return webAnalytics;
  const measurementId = getWebMeasurementId();
  if (!measurementId) return null;

  if (!webInitPromise) {
    webInitPromise = (async () => {
      try {
        const supported = await isSupported();
        if (!supported) return null;
        // Inject measurementId onto app options if provided via VITE_GA_MEASUREMENT_ID
        const opts = app.options as { measurementId?: string };
        if (!opts.measurementId) {
          opts.measurementId = measurementId;
        }
        const instance = getAnalytics(app);
        webSetAnalyticsCollectionEnabled(instance, true);
        webAnalytics = instance;
        return instance;
      } catch {
        return null;
      }
    })();
  }
  return webInitPromise;
}

function sanitizeParams(params?: AnalyticsParams): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number> = {};
  for (const [rawKey, rawVal] of Object.entries(params)) {
    const key = rawKey.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
    if (!key) continue;
    if (typeof rawVal === 'boolean') {
      out[key] = rawVal ? 1 : 0;
    } else if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
      out[key] = rawVal;
    } else if (typeof rawVal === 'string') {
      out[key] = rawVal.slice(0, 100);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function syncAnalyticsAdConsent(mode: AdConsentMode): Promise<void> {
  if (!isNativePlatform()) return;
  const adStatus = mode === 'personalized' ? ConsentStatus.Granted : ConsentStatus.Denied;
  try {
    await FirebaseAnalytics.setConsent({
      type: ConsentType.AnalyticsStorage,
      status: ConsentStatus.Granted,
    });
    await FirebaseAnalytics.setConsent({
      type: ConsentType.AdPersonalization,
      status: adStatus,
    });
    await FirebaseAnalytics.setConsent({
      type: ConsentType.AdUserData,
      status: adStatus,
    });
    await FirebaseAnalytics.setConsent({
      type: ConsentType.AdStorage,
      status: adStatus,
    });
  } catch {
    // Non-fatal on builds where google-services.json isn't bundled yet
  }
}

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  if (isNativePlatform()) {
    (async () => {
      try {
        await FirebaseAnalytics.setEnabled({ enabled: true });
        await syncAnalyticsAdConsent(getAdConsentMode());
        await FirebaseAnalytics.logEvent({
          name: 'app_session_ready',
          params: {
            platform: Capacitor.getPlatform(),
          },
        });
      } catch {
        // Non-fatal if running on a debug build without google-services.json
      }
    })();
    return;
  }

  ensureWebAnalytics().catch(() => {});
}

export function trackScreenView(screenName: string): void {
  const cleanName = screenName.trim().slice(0, 64) || 'lobby';
  if (isNativePlatform()) {
    FirebaseAnalytics.setCurrentScreen({
      screenName: cleanName,
      screenClassOverride: 'LudoCrown',
    }).catch(() => {});
    FirebaseAnalytics.logEvent({
      name: 'screen_view',
      params: {
        screen_name: cleanName,
        screen_class: 'LudoCrown',
      },
    }).catch(() => {});
    return;
  }

  ensureWebAnalytics()
    .then((inst) => {
      if (!inst) return;
      webLogEvent(inst, 'screen_view', {
        firebase_screen: cleanName,
        firebase_screen_class: 'LudoCrownWeb',
      });
    })
    .catch(() => {});
}

export function setAnalyticsUser(
  uid: string | null,
  props?: { league?: string; isGuest?: boolean }
): void {
  if (isNativePlatform()) {
    FirebaseAnalytics.setUserId({ userId: uid }).catch(() => {});
    if (props?.league) {
      FirebaseAnalytics.setUserProperty({
        key: 'league_tier',
        value: props.league.slice(0, 36),
      }).catch(() => {});
    }
    if (props?.isGuest !== undefined) {
      FirebaseAnalytics.setUserProperty({
        key: 'account_type',
        value: props.isGuest ? 'guest' : 'google',
      }).catch(() => {});
    }
    return;
  }

  ensureWebAnalytics()
    .then((inst) => {
      if (!inst) return;
      webSetUserId(inst, uid);
      if (props) {
        webSetUserProperties(inst, {
          ...(props.league ? { league_tier: props.league } : {}),
          ...(props.isGuest !== undefined
            ? { account_type: props.isGuest ? 'guest' : 'google' }
            : {}),
        });
      }
    })
    .catch(() => {});
}

export function trackAnalyticsEvent(name: string, params?: AnalyticsParams): void {
  const cleanEvent = name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
  if (!cleanEvent) return;
  const cleanParams = sanitizeParams(params);

  if (isNativePlatform()) {
    FirebaseAnalytics.logEvent({
      name: cleanEvent,
      ...(cleanParams ? { params: cleanParams } : {}),
    }).catch(() => {});
    return;
  }

  ensureWebAnalytics()
    .then((inst) => {
      if (!inst) return;
      webLogEvent(inst, cleanEvent, cleanParams);
    })
    .catch(() => {});
}

export function resetAnalyticsData(): void {
  if (isNativePlatform()) {
    FirebaseAnalytics.setUserId({ userId: null }).catch(() => {});
    FirebaseAnalytics.resetAnalyticsData().catch(() => {});
    return;
  }

  ensureWebAnalytics()
    .then((inst) => {
      if (!inst) return;
      webSetUserId(inst, null);
    })
    .catch(() => {});
}
