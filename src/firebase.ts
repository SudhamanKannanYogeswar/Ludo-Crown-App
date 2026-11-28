import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  signInWithCredential,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  { experimentalAutoDetectLongPolling: true },
  firebaseConfig.firestoreDatabaseId
);

function createResilientAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
}

export const auth: Auth = createResilientAuth();
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function isCapacitorNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

const SIGN_IN_WATCHDOG_MS = 75_000;
let activeSignInPromise: Promise<User | null> | null = null;

async function performNativeGoogleSignIn(): Promise<User> {
  const attempt = async (): Promise<User> => {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result?.credential?.idToken || null;
    const accessToken = result?.credential?.accessToken || null;

    if (!idToken && !accessToken) {
      throw new Error('NATIVE_AUTH_NO_ID_TOKEN');
    }

    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const userCred = await signInWithCredential(auth, credential);
    try {
      await userCred.user.getIdToken();
    } catch {
      // Proceed with freshly minted credential
    }
    return userCred.user;
  };

  try {
    return await attempt();
  } catch (err) {
    const code = String((err as { code?: string } | null)?.code || '').toLowerCase();
    // Retry once cleanly if Android Credential Manager returned a stale cached token
    if (code === 'auth/invalid-credential' || code === 'auth/user-token-expired') {
      await FirebaseAuthentication.signOut().catch(() => {});
      return attempt();
    }
    throw err;
  }
}

export async function signInWithGoogleAuto(): Promise<User | null> {
  if (auth.currentUser) {
    try {
      await auth.currentUser.getIdToken();
    } catch {
      // Keep active signed-in session
    }
    return auth.currentUser;
  }

  if (activeSignInPromise) {
    return activeSignInPromise;
  }

  const runSignIn = async (): Promise<User | null> => {
    if (isCapacitorNativeApp()) {
      return performNativeGoogleSignIn();
    }

    const userCred = await signInWithPopup(auth, googleProvider);
    try {
      await userCred.user.getIdToken();
    } catch {
      // Proceed with active popup session
    }
    return userCred.user;
  };

  let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  const watchdogPromise = new Promise<never>((_, reject) => {
    watchdogTimer = setTimeout(() => {
      reject(new Error('SIGN_IN_TIMEOUT'));
    }, SIGN_IN_WATCHDOG_MS);
  });

  activeSignInPromise = Promise.race([runSignIn(), watchdogPromise]);

  try {
    return await activeSignInPromise;
  } finally {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    activeSignInPromise = null;
  }
}

export function formatGoogleSignInError(err: unknown): { silent: boolean; message: string } {
  const errObj = err as { code?: string; message?: string } | null;
  const code = String(errObj?.code || '').toLowerCase();
  const rawMsg = err instanceof Error ? err.message : String(errObj?.message || err || '');
  const lower = `${code} ${rawMsg}`.toLowerCase();

  // User intentionally closed/cancelled sign-in prompt
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    lower.includes('popup-closed-by-user') ||
    lower.includes('cancelled-popup-request') ||
    lower.includes('12501') ||
    lower.includes('user cancelled') ||
    lower.includes('canceled') ||
    lower.includes('dismissed')
  ) {
    return { silent: true, message: '' };
  }

  if (rawMsg === 'SIGN_IN_TIMEOUT') {
    return {
      silent: false,
      message: 'Google Sign-In timed out. Please tap Sign In again and complete the prompt.',
    };
  }

  if (code === 'auth/user-disabled') {
    return {
      silent: false,
      message: 'This Google account is currently disabled for Ludo Crown.',
    };
  }

  if (isCapacitorNativeApp()) {
    if (
      lower.includes('default_web_client_id') ||
      lower.includes('developer_error') ||
      lower.includes('statuscode=10') ||
      lower.includes('apiexception: 10') ||
      lower.includes('12500') ||
      rawMsg === 'NATIVE_AUTH_NO_ID_TOKEN'
    ) {
      return {
        silent: false,
        message: `Google Sign-In config error (${code || rawMsg || 'code 10'}). Check SHA-1 in Firebase Console & re-download google-services.json.`,
      };
    }
    if (lower.includes('network') || lower.includes('statuscode=7') || lower.includes('timeout')) {
      return {
        silent: false,
        message: 'Network issue during Google Sign-In. Please check your connection and try again.',
      };
    }
    return {
      silent: false,
      message: `Google Sign-In error: ${code || rawMsg || 'Please check internet connection and try again.'}`,
    };
  }

  if (code === 'auth/popup-blocked' || lower.includes('popup-blocked')) {
    return {
      silent: false,
      message: 'Sign-In popup was blocked by your browser. Please allow popups and tap Sign In again.',
    };
  }
  if (code === 'auth/unauthorized-domain' || lower.includes('unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return {
      silent: false,
      message: `Sign-In domain "${host}" is not authorized in Firebase Auth settings.`,
    };
  }
  if (code === 'auth/network-request-failed' || lower.includes('network-request-failed')) {
    return {
      silent: false,
      message: 'Network error during Google Sign-In. Please check your internet connection and retry.',
    };
  }
  if (code === 'auth/operation-not-supported-in-this-environment') {
    return {
      silent: false,
      message: 'This in-app browser restricts Google Sign-In popups. Please open Ludo Crown in Chrome or Safari.',
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      silent: false,
      message: 'Too many sign-in attempts right now. Please wait a moment and try again.',
    };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/internal-error') {
    return {
      silent: false,
      message: 'Google Sign-In session expired. Please tap Sign In again.',
    };
  }

  return {
    silent: false,
    message: `Unable to complete Google Sign-In${code ? ` (${code})` : ''}. Please try again.`,
  };
}

export async function signOutGoogleAuto(): Promise<void> {
  if (isCapacitorNativeApp()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch {
      // Proceed to Firebase JS SDK signOut even if native signOut fails
    }
  }
  await signOut(auth);
}

export async function deleteCurrentAuthUser(): Promise<void> {
  const current = auth.currentUser;
  if (!current) return;
  await deleteUser(current);
  if (isCapacitorNativeApp()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch {
      // Native cache cleanup is best-effort after Firebase Auth deletion
    }
  }
}


export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testConnection(): Promise<boolean> {
  if (connectionTested) return true;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
      return false;
    }
    // Permission denied on test/connection confirms live server reachability
    return true;
  }
}
