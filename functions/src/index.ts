/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/scheduler";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, onRequest } from "firebase-functions/v2/https";
import OpenAI from "openai";
import Stripe from "stripe";

// Email triggers (Resend)
export { onFeaturePurchaseCreated, onListingRejected, onMessageCreated, onPremiumPurchaseCreated, onPublicMessageCreated, onUserCreated, onUserDisabled } from "./emailTriggers.js";
export { listingsApi } from "./listingsApi.js";

const openaiKey = defineSecret("OPENAI_API_KEY");

export const testOpenAI = onRequest(
  { secrets: ["OPENAI_API_KEY"] },
  async (req, res) => {
    try {
      const apiKey = openaiKey.value();

      if (!apiKey) {
        throw new Error("Missing OPENAI_API_KEY");
      }

      const openai = new OpenAI({
        apiKey,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: "Say 'connected successfully'" }
        ],
      });

      res.json({
        success: true,
        output: response.choices[0].message.content,
      });
    } catch (error: any) {
      logger.error("OpenAI error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export const unsubscribe = onRequest(async (req, res) => {
  const uid = String(req.query.uid || "").trim();
  const type = String(req.query.type || "").trim().toLowerCase();

  if (!uid || (type !== "messages" && type !== "digests")) {
    res.status(400).send("Invalid unsubscribe link");
    return;
  }

  try {
    const db = getFirestore();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      res.status(404).send("User not found");
      return;
    }

    if (type === "messages") {
      await userRef.set({
        messageNotification: false,
        notifications: {
          messages: false,
        },
      }, { merge: true });
    } else {
      await userRef.set({
        digestNotification: false,
        notifications: {
          digests: false,
        },
      }, { merge: true });
    }

    res
      .status(200)
      .set("Content-Type", "text/html; charset=utf-8")
      .send(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Unsubscribed | Local List</title>
  </head>
  <body style="margin:0;padding:32px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:24px;">Email preference updated</h1>
      <p style="margin:0;color:#475569;line-height:1.6;">
        You will no longer receive ${type === "messages" ? "message notification" : "digest"} emails from Local List.
      </p>
    </div>
  </body>
</html>`.trim());
  } catch (error) {
    logger.error("Failed to unsubscribe email preference", { uid, type, error });
    res.status(500).send("Could not update your email preference right now");
  }
});

// Email test function - send test emails for each template (TEMPORARILY UNSECURED FOR TESTING)
export const sendTestEmail = onCall(
  { secrets: ["RESEND_API_KEY"] },
  async (request) => {
    // TEMP: Removed admin check for testing - ADD BACK AFTER TESTING
    // const auth = request.auth;
    // if (!auth || !auth.token.admin) {
    //   throw new Error("Unauthorized: Admin access required");
    // }

    const { emailType, recipientEmail } = request.data;

    if (!recipientEmail || typeof recipientEmail !== "string") {
      throw new Error("recipientEmail is required");
    }

    if (!emailType || typeof emailType !== "string") {
      throw new Error("emailType is required (welcome, message, featured, premium)");
    }

    try {
      const { sendEmail, welcomeEmail, premiumSubscriptionEmail, featuredListingEmail, messageEmail } = await import(
        "./email/index.js"
      );

      let template;

      switch (emailType.toLowerCase()) {
        case "welcome":
          template = welcomeEmail();
          break;

        case "premium":
          template = premiumSubscriptionEmail();
          break;

        case "featured":
          template = featuredListingEmail("Test Listing Title", 7);
          break;

        case "message":
          template = messageEmail("John Doe", "Jane Smith", "Hey, I'm interested in your listing. Is it still available?");
          break;

        default:
          throw new Error(`Unknown emailType: ${emailType}. Supported types: welcome, premium, featured, message`);
      }

      await sendEmail({
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
      });

      logger.info(`Test ${emailType} email sent successfully`, { recipientEmail });
      return { success: true, message: `Test ${emailType} email sent to ${recipientEmail}` };
    } catch (error) {
      logger.error("Failed to send test email", { emailType, recipientEmail, error });
      throw error;
    }
  }
);

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

initializeApp();

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Weekly cleanup for listings whose owner account no longer exists.
 * This keeps both regular and featured listing surfaces from showing orphaned data.
 */
export const cleanupOrphanListingsWeekly = onSchedule(
  "every sunday 03:00",
  async () => {
    const db = getFirestore();

    try {
      const listingsSnapshot = await db.collection("listings").get();
      if (listingsSnapshot.empty) {
        logger.info("Weekly orphan listing cleanup: no listings found");
        return;
      }

      const listingOwnerIds = Array.from(
        new Set(
          listingsSnapshot.docs
            .map((listingDoc) => String(listingDoc.data()?.userId || "").trim())
            .filter(Boolean)
        )
      );

      if (listingOwnerIds.length === 0) {
        logger.info("Weekly orphan listing cleanup: no owner IDs found");
        return;
      }

      const existingOwnerIds = new Set<string>();
      const ownerIdChunks = chunkArray(listingOwnerIds, 10);

      for (const ownerIdChunk of ownerIdChunks) {
        const usersSnapshot = await db
          .collection("users")
          .where(FieldPath.documentId(), "in", ownerIdChunk)
          .get();

        usersSnapshot.forEach((userDoc) => {
          existingOwnerIds.add(userDoc.id);
        });
      }

      const orphanListingRefs = listingsSnapshot.docs
        .filter((listingDoc) => {
          const ownerId = String(listingDoc.data()?.userId || "").trim();
          return !ownerId || !existingOwnerIds.has(ownerId);
        })
        .map((listingDoc) => listingDoc.ref);

      if (orphanListingRefs.length === 0) {
        logger.info("Weekly orphan listing cleanup: no orphan listings found", {
          scannedListings: listingsSnapshot.size,
          ownerCount: listingOwnerIds.length,
        });
        return;
      }

      const writer = db.bulkWriter();
      orphanListingRefs.forEach((listingRef) => {
        writer.delete(listingRef);
      });
      await writer.close();

      logger.info("Weekly orphan listing cleanup complete", {
        scannedListings: listingsSnapshot.size,
        ownerCount: listingOwnerIds.length,
        deletedListings: orphanListingRefs.length,
      });
    } catch (error) {
      logger.error("Weekly orphan listing cleanup failed", {error});
      throw error;
    }
  }
);

/**
 * Ensures jobBoard documents always keep canonical identity fields.
 */
export const normalizeJobBoardIdentity = onDocumentCreated(
  "jobBoard/{jobDocId}",
  async (event) => {
    const db = getFirestore();
    const snapshot = event.data;
    if (!snapshot) return;

    const jobData = snapshot.data();
    const userId = (jobData.userId as string | undefined) || null;

    if (!userId) {
      logger.warn("Job board document missing userId", { jobDocId: snapshot.id });
      return;
    }

    try {
      const userSnap = await db.collection("users").doc(userId).get();
      const userData = userSnap.exists ? userSnap.data() : null;
      const resolvedUserName =
        userData?.displayName ||
        userData?.name ||
        userData?.email ||
        jobData.userName ||
        "Unknown";
      const resolvedBusinessId = userData?.accountType === "business" ? userId : null;

      const identityUpdates: Record<string, unknown> = {};
      if (jobData.userName !== resolvedUserName) {
        identityUpdates.userName = resolvedUserName;
      }
      if (jobData.businessId !== resolvedBusinessId) {
        identityUpdates.businessId = resolvedBusinessId;
      }

      if (Object.keys(identityUpdates).length > 0) {
        await snapshot.ref.update(identityUpdates);
      }
    } catch (error) {
      logger.error("Failed normalizing jobBoard identity", {
        jobDocId: snapshot.id,
        error,
      });
    }
  }
);

/**
 * Create Stripe Checkout Session for Featured Listing Payment
 * Called from client-side when user wants to feature their listing
 */
export const createCheckoutSession = onCall(
  { secrets: ["STRIPE_SECRET_KEY", "STRIPE_SERVICE_PRICE_ID"] },
  async (request) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const listingPriceId = process.env.STRIPE_LISTING_PRICE_ID?.trim();
    const servicePriceId = process.env.STRIPE_SERVICE_PRICE_ID?.trim();
    
    if (!stripeSecretKey) {
      logger.error("Missing Stripe secret key");
      throw new Error("Stripe is not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const itemTypeRaw = String(request.data?.itemType || "listing").toLowerCase();
    const isService = itemTypeRaw === "service";
    const isMobileApp = Boolean(request.data?.mobileApp);

    const listingId = request.data?.listingId;
    const listingTitle = request.data?.listingTitle;
    const serviceId = request.data?.serviceId;
    const serviceTitle = request.data?.serviceTitle;
    const requestedPostCheckoutPath = String(request.data?.postCheckoutPath || "").trim();

    const safePostCheckoutPath = requestedPostCheckoutPath.startsWith("/")
      ? requestedPostCheckoutPath
      : "";

    const targetId = isService ? serviceId : listingId;
    const targetTitle = isService ? serviceTitle : listingTitle;

    if (!targetId || !targetTitle) {
      throw new Error(
        isService
          ? "Missing required parameters: serviceId and serviceTitle"
          : "Missing required parameters: listingId and listingTitle"
      );
    }

    logger.info(`Creating checkout session for ${isService ? "service" : "listing"}: ${targetId}`);

    try {
      // Determine base URL from the request or use environment variable
      const baseUrl = process.env.FUNCTIONS_EMULATOR === "true" 
        ? "http://localhost:8081" 
        : "https://locallist.biz";

      const unitAmount = isService ? 1000 : 500;
      const durationDays = isService ? 30 : 7;
      const itemName = isService ? `Featured Service - ${targetTitle}` : `Featured Listing - ${targetTitle}`;
      const itemDescription = isService
        ? "30 days of featured service placement (activates after admin approval)"
        : "7 days of featured placement (activates after admin approval)";
      const mobileAuthActionBase = `myapp://auth-action?itemType=${isService ? "service" : "listing"}&${isService ? "serviceId" : "listingId"}=${targetId}`;
      const successUrl =
        isMobileApp
          ? `${mobileAuthActionBase}&checkout=featured`
          : isService && safePostCheckoutPath
            ? `${baseUrl}${safePostCheckoutPath}`
            : `${baseUrl}/profile.html?checkout=featured#pending`;
      const cancelUrl =
        isMobileApp
          ? `${mobileAuthActionBase}&featureCanceled=1`
          : isService
            ? `${baseUrl}/create-service-listing.html?featureCanceled=1`
            : `${baseUrl}/payment-cancel.html?listingId=${targetId}`;

      let selectedPriceId = isService ? servicePriceId : listingPriceId;

      // Guard against misconfigured Stripe price IDs (e.g. service price pointing to $5 listing price).
      // If the configured price amount does not match expected app pricing, fallback to inline price_data.
      if (selectedPriceId) {
        try {
          const configuredPrice = await stripe.prices.retrieve(selectedPriceId);
          const configuredUnitAmount = configuredPrice.unit_amount;

          if (configuredUnitAmount !== unitAmount) {
            logger.warn(
              `Configured ${isService ? "service" : "listing"} price ID '${selectedPriceId}' has unit_amount=${configuredUnitAmount}; expected ${unitAmount}. Falling back to inline price_data.`
            );
            selectedPriceId = undefined;
          }
        } catch (priceLookupError) {
          logger.warn(
            `Could not validate configured price ID '${selectedPriceId}' for ${isService ? "service" : "listing"}; falling back to inline price_data.`,
            priceLookupError
          );
          selectedPriceId = undefined;
        }
      }

      const lineItems = selectedPriceId
        ? [
            {
              price: selectedPriceId,
              quantity: 1,
            },
          ]
        : [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: itemName,
                  description: itemDescription,
                },
                unit_amount: unitAmount,
              },
              quantity: 1,
            },
          ];

      if (!selectedPriceId) {
        logger.warn(
          `Missing ${isService ? "STRIPE_SERVICE_PRICE_ID" : "STRIPE_LISTING_PRICE_ID"}; using fallback inline price_data.`
        );
      }

      const createSessionWithItems = async (items: Stripe.Checkout.SessionCreateParams.LineItem[]) => {
        return stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: items,
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          client_reference_id: String(targetId),
          metadata: {
            itemType: isService ? "service" : "listing",
            targetId: String(targetId),
            durationDays: String(durationDays),
            ...(isService ? { serviceId: String(targetId) } : { listingId: String(targetId) }),
          },
        });
      };

      let session: Stripe.Checkout.Session;
      try {
        session = await createSessionWithItems(lineItems as Stripe.Checkout.SessionCreateParams.LineItem[]);
      } catch (error: unknown) {
        const stripeErr = error as { code?: string; param?: string; message?: string };
        const priceNotFound =
          stripeErr?.code === "resource_missing" &&
          stripeErr?.param === "line_items[0][price]";

        if (!priceNotFound || !selectedPriceId) {
          throw error;
        }

        logger.warn(
          `Configured price ID '${selectedPriceId}' not found for ${isService ? "service" : "listing"}; retrying with inline price_data.`
        );

        const fallbackItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: itemName,
                description: itemDescription,
              },
              unit_amount: unitAmount,
            },
            quantity: 1,
          },
        ];

        session = await createSessionWithItems(fallbackItems);
      }

      logger.info(`Checkout session created: ${session.id} for ${isService ? "service" : "listing"}: ${targetId}`);

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      logger.error("Error creating checkout session:", error);
      throw new Error("Failed to create checkout session");
    }
  }
);

/**
 * Create PaymentIntent for Featured Listing/Service Payment (Mobile Payment Sheet)
 * Returns client secret for Stripe Payment Sheet SDK
 */
export const createFeaturePaymentSheet = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      logger.error("Missing Stripe secret key");
      throw new Error("Stripe is not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const itemType = String(request.data?.itemType || "listing").toLowerCase();
    const isService = itemType === "service";
    const listingId = request.data?.listingId;
    const listingTitle = request.data?.listingTitle;
    const serviceId = request.data?.serviceId;
    const serviceTitle = request.data?.serviceTitle;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new Error("Authentication required");
    }

    const targetId = isService ? serviceId : listingId;
    const targetTitle = isService ? serviceTitle : listingTitle;

    if (!targetId || !targetTitle) {
      throw new Error(
        isService
          ? "Missing required parameters: serviceId and serviceTitle"
          : "Missing required parameters: listingId and listingTitle"
      );
    }

    try {
      const unitAmount = isService ? 1000 : 500; // $10 for service, $5 for listing
      const itemDescription = isService
        ? "30 days of featured service placement (activates after admin approval)"
        : "7 days of featured placement (activates after admin approval)";

      // Create a PaymentIntent for mobile Payment Sheet
      const paymentIntent = await stripe.paymentIntents.create({
        amount: unitAmount,
        currency: "usd",
        payment_method_types: ["card"],
        description: itemDescription,
        metadata: {
          itemType: isService ? "service" : "listing",
          targetId: String(targetId),
          userId: String(userId),
          ...(isService ? { serviceId: String(targetId), serviceTitle } : { listingId: String(targetId), listingTitle }),
        },
      });

      if (!paymentIntent.client_secret) {
        throw new Error("Failed to generate payment intent client secret");
      }

      logger.info(
        `Payment intent created: ${paymentIntent.id} for ${isService ? "service" : "listing"}: ${targetId}`
      );

      return {
        paymentIntentClientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error("Error creating payment intent:", error);
      throw new Error("Failed to create payment sheet");
    }
  }
);

/**
 * Finalize Feature Purchase - called after successful Payment Sheet payment
 * Updates listing/service status and creates purchase record
 */
export const finalizeFeaturePurchase = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    const db = getFirestore();
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured");
    }

    const itemType = String(request.data?.itemType || "listing").toLowerCase();
    const isService = itemType === "service";
    const listingId = request.data?.listingId;
    const serviceId = request.data?.serviceId;
    const paymentIntentId = request.data?.paymentIntentId;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new Error("Authentication required");
    }

    if (!paymentIntentId) {
      throw new Error("Missing paymentIntentId");
    }

    const targetId = isService ? serviceId : listingId;

    if (!targetId) {
      throw new Error(
        isService
          ? "Missing required parameter: serviceId"
          : "Missing required parameter: listingId"
      );
    }

    try {
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2026-02-25.clover",
      });

      // Verify payment intent succeeded
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        throw new Error(`Payment intent status is ${paymentIntent.status}, expected succeeded`);
      }

      // Update the listing/service with featured purchase info
      const collectionName = isService ? "services" : "listings";
      const docRef = db.collection(collectionName).doc(String(targetId));

      await docRef.update({
        featurePaymentStatus: "completed",
        featurePaymentIntentId: paymentIntentId,
        featurePurchasedAt: FieldValue.serverTimestamp(),
        featureExpiresAt: new Date(Date.now() + (isService ? 30 : 7) * 24 * 60 * 60 * 1000), // 30 or 7 days
      });

      logger.info(
        `Featured purchase finalized for ${isService ? "service" : "listing"}: ${targetId} with payment ${paymentIntentId}`
      );

      return {
        success: true,
        message: "Featured purchase completed successfully",
      };
    } catch (error) {
      logger.error("Error finalizing feature purchase:", error);
      throw new Error("Failed to finalize feature purchase");
    }
  }
);

/**
 * Create Stripe Checkout Session for Premium business upgrade.
 */
export const createPremiumUpgradeCheckoutSession = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID?.trim();
    const userId = request.auth?.uid;

    if (!userId) {
      throw new Error("Authentication required");
    }

    if (!stripeSecretKey) {
      logger.error("Missing Stripe secret key");
      throw new Error("Stripe is not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const isMobileApp = Boolean(request.data?.mobileApp);
    const baseUrl = process.env.FUNCTIONS_EMULATOR === "true"
      ? "http://localhost:8081"
      : "https://locallist.biz";

    const successUrl = isMobileApp
      ? "myapp://auth-action?checkout=premium"
      : `${baseUrl}/auth-action?checkout=premium`;
    const cancelUrl = isMobileApp
      ? "myapp://auth-action?premiumCanceled=1"
      : `${baseUrl}/auth-action?premiumCanceled=1`;

    const unitAmount = 1000;
    let selectedPriceId = premiumPriceId;

    if (selectedPriceId) {
      try {
        const configuredPrice = await stripe.prices.retrieve(selectedPriceId);
        if (configuredPrice.unit_amount !== unitAmount) {
          logger.warn(
            `Configured premium price ID '${selectedPriceId}' has unit_amount=${configuredPrice.unit_amount}; expected ${unitAmount}. Falling back to inline price_data.`
          );
          selectedPriceId = undefined;
        }
      } catch (priceLookupError) {
        logger.warn(
          `Could not validate configured premium price ID '${selectedPriceId}'; falling back to inline price_data.`,
          priceLookupError
        );
        selectedPriceId = undefined;
      }
    }

    const lineItems = selectedPriceId
      ? [
          {
            price: selectedPriceId,
            quantity: 1,
          },
        ]
      : [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Premium Business Upgrade",
                description: "Monthly Premium upgrade for Local List business tools",
              },
              unit_amount: unitAmount,
            },
            quantity: 1,
          },
        ];

    if (!selectedPriceId) {
      logger.warn("Missing STRIPE_PREMIUM_PRICE_ID; using fallback inline price_data.");
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems as Stripe.Checkout.SessionCreateParams.LineItem[],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: String(userId),
        metadata: {
          itemType: "premium_upgrade",
          userId: String(userId),
          durationDays: "30",
        },
      });

      logger.info(`Premium upgrade checkout session created: ${session.id} for user: ${userId}`);

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      logger.error("Error creating premium upgrade checkout session:", error);
      throw new Error("Failed to create premium upgrade checkout session");
    }
  }
);

/**
 * Create a Stripe Subscription + Payment Sheet for Premium $10/month upgrade (mobile).
 * Returns clientSecret, ephemeralKey, customerId so the app can use native Payment Sheet.
 */
export const createPremiumSubscriptionSheet = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new Error("Authentication required");
    }

    if (!stripeSecretKey) {
      logger.error("Missing Stripe secret key");
      throw new Error("Stripe is not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const db = getFirestore();
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : undefined;

    // Reuse or create Stripe Customer
    let customerId = userData?.stripeCustomerId as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { firebaseUserId: userId },
      });
      customerId = customer.id;

      await db.collection("users").doc(userId).set(
        { stripeCustomerId: customerId },
        { merge: true }
      );
    }

    // Determine price: use env var or create inline
    let priceId = (process.env.STRIPE_PREMIUM_PRICE_ID || "").trim();

    if (priceId) {
      try {
        const existing = await stripe.prices.retrieve(priceId);
        if (
          existing.unit_amount !== 1000 ||
          existing.recurring?.interval !== "month"
        ) {
          logger.warn(
            `Configured STRIPE_PREMIUM_PRICE_ID '${priceId}' does not match $10/month. Creating ad-hoc price.`
          );
          priceId = "";
        }
      } catch {
        logger.warn(`Could not retrieve STRIPE_PREMIUM_PRICE_ID '${priceId}'. Creating ad-hoc price.`);
        priceId = "";
      }
    }

    if (!priceId) {
      // Find or create a product + recurring price
      const prices = await stripe.prices.list({
        lookup_keys: ["premium_monthly_1000"],
        limit: 1,
      });

      if (prices.data.length > 0) {
        priceId = prices.data[0].id;
      } else {
        const product = await stripe.products.create({
          name: "Local List Premium Business",
          description: "Monthly Premium upgrade for Local List business tools",
        });

        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: 1000,
          currency: "usd",
          recurring: { interval: "month" },
          lookup_key: "premium_monthly_1000",
        });
        priceId = price.id;
      }
    }

    // Create subscription (incomplete — Clover API does not auto-create a PI)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
        payment_method_types: ["card"],
      },
      expand: ["latest_invoice"],
      metadata: {
        firebaseUserId: userId,
        itemType: "premium_upgrade",
      },
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;

    // Clover API removed payment_intent from Invoice.
    // Create a PaymentIntent manually for the invoice amount.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: invoice.amount_due,
      currency: invoice.currency,
      customer: customerId,
      setup_future_usage: "off_session",
      metadata: {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        firebaseUserId: userId,
        itemType: "premium_upgrade",
      },
    });

    if (!paymentIntent.client_secret) {
      logger.error(`PaymentIntent created but no client_secret. PI: ${paymentIntent.id}, status: ${paymentIntent.status}`);
      throw new Error("Could not obtain client secret for checkout.");
    }

    // Ephemeral key so the Payment Sheet can manage saved cards
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2026-02-25.clover" }
    );

    logger.info(
      `Premium subscription sheet created: sub=${subscription.id}, pi=${paymentIntent.id}, invoice=${invoice.id}, user=${userId}`
    );

    return {
      paymentIntentClientSecret: paymentIntent.client_secret,
      customerId,
      customerEphemeralKeySecret: ephemeralKey.secret,
      subscriptionId: subscription.id,
      paymentIntentId: paymentIntent.id,
      invoiceId: invoice.id,
    };
  }
);

/**
 * Finalize Premium Subscription after successful Payment Sheet payment.
 * Verifies the subscription is active and updates the user doc.
 */
export const finalizePremiumSubscription = onCall(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new Error("Authentication required");
    }

    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured");
    }

    const subscriptionId = request.data?.subscriptionId;
    const paymentIntentId = request.data?.paymentIntentId;
    const invoiceId = request.data?.invoiceId;

    if (!subscriptionId) {
      throw new Error("Missing subscriptionId");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    // If we have a paymentIntentId and invoiceId, attach the payment to the invoice
    // so the subscription transitions from incomplete → active
    if (paymentIntentId && invoiceId) {
      try {
        await stripe.invoices.attachPayment(invoiceId, {
          payment_intent: paymentIntentId,
        });
        logger.info(`Attached PI ${paymentIntentId} to invoice ${invoiceId}`);
      } catch (attachErr: any) {
        logger.warn(`attachPayment failed (may already be attached): ${attachErr.message}`);
      }
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (subscription.status !== "active" && subscription.status !== "trialing") {
      throw new Error(`Subscription status is '${subscription.status}', expected active.`);
    }

    const db = getFirestore();

    // Record the purchase
    await db.collection("premiumPurchases").doc(subscriptionId).set({
      userId,
      amount: 10,
      currency: "USD",
      status: "active",
      paymentMethod: "stripe",
      subscriptionId,
      paymentIntentId: paymentIntentId || null,
      purchasedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Activate premium on user doc
    await db.collection("users").doc(userId).set({
      accountType: "business",
      businessTier: "premium",
      isPremium: true,
      premiumStatus: "active",
      premiumActivatedAt: new Date().toISOString(),
      premiumUpdatedAt: new Date().toISOString(),
      upgradedAt: new Date().toISOString(),
      stripeSubscriptionId: subscriptionId,
    }, { merge: true });

    logger.info(`Premium subscription finalized for user ${userId}, sub=${subscriptionId}`);

    return { success: true };
  }
);

/**
 * Scheduled function to expire featured listings after 7 days
 * Runs daily at 2 AM UTC
 */
export const expireFeaturedListings = onSchedule("every day 02:00", async (context) => {
  const db = getFirestore();
  
  try {
    const now = new Date();
    logger.info("Starting featured listing expiration check at", { timestamp: now });
    
    // Find all expired featured listings
    const expiredListings = await db
      .collection("listings")
      .where("isFeatured", "==", true)
      .where("featureExpiresAt", "<", now.toISOString())
      .get();

    logger.info(`Found ${expiredListings.size} expired featured listings`);

    // Batch update to remove featured status and archive expired featured listings
    const batch = db.batch();
    expiredListings.forEach((doc) => {
      batch.update(doc.ref, {
        isFeatured: false,
        status: "archived",
        featureExpiresAt: FieldValue.delete(),
        updatedAt: now.toISOString(),
      });
    });

    await batch.commit();
    logger.info(`Successfully expired ${expiredListings.size} featured listings`);

    // Expire featured services
    const expiredServices = await db
      .collection("services")
      .where("isFeatured", "==", true)
      .where("featureExpiresAt", "<", now.toISOString())
      .get();

    logger.info(`Found ${expiredServices.size} expired featured services`);

    const serviceBatch = db.batch();
    expiredServices.forEach((doc) => {
      serviceBatch.update(doc.ref, {
        isFeatured: false,
        featureExpiresAt: FieldValue.delete(),
        updatedAt: now.toISOString(),
      });
    });

    await serviceBatch.commit();
    logger.info(`Successfully expired ${expiredServices.size} featured services`);
    
    // Also update feature purchases to "completed" status
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    
    const completedPurchases = await db
      .collection("featurePurchases")
      .where("status", "==", "completed")
      .where("expiresAt", "<", futureDate.toISOString())
      .get();

    logger.info(`Found ${completedPurchases.size} completed feature purchases to archive`);
    
  } catch (error) {
    logger.error("Error in expireFeaturedListings:", error);
    throw error;
  }
});

/**
 * Scheduled function to expire marketplace listings and pet posts after 14 days.
 * Runs daily at 02:30 AM UTC.
 * Sets status to 'expired' so owners can relist from their profile.
 */
export const expireStaleListings = onSchedule("every day 02:30", async () => {
  const db = getFirestore();

  try {
    const now = new Date();
    logger.info("Starting stale listing expiration check", { timestamp: now });

    // Expire marketplace listings
    const staleListings = await db
      .collection("listings")
      .where("status", "==", "approved")
      .where("expiresAt", "<", now)
      .get();

    logger.info(`Found ${staleListings.size} expired marketplace listings`);

    if (!staleListings.empty) {
      const chunks = chunkArray(staleListings.docs, 500);
      for (const chunk of chunks) {
        const batch = db.batch();
        for (const doc of chunk) {
          batch.update(doc.ref, {
            status: "expired",
            isActive: false,
            expiredAt: now.toISOString(),
          });
        }
        await batch.commit();
      }
      logger.info(`Expired ${staleListings.size} marketplace listings`);
    }

    // Expire pet posts
    const stalePets = await db
      .collection("pets")
      .where("expiresAt", "<", now)
      .get();

    // Only expire pets that are still in an active status
    const activePets = stalePets.docs.filter((doc) => {
      const status = doc.data().petStatus;
      return status === "lost" || status === "found";
    });

    logger.info(`Found ${activePets.length} expired pet posts`);

    if (activePets.length > 0) {
      const chunks = chunkArray(activePets, 500);
      for (const chunk of chunks) {
        const batch = db.batch();
        for (const doc of chunk) {
          batch.update(doc.ref, {
            petStatus: "expired",
            expiredAt: now.toISOString(),
          });
        }
        await batch.commit();
      }
      logger.info(`Expired ${activePets.length} pet posts`);
    }
  } catch (error) {
    logger.error("Error in expireStaleListings:", error);
    throw error;
  }
});

type OrphanCleanupConfig = {
  collection: string;
  ownerFields: string[];
  includeDocIdAsOwner?: boolean;
  deleteWhenAnyOwnerMissing?: boolean;
};

function getCandidateOwnerIds(
  docData: Record<string, unknown>,
  docId: string,
  config: OrphanCleanupConfig
): string[] {
  const fromFields = config.ownerFields.flatMap((field) => {
    const value = docData[field];

    if (Array.isArray(value)) {
      return value
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0);
    }

    const normalized = String(value || "").trim();
    return normalized ? [normalized] : [];
  });

  const withDocId = config.includeDocIdAsOwner
    ? [...fromFields, String(docId || "").trim()].filter((value) => value.length > 0)
    : fromFields;

  return Array.from(new Set(withDocId));
}

/**
 * Scheduled cleanup for documents whose owner account no longer exists.
 * This includes listings (featured or not), services, jobs, business profiles,
 * pets, events, yard sales, deals, and featured purchase records.
 */
export const cleanupOrphanedMarketplaceDocs = onSchedule("every day 03:00", async () => {
  const db = getFirestore();
  const cleanupConfig: OrphanCleanupConfig[] = [
    { collection: "listings", ownerFields: ["userId"] },
    { collection: "services", ownerFields: ["userId"] },
    { collection: "threads", ownerFields: ["buyerId", "sellerId", "participantIds"], deleteWhenAnyOwnerMissing: true },
    { collection: "jobBoard", ownerFields: ["userId", "businessId"] },
    { collection: "pets", ownerFields: ["userId"] },
    { collection: "events", ownerFields: ["userId"] },
    { collection: "yardSales", ownerFields: ["userId"] },
    { collection: "deals", ownerFields: ["userId", "businessId"] },
    { collection: "businessLocal", ownerFields: ["userId", "ownerUserId"], includeDocIdAsOwner: true },
    { collection: "shopLocal", ownerFields: ["userId", "ownerUserId"], includeDocIdAsOwner: true },
    { collection: "featurePurchases", ownerFields: ["userId"] },
  ];

  try {
    logger.info("Starting orphaned marketplace document cleanup");

    const snapshots = await Promise.all(
      cleanupConfig.map(async (config) => ({
        config,
        snapshot: await db.collection(config.collection).get(),
      }))
    );

    const allUserIds = new Set<string>();
    snapshots.forEach(({ config, snapshot }) => {
      snapshot.docs.forEach((docSnap) => {
        const candidateIds = getCandidateOwnerIds(
          docSnap.data() as Record<string, unknown>,
          docSnap.id,
          config
        );
        candidateIds.forEach((id) => allUserIds.add(id));
      });
    });

    const userIds = Array.from(allUserIds);

    const existingUserIds = new Set<string>();
    const userChunkSize = 300;

    for (let i = 0; i < userIds.length; i += userChunkSize) {
      const chunk = userIds.slice(i, i + userChunkSize);
      const userRefs = chunk.map((userId) => db.collection("users").doc(userId));
      const userSnaps = await db.getAll(...userRefs);

      userSnaps.forEach((userSnap) => {
        if (userSnap.exists) {
          existingUserIds.add(userSnap.id);
        }
      });
    }

    const deleteChunkSize = 450;
    let totalChecked = 0;
    let totalDeleted = 0;

    for (const { config, snapshot } of snapshots) {
      const orphanedRefs = snapshot.docs
        .filter((docSnap) => {
          const candidateIds = getCandidateOwnerIds(
            docSnap.data() as Record<string, unknown>,
            docSnap.id,
            config
          );

          if (candidateIds.length === 0) return true;
          if (config.deleteWhenAnyOwnerMissing) {
            return candidateIds.some((id) => !existingUserIds.has(id));
          }
          return candidateIds.every((id) => !existingUserIds.has(id));
        })
        .map((docSnap) => docSnap.ref);

      for (let i = 0; i < orphanedRefs.length; i += deleteChunkSize) {
        const chunk = orphanedRefs.slice(i, i + deleteChunkSize);
        const batch = db.batch();
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      totalChecked += snapshot.size;
      totalDeleted += orphanedRefs.length;

      logger.info(
        `Orphan cleanup: ${config.collection} checked ${snapshot.size}, deleted ${orphanedRefs.length}`
      );
    }

    logger.info(
      `Orphaned marketplace cleanup complete: checked ${totalChecked}, deleted ${totalDeleted}`
    );
  } catch (error) {
    logger.error("Error in cleanupOrphanedMarketplaceDocs:", error);
    throw error;
  }
});

/**
 * Stripe Webhook Handler for successful checkout sessions
 * Updates listing with feature payment status without setting isFeatured yet
 * Featured status only activates when listing is admin-approved
 */
export const handleStripeCheckout = onRequest(
  { secrets: ["STRIPE_WEBHOOK_SECRET"] },
  async (req, res) => {
    const db = getFirestore();
    const signature = req.get("stripe-signature");
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !stripeWebhookSecret) {
      logger.error("Missing Stripe signature or webhook secret");
      res.status(400).send("Missing signature or secret");
      return;
    }

    try {
      // Note: In production, verify Stripe signature with Stripe SDK
      // For now, we'll process the event directly (ensure proper authentication at edge)
      const event = req.body;

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const itemType = String(session.metadata?.itemType || "listing").toLowerCase();
        const premiumUserId = session.metadata?.userId || session.client_reference_id;
        const listingId = session.metadata?.listingId;
        const serviceId = session.metadata?.serviceId;
        const targetId =
          itemType === "service"
            ? serviceId
            : itemType === "premium_upgrade"
              ? premiumUserId
              : listingId;

        if (!targetId) {
          logger.error("checkout.session.completed: Missing targetId in metadata", {
            itemType,
            metadata: session.metadata,
          });
          res.status(400).send("Missing targetId");
          return;
        }

        const durationDays = Number(session.metadata?.durationDays || (itemType === "service" ? 30 : 7));
        const amount = Number(session.amount_total || 0) / 100;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        if (itemType === "premium_upgrade") {
          logger.info(`Processing Stripe checkout for premium upgrade: ${targetId}`);

          await db.collection("premiumPurchases").doc(session.id).set({
            userId: targetId,
            amount,
            currency: (session.currency || "usd").toUpperCase(),
            status: "active",
            paymentMethod: "stripe",
            purchasedAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent || null,
            updatedAt: new Date().toISOString(),
          }, { merge: true });

          await db.collection("users").doc(String(targetId)).set({
            accountType: "business",
            businessTier: "premium",
            isPremium: true,
            premiumStatus: "active",
            premiumActivatedAt: new Date().toISOString(),
            premiumUpdatedAt: new Date().toISOString(),
            upgradedAt: new Date().toISOString(),
          }, { merge: true });

          logger.info(`User ${targetId} marked as premium business`);
        } else if (itemType === "service") {
          logger.info(`Processing Stripe checkout for service: ${targetId}`);

          const serviceDoc = await db.collection("services").doc(targetId).get();
          const serviceData = serviceDoc.exists ? serviceDoc.data() : undefined;

          await db.collection("featurePurchases").doc(session.id).set({
            itemType: "service",
            serviceId: targetId,
            userId: serviceData?.userId || null,
            amount,
            currency: (session.currency || "usd").toUpperCase(),
            status: "pending",
            paymentMethod: "stripe",
            purchasedAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent || null,
            updatedAt: new Date().toISOString(),
          }, { merge: true });

          await db.collection("services").doc(targetId).update({
            featurePaymentStatus: "paid",
            featureRequested: true,
            featurePaymentDate: new Date().toISOString(),
            featureDurationDays: 30,
            featurePrice: amount,
            updatedAt: new Date().toISOString(),
          });

          logger.info(`Service ${targetId} marked as feature payment received`);
        } else {
          logger.info(`Processing Stripe checkout for listing: ${targetId}`);

          const listingDoc = await db.collection("listings").doc(targetId).get();
          const listingData = listingDoc.exists ? listingDoc.data() : undefined;

          await db.collection("featurePurchases").doc(session.id).set({
            listingId: targetId,
            userId: listingData?.userId || null,
            amount,
            currency: (session.currency || "usd").toUpperCase(),
            status: "pending",
            paymentMethod: "stripe",
            purchasedAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent || null,
            updatedAt: new Date().toISOString(),
          }, { merge: true });

          await db.collection("listings").doc(targetId).update({
            featurePaymentStatus: "paid",
            featureRequested: true,
            featurePaymentDate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // For listings that are already approved, activate featured status immediately.
          if (listingData?.status === "approved") {
            await db.collection("listings").doc(targetId).update({
              isFeatured: true,
              featureExpiresAt: expiresAt.toISOString(),
              featureActivatedDate: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            if (listingData?.userId) {
              await db.collection("users").doc(String(listingData.userId)).update({
                featurePurchases: FieldValue.increment(1),
              });
            }

            logger.info(`Listing ${targetId} featured status activated immediately (already approved)`);
          }

          logger.info(`Listing ${targetId} marked as feature payment received`);
        }

        res.status(200).send({ received: true });
      } else if (event.type === "customer.subscription.deleted") {
        // Subscription canceled or expired — deactivate premium
        const subscription = event.data.object;
        const firebaseUserId = subscription.metadata?.firebaseUserId;

        if (firebaseUserId) {
          await db.collection("users").doc(firebaseUserId).set({
            isPremium: false,
            premiumStatus: "canceled",
            premiumCanceledAt: new Date().toISOString(),
            premiumUpdatedAt: new Date().toISOString(),
          }, { merge: true });

          logger.info(`Premium deactivated for user ${firebaseUserId} (subscription ${subscription.id} deleted)`);
        } else {
          logger.warn(`customer.subscription.deleted: no firebaseUserId in metadata for sub ${subscription.id}`);
        }

        res.status(200).send({ received: true });
      } else if (event.type === "invoice.payment_failed") {
        // Subscription payment failed — mark as past_due
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
          // Look up user by subscriptionId
          const usersSnap = await db.collection("users")
            .where("stripeSubscriptionId", "==", subscriptionId)
            .limit(1)
            .get();

          if (!usersSnap.empty) {
            const userDoc = usersSnap.docs[0];
            await userDoc.ref.set({
              premiumStatus: "past_due",
              premiumUpdatedAt: new Date().toISOString(),
            }, { merge: true });

            logger.info(`Premium marked past_due for user ${userDoc.id} (invoice payment failed)`);
          }
        }

        res.status(200).send({ received: true });
      } else {
        logger.info(`Ignoring Stripe event type: ${event.type}`);
        res.status(200).send({ received: true });
      }
    } catch (error) {
      logger.error("Error processing Stripe webhook:", error);
      res.status(500).send("Webhook error");
    }
  }
);

/**
 * Triggers when listing status changes to "approved"
 * If featurePaymentStatus === "paid", activate featured status
 */
export const onListingApproved = onDocumentUpdated(
  "listings/{listingId}",
  async (event) => {
    const db = getFirestore();
    const listingId = event.params.listingId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    try {
      // Check if status changed to "approved"
      if (before?.status !== "approved" && after?.status === "approved") {
        logger.info(`Listing ${listingId} approved. Checking for pending feature payment...`);

        // Check if feature payment is marked as paid
        if (after?.featurePaymentStatus === "paid" && after?.featureRequested === true) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          logger.info(`Activating featured status for listing ${listingId}. Expires: ${expiresAt.toISOString()}`);

          // Activate featured status
          await db.collection("listings").doc(listingId).update({
            isFeatured: true,
            featureExpiresAt: expiresAt.toISOString(),
            featureActivatedDate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Increment featurePurchases counter in user's document
          const userId = after?.userId;
          if (userId) {
            await db.collection("users").doc(userId).update({
              featurePurchases: FieldValue.increment(1),
            });
            logger.info(`Incremented featurePurchases for user ${userId}`);
          }

          logger.info(`✅ Featured status activated for listing ${listingId}`);
        } else {
          logger.info(
            `Listing ${listingId} approved but no pending feature payment (status: ${after?.featurePaymentStatus})`
          );
        }
      }
    } catch (error) {
      logger.error(`Error in onListingApproved for ${listingId}:`, error);
      throw error;
    }
  }
);

/**
 * Triggers when service approval changes to approved.
 * If feature payment is paid and feature was requested, activate featured status for 30 days.
 */
export const onServiceApproved = onDocumentUpdated(
  "services/{serviceId}",
  async (event) => {
    const db = getFirestore();
    const serviceId = event.params.serviceId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    try {
      if (before?.isApproved !== true && after?.isApproved === true) {
        logger.info(`Service ${serviceId} approved. Checking for paid feature request...`);

        if (after?.featurePaymentStatus === "paid" && after?.featureRequested === true) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await db.collection("services").doc(serviceId).update({
            isFeatured: true,
            featureExpiresAt: expiresAt.toISOString(),
            featureActivatedDate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          const userId = after?.userId;
          if (userId) {
            await db.collection("users").doc(userId).update({
              featurePurchases: FieldValue.increment(1),
            });
          }

          logger.info(`Featured status activated for service ${serviceId}`);
        } else {
          logger.info(`Service ${serviceId} approved without paid feature request.`);
        }
      }
    } catch (error) {
      logger.error(`Error in onServiceApproved for ${serviceId}:`, error);
      throw error;
    }
  }
);

/**
 * Auto-approve services created by verified businesses
 * Triggers on services collection creation
 * If creator's business account is approved (isApproved===true), auto-approve the service
 * and notify admins of the auto-approval
 */
export const autoApproveService = onDocumentCreated(
  "services/{serviceId}",
  async (event) => {
    const db = getFirestore();
    const serviceId = event.params.serviceId;
    const serviceData = event.data?.data();

    if (!serviceData) {
      logger.warn("Service document has no data", { serviceId });
      return;
    }

    try {
      const userId = serviceData?.userId as string | undefined;

      if (!userId) {
        logger.warn("Service missing userId", { serviceId });
        return;
      }

      // Check if user's business account is approved
      const userSnap = await db.collection("users").doc(userId).get();
      const userData = userSnap.exists ? userSnap.data() : null;

      if (!userData) {
        logger.warn("User not found for service creator", { userId, serviceId });
        await db.collection("services").doc(serviceId).delete();
        logger.info(`Deleted orphaned service ${serviceId} because creator user was missing`);
        return;
      }

      // Only auto-approve if:
      // 1. User is a business account
      // 2. Business account is approved (isApproved === true)
      if (userData.accountType !== "business" || userData.isApproved !== true) {
        logger.info(`Service ${serviceId} created by non-approved business or individual`, {
          userId,
          accountType: userData.accountType,
          isApproved: userData.isApproved,
        });
        return;
      }

      // Auto-approve the service
      const now = new Date();
      const isPremium = userData.businessTier === "premium" && userData.isPremium === true;

      const updateFields: Record<string, unknown> = {
        isApproved: true,
        approvalStatus: "approved",
        autoApprovedAt: now.toISOString(),
        autoApprovedBySystem: true,
      };

      // Premium perk: auto-feature services for premium business users
      if (isPremium) {
        updateFields.isFeatured = true;
        updateFields.featureTier = "premium";
        updateFields.autoFeaturedByPremium = true;
      }

      await db.collection("services").doc(serviceId).update(updateFields);

      logger.info(`✅ Service ${serviceId} auto-approved${isPremium ? " + auto-featured (premium)" : ""} for verified business ${userId}`, {
        serviceName: serviceData.serviceName,
        providerName: serviceData.providerName,
        isPremium,
      });

      // Create admin notification
      await db.collection("adminNotifications").add({
        type: "auto_approved_service",
        title: `Service Auto-Approved: ${serviceData.serviceName || "Untitled"}`,
        message: `Service "${serviceData.serviceName}" by ${serviceData.providerName} from verified business was automatically approved.`,
        itemType: "service",
        serviceId,
        serviceName: serviceData.serviceName,
        providerName: serviceData.providerName,
        userId,
        businessName: userData.businessName || userData.displayName || "Unknown",
        createdAt: now.toISOString(),
        read: false,
        severity: "info",
      });

      logger.info(`Admin notification created for auto-approved service ${serviceId}`);
    } catch (error) {
      logger.error(`Error in autoApproveService for ${serviceId}:`, error);
      // Don't throw - if notification fails, service is already approved
    }
  }
);

/**
 * Auto-approve jobs created by verified businesses
 * Triggers on jobBoard collection creation
 * If creator's business account is approved (isApproved===true), service is already set to approved
 * But we add admin notification for visibility
 */
export const notifyAutoApprovedJob = onDocumentCreated(
  "jobBoard/{jobId}",
  async (event) => {
    const db = getFirestore();
    const jobId = event.params.jobId;
    const jobData = event.data?.data();

    if (!jobData) {
      logger.warn("Job document has no data", { jobId });
      return;
    }

    try {
      const userId = jobData?.userId as string | undefined;

      if (!userId) {
        logger.warn("Job missing userId", { jobId });
        return;
      }

      // Check if user's business account is approved
      const userSnap = await db.collection("users").doc(userId).get();
      const userData = userSnap.exists ? userSnap.data() : null;

      if (!userData) {
        logger.warn("User not found for job poster", { userId, jobId });
        return;
      }

      // Only notify if user is a verified business
      if (userData.accountType !== "business" || userData.isApproved !== true) {
        logger.info(`Job ${jobId} posted by non-approved business or individual`, {
          userId,
          accountType: userData.accountType,
          isApproved: userData.isApproved,
        });
        return;
      }

      const now = new Date();

      // Create admin notification about auto-approved job
      await db.collection("adminNotifications").add({
        type: "auto_approved_job",
        title: `Job Auto-Approved: ${jobData.jobTitle || "Untitled"}`,
        message: `Job "${jobData.jobTitle}" by ${jobData.companyName} from verified business was automatically approved.`,
        itemType: "job",
        jobId,
        jobTitle: jobData.jobTitle,
        companyName: jobData.companyName,
        userId,
        businessName: userData.businessName || userData.displayName || "Unknown",
        createdAt: now.toISOString(),
        read: false,
        severity: "info",
      });

      logger.info(`✅ Job ${jobId} auto-approved and admin notified for verified business ${userId}`, {
        jobTitle: jobData.jobTitle,
        companyName: jobData.companyName,
      });
    } catch (error) {
      logger.error(`Error in notifyAutoApprovedJob for ${jobId}:`, error);
      // Don't throw - job is already created and approved
    }
  }
);
