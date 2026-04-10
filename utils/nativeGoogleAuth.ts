export class NativeGoogleSignInCancelledError extends Error {
  constructor() {
    super('Native Google Sign-In is not available on web.');
    this.name = 'NativeGoogleSignInCancelledError';
  }
}

export function configureNativeGoogleSignIn(): void {}

export async function getNativeGoogleIdToken(): Promise<string> {
  throw new Error('Native Google Sign-In is not available on web.');
}

export function isNativeGoogleSignInCancelled(_error: unknown): boolean {
  return false;
}
