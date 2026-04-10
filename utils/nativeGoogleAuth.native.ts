import {
    GoogleSignin,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_AUTH_CONFIG } from '../constants/googleAuth';

const GOOGLE_SIGN_IN_TIMEOUT_MS = 15000;
let configured = false;

export class NativeGoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'NativeGoogleSignInCancelledError';
  }
}

export class NativeGoogleSignInTimedOutError extends Error {
  constructor() {
    super('Google sign-in took too long.');
    this.name = 'NativeGoogleSignInTimedOutError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = GOOGLE_SIGN_IN_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new NativeGoogleSignInTimedOutError()), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function configureNativeGoogleSignIn(): void {
  if (configured) {
    return;
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_AUTH_CONFIG.webClientId,
    iosClientId: GOOGLE_AUTH_CONFIG.iosClientId,
    offlineAccess: false,
  });

  configured = true;
}

export async function getNativeGoogleIdToken(): Promise<string> {
  configureNativeGoogleSignIn();

  await withTimeout(
    GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  );

  const response = await withTimeout(GoogleSignin.signIn());
  if (!isSuccessResponse(response)) {
    throw new NativeGoogleSignInCancelledError();
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('Google sign-in did not return an ID token.');
  }

  return idToken;
}

export function isNativeGoogleSignInCancelled(error: unknown): boolean {
  if (error instanceof NativeGoogleSignInCancelledError) {
    return true;
  }

  return isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED;
}

export function getNativeGoogleSignInErrorMessage(error: unknown): string | null {
  if (isNativeGoogleSignInCancelled(error)) {
    return null;
  }

  if (error instanceof NativeGoogleSignInTimedOutError) {
    return 'Google sign-in took too long. Please try again.';
  }

  const code = typeof error === 'object' && error ? String((error as { code?: string | number }).code ?? '') : '';
  const rawMessage = typeof error === 'object' && error ? String((error as { message?: string }).message || '') : '';
  const upperCode = code.toUpperCase();
  const upperMessage = rawMessage.toUpperCase();

  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.IN_PROGRESS) {
      return 'Google sign-in is already in progress. Please wait a moment and try again.';
    }

    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'Google Play Services is unavailable or out of date on this device.';
    }
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled for this Firebase project yet.';
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account with this email already exists. Please log in using your original sign-in method.';
  }

  if (code === '10' || upperCode === 'DEVELOPER_ERROR' || upperMessage.includes('DEVELOPER_ERROR')) {
    return 'Google sign-in failed with DEVELOPER_ERROR. This usually means the Android OAuth client or SHA fingerprint does not match the installed build.';
  }

  if (code || rawMessage) {
    return `Google sign-in failed. Code: ${code || 'unknown'}. ${rawMessage || 'See console log for more details.'}`.trim();
  }

  return 'Google sign-in failed. Please try again.';
}
