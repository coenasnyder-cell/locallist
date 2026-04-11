export class NativeGoogleSignInCancelledError extends Error {
  constructor() {
    super('Native Google Sign-In is not available on web.');
    this.name = 'NativeGoogleSignInCancelledError';
  }
}

export class NativeGoogleSignInTimedOutError extends Error {
  constructor() {
    super('Google sign-in took too long.');
    this.name = 'NativeGoogleSignInTimedOutError';
  }
}

export function configureNativeGoogleSignIn(): void {}

export async function signOutNativeGoogle(): Promise<void> {
  return Promise.resolve();
}

export async function getNativeGoogleIdToken(): Promise<string> {
  throw new Error('Native Google Sign-In is not available on web.');
}

export function isNativeGoogleSignInCancelled(_error: unknown): boolean {
  return false;
}

export function getNativeGoogleSignInErrorMessage(_error: unknown): string {
  return 'Google sign-in is only available in the Local List mobile app.';
}
