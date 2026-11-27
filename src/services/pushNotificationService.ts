import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';

export type NotificationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface NotificationPreferences {
  enabled: boolean;
  roomInvites: boolean;
  friendRequests: boolean;
  dailyRewards: boolean;
}

const PREFS_STORAGE_KEY = 'ludo_crown_notif_prefs_v1';
const DAILY_REMINDER_KEY = 'ludo_crown_daily_notif_date_v1';
const FCM_TOKEN_STORAGE_KEY = 'ludo_crown_fcm_token_v1';

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: false,
  roomInvites: true,
  friendRequests: true,
  dailyRewards: true,
};

export function loadNotificationPrefs(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      enabled: Boolean(parsed.enabled),
      roomInvites: parsed.roomInvites !== false,
      friendRequests: parsed.friendRequests !== false,
      dailyRewards: parsed.dailyRewards !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveNotificationPrefsLocal(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

export function getStoredFcmToken(): string {
  try {
    return localStorage.getItem(FCM_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredFcmToken(token: string): void {
  try {
    localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function shouldTriggerDailyResetAlert(todayDateStr: string): boolean {
  try {
    return localStorage.getItem(DAILY_REMINDER_KEY) !== todayDateStr;
  } catch {
    return false;
  }
}

export function markDailyResetAlertShown(todayDateStr: string): void {
  try {
    localStorage.setItem(DAILY_REMINDER_KEY, todayDateStr);
  } catch {
    // ignore
  }
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await PushNotifications.checkPermissions();
      if (status.receive === 'granted') return 'granted';
      if (status.receive === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unsupported';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'prompt';
}

export const DEFAULT_FCM_CHANNEL_ID = 'ludo_crown_alerts';
export type NotificationTargetTab =
  | 'lobby'
  | 'tournaments'
  | 'rewards'
  | 'friends'
  | 'atelier'
  | 'leaderboard';

let nativeListenersBound = false;
let androidChannelCreated = false;

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (androidChannelCreated || !Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await PushNotifications.createChannel({
      id: DEFAULT_FCM_CHANNEL_ID,
      name: 'Ludo Crown Alerts & Rewards',
      description: 'Friend table invites, Daily Gift & Lucky Spin resets, and Weekend Mini-Cups.',
      importance: 4,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    androidChannelCreated = true;
  } catch {
    // Ignore on platforms/versions that do not support channels
  }
}

function resolveNotificationTargetTab(data?: Record<string, unknown>): NotificationTargetTab {
  const rawTab = String(data?.tab || '').toLowerCase();
  if (rawTab === 'shop' || rawTab === 'atelier') return 'atelier';
  if (
    rawTab === 'lobby' ||
    rawTab === 'tournaments' ||
    rawTab === 'rewards' ||
    rawTab === 'friends' ||
    rawTab === 'leaderboard'
  ) {
    return rawTab;
  }
  const type = String(data?.type || '').toLowerCase();
  if (type === 'room_invite' || type === 'friend_request') return 'friends';
  if (type === 'daily_reward' || type === 'lucky_spin' || type === 'streak') return 'rewards';
  if (type === 'weekend_cup' || type === 'tournament') return 'tournaments';
  if (type === 'cosmetic' || type === 'shop') return 'atelier';
  return 'lobby';
}

function bindNativePushListeners(callbacks: {
  onToken: (token: string, platform: 'android' | 'ios' | 'web') => void;
  onForegroundMessage?: (title: string, body: string) => void;
  onNotificationTap?: (targetTab: NotificationTargetTab) => void;
}): void {
  if (nativeListenersBound) return;
  nativeListenersBound = true;

  PushNotifications.addListener('registration', (token: Token) => {
    const val = (token?.value || '').trim();
    if (val) {
      setStoredFcmToken(val);
      const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
      callbacks.onToken(val, platform);
    }
  });

  PushNotifications.addListener('registrationError', () => {
    // Graceful fallback when google-services.json isn't present in local debug builds
  });

  PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      if (callbacks.onForegroundMessage) {
        callbacks.onForegroundMessage(
          notification.title || 'Ludo Crown',
          notification.body || 'You have a new update!'
        );
      }
    }
  );

  PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      if (callbacks.onNotificationTap) {
        callbacks.onNotificationTap(
          resolveNotificationTargetTab(action.notification?.data as Record<string, unknown>)
        );
      }
    }
  );
}

export async function syncPushIfAlreadyGranted(callbacks: {
  onToken: (token: string, platform: 'android' | 'ios' | 'web') => void;
  onForegroundMessage?: (title: string, body: string) => void;
  onNotificationTap?: (targetTab: NotificationTargetTab) => void;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await ensureAndroidNotificationChannel();
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') return false;
    bindNativePushListeners(callbacks);
    await PushNotifications.register();
    return true;
  } catch {
    return false;
  }
}

export async function registerForPushNotifications(callbacks: {
  onToken: (token: string, platform: 'android' | 'ios' | 'web') => void;
  onForegroundMessage?: (title: string, body: string) => void;
  onNotificationTap?: (targetTab: NotificationTargetTab) => void;
}): Promise<{ granted: boolean; token?: string; reason?: string }> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureAndroidNotificationChannel();
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive !== 'granted') {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== 'granted') {
        return { granted: false, reason: 'Permission declined on device.' };
      }

      bindNativePushListeners(callbacks);
      await PushNotifications.register();
      const existingToken = getStoredFcmToken();
      return { granted: true, token: existingToken || undefined };
    } catch {
      return { granted: false, reason: 'Push service unavailable on this build.' };
    }
  }

  // Web browser Notifications API fallback
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { granted: false, reason: 'Browser notifications are not supported here.' };
  }

  try {
    const result =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
    if (result === 'granted') {
      callbacks.onToken('web_browser_opt_in', 'web');
      return { granted: true };
    }
    return { granted: false, reason: 'Notifications were blocked in browser settings.' };
  } catch {
    return { granted: false, reason: 'Unable to request notification permission.' };
  }
}

export function showDeviceNotificationAlert(title: string, body: string, tag?: string): void {
  if (Capacitor.isNativePlatform()) {
    // On native devices, real-time foreground toast handles active-app alerts while FCM handles background delivery.
    return;
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: tag || 'ludo-crown-alert',
    });
  } catch {
    // Some mobile webviews disallow `new Notification()` outside a service worker
  }
}
