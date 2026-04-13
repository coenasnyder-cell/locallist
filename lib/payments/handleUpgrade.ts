import { app, auth } from '@/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Linking } from 'react-native';

export const STRIPE_UPGRADE_CANCELED = 'stripe_upgrade_canceled';

type UpgradeResult =
  | { success: true }
  | { success: false; error: string };

export async function handleUpgrade(): Promise<UpgradeResult> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return { success: false, error: 'Sign in to upgrade to Premium.' };
  }

  try {
    const functions = getFunctions(app);
    const createCheckout = httpsCallable(functions, 'createPremiumUpgradeCheckoutSession');

    const res: any = await createCheckout({
      mobileApp: true,
    });

    const data = res?.data || {};
    const checkoutUrl = String(data.url || '').trim();

    if (!checkoutUrl) {
      return { success: false, error: 'Invalid premium checkout link from server.' };
    }

    await Linking.openURL(checkoutUrl);

    return { success: true };

  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Could not start Premium checkout.',
    };
  }
}