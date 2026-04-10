import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { app, auth } from '@/firebase';

export const STRIPE_UPGRADE_CANCELED = 'stripe_upgrade_canceled';

type UpgradeResult =
  | { success: true }
  | { success: false; error: string };

type CheckoutSessionResponse = {
  url?: string;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: string }).message || '').trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

export async function handleUpgrade(): Promise<UpgradeResult> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return { success: false, error: 'Sign in to upgrade to Premium.' };
  }

  try {
    const functions = getFunctions(app);
    const createPremiumCheckoutSession = httpsCallable<{ mobileApp: boolean }, CheckoutSessionResponse>(
      functions,
      'createPremiumUpgradeCheckoutSession'
    );

    const result = await withTimeout(
      createPremiumCheckoutSession({ mobileApp: true }),
      20000,
      'Timed out while creating the Premium checkout session.'
    );

    const checkoutUrl = result.data?.url;
    if (!checkoutUrl) {
      return { success: false, error: 'Missing Stripe checkout URL.' };
    }

    const nativeReturnUrl = Linking.createURL('/auth-action');
    const authResult = await withTimeout(
      WebBrowser.openAuthSessionAsync(checkoutUrl, nativeReturnUrl),
      180000,
      'Timed out waiting for checkout to return to the app.'
    );

    if (authResult.type === 'success' && authResult.url) {
      if (authResult.url.includes('checkout=premium')) {
        return { success: true };
      }

      if (authResult.url.includes('premiumCanceled=1')) {
        return { success: false, error: STRIPE_UPGRADE_CANCELED };
      }
    }

    if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
      return { success: false, error: STRIPE_UPGRADE_CANCELED };
    }

    return {
      success: false,
      error: 'Could not confirm the Premium checkout result.',
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Could not start Premium checkout. Please try again.'),
    };
  }
}
