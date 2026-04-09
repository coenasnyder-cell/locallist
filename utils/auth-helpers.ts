import type { User } from 'firebase/auth';
import { sendEmailVerification } from 'firebase/auth';

export type AuthMode = 'login' | 'signup';

/** Use for Google OAuth/Firebase failures so users never see raw vendor text (e.g. insufficient permissions). */
export const GOOGLE_SIGN_IN_GENERIC_MESSAGE = 'Google sign-in failed. Please try again.';

type PostAuthRouteOptions = {
  isNewUser?: boolean;
  listingId?: string;
  returnTo?: string;
};

export function normalizeAuthCode(error: unknown): string | undefined {
  const code = typeof error === 'object' && error ? (error as { code?: string }).code : undefined;
  if (code) return code;

  const message = typeof error === 'object' && error ? String((error as { message?: string }).message || '') : '';
  const match = message.match(/auth\/[a-z-]+/i);
  return match ? match[0] : undefined;
}

export function getAuthErrorMessage(error: unknown, mode: AuthMode): string {
  const code = normalizeAuthCode(error);

  if (mode === 'login') {
    if (code === 'auth/invalid-login-credentials') {
      return 'No account found with that email, or incorrect password. Please try again or create a new account.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
      return 'Invalid email or password.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many failed login attempts. Please try again later.';
    }
    if (code === 'auth/user-disabled') {
      return 'This account has been disabled.';
    }
    return 'Login failed. Please try again.';
  }

  if (code === 'auth/email-already-in-use' || code === 'auth/account-exists-with-different-credential') {
    return 'Account already exists. Please log in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password should be at least 6 characters.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }

  return 'Signup failed. Please try again.';
}

export function getPostAuthRoute(options: PostAuthRouteOptions = {}): string {
  const { isNewUser = false, listingId, returnTo } = options;
  if (listingId) {
    return `/listing?id=${listingId}`;
  }
  if (returnTo) {
    return returnTo;
  }
  if (isNewUser) {
    return '/(tabs)/profilebutton';
  }
  return '/(tabs)';
}

export function isPasswordAccountUnverified(user: Pick<User, 'providerData' | 'emailVerified'>): boolean {
  const providerIds = user.providerData?.map((provider) => provider.providerId) ?? [];
  const isPasswordUser = providerIds.includes('password');
  return isPasswordUser && !user.emailVerified;
}

export async function sendVerificationEmailForUser(user: User): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await sendEmailVerification(user);
    return { ok: true };
  } catch (error: any) {
    const message = typeof error === 'object' && error ? String(error.message || 'Could not send verification email.') : 'Could not send verification email.';
    return { ok: false, message };
  }
}
