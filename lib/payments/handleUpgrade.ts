import { initPaymentSheet, presentPaymentSheet } from "@stripe/stripe-react-native";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";

export const STRIPE_UPGRADE_CANCELED = 'STRIPE_UPGRADE_CANCELED';

/**
 * Logic to handle the premium business upgrade flow using Stripe Payment Sheet.
 */
export async function handleUpgrade() {
  try {
    // 1. Call Cloud Function to create the Subscription + Payment Intent
    // This matches the function name in your backend: functions/src/index.ts
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

    // 2. Initialize the Payment Sheet
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: "Local List",
      customerId: customerId,
      customerEphemeralKeySecret: customerEphemeralKeySecret,
      paymentIntentClientSecret: paymentIntentClientSecret,
      allowsDelayedPaymentMethods: false,
      returnURL: 'myapp://auth-action?checkout=premium', // Required for some payment methods
    });

    if (initError) {
      console.error("Stripe Payment Sheet initialization error:", initError);
      throw new Error(initError.message);
    }

    // 3. Present the Payment Sheet
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        console.log("User canceled the payment");
        return STRIPE_UPGRADE_CANCELED;
      }
      console.error("Stripe Payment Sheet presentation error:", presentError);
      throw new Error(presentError.message);
    }

    // 4. Finalize the subscription on the backend
    const finalizePremiumSubscription = httpsCallable(functions, "finalizePremiumSubscription");
    await finalizePremiumSubscription({
      subscriptionId,
      paymentIntentId,
      invoiceId
    });

    return { success: true };

  } catch (error: any) {
    console.error("Upgrade process failed:", error);
    throw error;
  }
}
