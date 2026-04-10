import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_AUTH_CONFIG } from '../constants/googleAuth';

let configured = false;

export class NativeGoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'NativeGoogleSignInCancelledError';
  }
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
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
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

  return (
    isErrorWithCode(error) &&
    (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)
  );
}
