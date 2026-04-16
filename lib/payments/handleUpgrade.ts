import { app, auth } from '@/firebase';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';

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

    // 1. Create subscription + get Payment Sheet params from Cloud Function
    const createSheet = httpsCallable(functions, 'createPremiumSubscriptionSheet');
    const res: any = await createSheet({});

    const data = res?.data || {};
    const {
      paymentIntentClientSecret,
      customerId,
      customerEphemeralKeySecret,
      subscriptionId,
      paymentIntentId,
    } = data as {
      paymentIntentClientSecret?: string;
      customerId?: string;
      customerEphemeralKeySecret?: string;
      subscriptionId?: string;
      paymentIntentId?: string;
    };

    if (!paymentIntentClientSecret) {
      return { success: false, error: 'Could not initialize premium checkout.' };
    }

    // 2. Initialize the native Stripe Payment Sheet
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'Local List',
      paymentIntentClientSecret,
      customerId,
      customerEphemeralKeySecret,
    });

    if (initError) {
      return { success: false, error: initError.message || 'Could not initialize payment sheet.' };
    }

    // 3. Present the Payment Sheet to the user
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return { success: false, error: STRIPE_UPGRADE_CANCELED };
      }
      return { success: false, error: presentError.message || 'Payment failed.' };
    }

    // 4. Finalize: verify subscription is active and update Firestore
    const finalize = httpsCallable(functions, 'finalizePremiumSubscription');
    await finalize({ subscriptionId, paymentIntentId });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Could not start Premium checkout.',
    };
  }
}