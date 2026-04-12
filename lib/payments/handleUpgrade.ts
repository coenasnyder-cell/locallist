import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '@/firebase';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';

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

    // 🔥 THIS is the correct function
    const createSheet = httpsCallable(functions, 'createPremiumPaymentSheet');

    const res: any = await createSheet({
      premiumTestMode: true,
    });

    const data = res.data;

    if (
      !data?.paymentIntentClientSecret ||
      !data?.customerEphemeralKeySecret ||
      !data?.customerId
    ) {
      return { success: false, error: 'Invalid payment setup from server.' };
    }

    // ✅ Initialize PaymentSheet
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'Local List',
      customerId: data.customerId,
      customerEphemeralKeySecret: data.customerEphemeralKeySecret,
      paymentIntentClientSecret: data.paymentIntentClientSecret,
    });

    if (initError) {
      return { success: false, error: initError.message };
    }

    // ✅ Present PaymentSheet
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return { success: false, error: STRIPE_UPGRADE_CANCELED };
      }
      return { success: false, error: presentError.message };
    }

    // ✅ Finalize subscription
    const finalize = httpsCallable(functions, 'finalizePremiumSubscription');
    await finalize({ subscriptionId: data.subscriptionId });

    return { success: true };

  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Could not start Premium checkout.',
    };
  }
}