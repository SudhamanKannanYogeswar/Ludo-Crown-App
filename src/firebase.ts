import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

interface CapacitorFirebaseAuthPlugin {
  signInWithGoogle?: (options?: { skipNativeAuth?: boolean }) => Promise<{
    credential?: {
      idToken?: string | null;
      accessToken?: string | null;
    } | null;
  }>;
  signOut?: () => Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    FirebaseAuthentication?: CapacitorFirebaseAuthPlugin;
  };
}

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  { experimentalAutoDetectLongPolling: true },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export function isCapacitorNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function') {
    return cap.isNativePlatform();
  }
  const platform = cap.getPlatform?.();
  return platform === 'android' || platform === 'ios';
}

export async function signInWithGoogleAuto(): Promise<void> {
  if (isCapacitorNativeApp()) {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    const nativeAuth = cap?.Plugins?.FirebaseAuthentication;
    if (!nativeAuth?.signInWithGoogle) {
      throw new Error('NATIVE_AUTH_PLUGIN_MISSING');
    }

    const result = await nativeAuth.signInWithGoogle({ skipNativeAuth: true });
    const idToken = result?.credential?.idToken;
    const accessToken = result?.credential?.accessToken ?? undefined;

    if (!idToken) {
      throw new Error('NATIVE_AUTH_NO_ID_TOKEN');
    }

    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    await signInWithCredential(auth, credential);
    return;
  }

  await signInWithPopup(auth, googleProvider);
}

export async function signOutGoogleAuto(): Promise<void> {
  if (isCapacitorNativeApp()) {
    try {
      const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
      await cap?.Plugins?.FirebaseAuthentication?.signOut?.();
    } catch {
      // Proceed to Firebase JS SDK signOut even if native signOut fails
    }
  }
  await signOut(auth);
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
