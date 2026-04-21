import { initPaymentSheet, presentPaymentSheet } from "@stripe/stripe-react-native";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";

export const STRIPE_UPGRADE_CANCELED = 'STRIPE_UPGRADE_CANCELED';

/**
 * Native payment flow for upgrading to Premium using Stripe Payment Sheet.
 * This happens entirely within the app.
 */
export async function handleUpgrade() {
  try {
    console.log("[handleUpgrade] Starting upgrade flow...");

    // 1. Get Payment Sheet data from Cloud Function
    const createPremiumSubscriptionSheet = httpsCallable(functions, "createPremiumSubscriptionSheet");
    const result: any = await createPremiumSubscriptionSheet();

    const {
      paymentIntentClientSecret,
      customerEphemeralKeySecret,
      customerId,
      subscriptionId,
      paymentIntentId,
      invoiceId
    } = result.data;

    console.log("[handleUpgrade] Initializing Payment Sheet...");

    // 2. Initialize the Native Stripe UI
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: "Local List",
      customerId: customerId,
      customerEphemeralKeySecret: customerEphemeralKeySecret,
      paymentIntentClientSecret: paymentIntentClientSecret,
      allowsDelayedPaymentMethods: false,
      returnURL: 'myapp://auth-action?checkout=premium',
    });

    if (initError) {
      console.error("[handleUpgrade] Stripe Init Error:", initError);
      throw new Error(initError.message);
    }

    // 3. Open the Payment Sheet (Slide-up menu)
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        console.log("[handleUpgrade] User canceled payment.");
        return STRIPE_UPGRADE_CANCELED;
      }
      console.error("[handleUpgrade] Stripe Presentation Error:", presentError);
      throw new Error(presentError.message);
    }

    console.log("[handleUpgrade] Payment successful, finalizing subscription...");

    // 4. Finalize the subscription on your backend
    const finalizePremiumSubscription = httpsCallable(functions, "finalizePremiumSubscription");
    await finalizePremiumSubscription({
      subscriptionId,
      paymentIntentId,
      invoiceId
    });

    console.log("[handleUpgrade] ✅ Upgrade complete!");
    return { success: true };

  } catch (error: any) {
    console.error("[handleUpgrade] Fatal upgrade error:", error);
    throw error;
  }
}
