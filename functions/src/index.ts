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
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import OpenAI from "openai";
import Stripe from "stripe";

// Email triggers (Resend)
export { onFeaturePurchaseCreated, onListingRejected, onMessageCreated, onPremiumPurchaseCreated, onPublicMessageCreated, onUserCreated, onUserDisabled } from "./emailTriggers.js";
export { listingsApi } from "./listingsApi.js";

const openaiKey = defineSecret("OPENAI_API_KEY");
const callableCorsOrigins = [
  /^https:\/\/([a-z0-9-]+\.)?locallist\.biz$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
];
const BUSINESS_AI_USAGE_COLLECTION = "businessAiUsage";
const BUSINESS_AI_USAGE_TIME_ZONE = "America/Chicago";
const BUSINESS_AI_DESCRIPTION_MONTHLY_LIMIT = 5;
const BUSINESS_AI_IMAGE_MONTHLY_LIMIT = 5;

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

export const getBusinessAiUsageSummary = onCall(
  { cors: callableCorsOrigins },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Sign in to use the AI Business Assistant.");
    }

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : undefined;
    const normalizedUserData = userData as Record<string, unknown> | undefined;

    await assertBusinessAiAssistantAccess(db, userId, normalizedUserData);

    return {
      success: true,
      usage: await getBusinessAiUsageSummaryForUser(db, userId),
    };
  },
);

export const generateSellerListingDraft = onCall(
  { secrets: ["OPENAI_API_KEY"], cors: callableCorsOrigins },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Sign in to use the AI Listing Assistant.");
    }

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : undefined;
    const normalizedUserData = userData as Record<string, unknown> | undefined;

    if (!isAdminUser(normalizedUserData) && !hasSellerHubAccess(normalizedUserData)) {
      throw new HttpsError(
        "permission-denied",
        "Admin access or an active paid seller plan is required to use the AI Listing Assistant.",
      );
    }

    const productName = normalizeSingleLine(request.data?.productName);
    const details = normalizeSingleLine(request.data?.details);
    const category = normalizeSingleLine(request.data?.category);
    const condition = normalizeSingleLine(request.data?.condition);
    const priceContext = normalizeSingleLine(request.data?.priceContext);
    const referenceImage = normalizeReferenceImageSource(
      request.data?.referenceImageUrl,
      request.data?.referenceImage,
    );

    if (!productName) {
      throw new HttpsError("invalid-argument", "productName is required.");
    }

    if (productName.length > 120) {
      throw new HttpsError("invalid-argument", "productName must be 120 characters or fewer.");
    }

    if (details.length > 4000) {
      throw new HttpsError("invalid-argument", "details must be 4000 characters or fewer.");
    }

    const apiKey = openaiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "OPENAI_API_KEY is not configured.");
    }

    const openai = new OpenAI({ apiKey });

    const promptParts = [
      `Product name: ${productName}`,
      category ? `Category: ${category}` : "",
      condition ? `Condition: ${condition}` : "",
      priceContext ? `Price context: ${priceContext}` : "",
      details ? `Optional details: ${details}` : "Optional details:",
      referenceImage ? "Reference image: included" : "Reference image: not provided",
    ].filter(Boolean);

    try {
      const userContent: Array<Record<string, unknown>> = [
        {
          type: "text",
          text: [
            ...promptParts,
            "",
            "Generate a marketplace listing draft with these rules:",
            "- title: 40 characters max",
            "- description: 2 to 3 sentences",
            "- bullets: exactly 3 items",
            "- each bullet: under 15 words",
            "- use a casual, friendly seller voice",
            "- sound natural and local, not corporate or polished",
            "- keep it easy to scan and realistic",
            "- avoid sounding stiff, overly formal, or salesy",
            "- no markdown or extra commentary",
            "- if a reference image is included, use it quietly to improve the title, description, and bullets",
            "- do not claim uncertain visual guesses as facts",
          ].join("\n"),
        },
      ];

      if (referenceImage) {
        userContent.push({
          type: "image_url",
          image_url: {
            url: referenceImage.imageUrl,
            detail: "low",
          },
        });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.6,
        max_completion_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              "You write casual, natural marketplace listings for local sellers. Return only JSON that matches the requested schema.",
          },
          {
            role: "user",
            content: userContent as any,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "seller_listing_draft",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                bullets: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: { type: "string" },
                },
              },
              required: ["title", "description", "bullets"],
            },
          },
        } as any,
      });

      logger.info("AI listing usage", {
        userId,
        model: "gpt-4o-mini",
        inputTokens: response.usage?.prompt_tokens ?? null,
        outputTokens: response.usage?.completion_tokens ?? null,
        totalTokens: response.usage?.total_tokens ?? null,
        hasReferenceImage: Boolean(referenceImage),
        hasPriceContext: Boolean(priceContext),
        hasCategory: Boolean(category),
        hasCondition: Boolean(condition),
        hasDetails: Boolean(details),
        productNameLength: productName.length,
        priceContextLength: priceContext.length,
        detailsLength: details.length,
      });

      const rawContent = response.choices[0]?.message?.content;

      if (!rawContent) {
        throw new Error("OpenAI returned an empty response.");
      }

      const parsed = JSON.parse(rawContent);
      const listing = normalizeGeneratedListingOutput(productName, details, parsed);

      return {
        success: true,
        listing,
      };
    } catch (error) {
      logger.error("AI listing draft generation failed", {
        userId,
        productName,
        hasReferenceImage: Boolean(referenceImage),
        error,
      });
      throw new HttpsError("internal", "Failed to generate listing draft.");
    }
  },
);

export const generateBusinessDescriptionDraft = onCall(
  { secrets: ["OPENAI_API_KEY"], cors: callableCorsOrigins },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Sign in to use the AI Business Assistant.");
    }

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : undefined;
    const normalizedUserData = userData as Record<string, unknown> | undefined;
    await assertBusinessAiAssistantAccess(db, userId, normalizedUserData);

    const businessName = normalizeSingleLine(request.data?.businessName);
    const businessType = normalizeValue(request.data?.businessType);
    const details = normalizeSingleLine(request.data?.details);

    if (!businessName) {
      throw new HttpsError("invalid-argument", "businessName is required.");
    }

    if (businessName.length > 120) {
      throw new HttpsError("invalid-argument", "businessName must be 120 characters or fewer.");
    }

    if (!["shoplocal", "services", "both"].includes(businessType)) {
      throw new HttpsError("invalid-argument", "businessType must be shopLocal, services, or both.");
    }

    if (details.length > 1200) {
      throw new HttpsError("invalid-argument", "details must be 1200 characters or fewer.");
    }

    const apiKey = openaiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "OPENAI_API_KEY is not configured.");
    }

    const businessTypeLabels: Record<string, string> = {
      shoplocal: "Business Local Only - Retail and physical products",
      services: "Services Only - Professional services",
      both: "Both - Business Local and Services",
    };

    const openai = new OpenAI({ apiKey });
    let usageSummary: BusinessAiUsageSummary | null = null;

    try {
      usageSummary = await reserveBusinessAiUsage(db, userId, "description");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_completion_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "You write strong, natural business profile descriptions for local businesses. Return only JSON that matches the requested schema.",
          },
          {
            role: "user",
            content: [
              `Business name: ${businessName}`,
              `Business type: ${businessTypeLabels[businessType] || businessType}`,
              details ? `Optional details: ${details}` : "Optional details:",
              "",
              "Generate a business description with these rules:",
              "- description: 3 to 4 sentences",
              "- keep it clear, confident, and customer-friendly",
              "- sound local, credible, and welcoming",
              "- make it strong without sounding stiff, corporate, or overhyped",
              "- explain what the business offers and why someone should trust it",
              "- do not use markdown, bullet points, emojis, or extra commentary",
            ].join("\n"),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "business_description_draft",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                description: { type: "string" },
              },
              required: ["description"],
            },
          },
        } as any,
      });

      logger.info("AI business description usage", {
        userId,
        model: "gpt-4o-mini",
        inputTokens: response.usage?.prompt_tokens ?? null,
        outputTokens: response.usage?.completion_tokens ?? null,
        totalTokens: response.usage?.total_tokens ?? null,
        businessType,
        hasDetails: Boolean(details),
        businessNameLength: businessName.length,
        detailsLength: details.length,
      });

      const rawContent = response.choices[0]?.message?.content;

      if (!rawContent) {
        throw new Error("OpenAI returned an empty response.");
      }

      const parsed = JSON.parse(rawContent);
      const draft = normalizeGeneratedBusinessDescriptionOutput(businessName, parsed);

      return {
        success: true,
        draft,
        usage: usageSummary,
      };
    } catch (error) {
      if (usageSummary) {
        await rollbackReservedBusinessAiUsage(db, userId, "description", usageSummary.monthKey);
      }

      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("AI business description generation failed", {
        userId,
        businessName,
        businessType,
        error,
      });
      throw new HttpsError("internal", "Failed to generate business description.");
    }
  },
);

export const generateBusinessBrandImage = onCall(
  { secrets: ["OPENAI_API_KEY"], cors: callableCorsOrigins },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Sign in to use the AI Business Assistant.");
    }

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : undefined;
    const normalizedUserData = userData as Record<string, unknown> | undefined;
    await assertBusinessAiAssistantAccess(db, userId, normalizedUserData);

    const businessName = normalizeSingleLine(request.data?.businessName);
    const businessCategory = normalizeSingleLine(request.data?.businessCategory);
    const shortDescription = normalizeSingleLine(request.data?.shortDescription);
    const imageStyle = normalizeSingleLine(request.data?.imageStyle).toLowerCase();
    const imageColor = normalizeSingleLine(request.data?.imageColor).toLowerCase();
    const noText = request.data?.noText === true;
    const imageKind = normalizeValue(request.data?.imageKind);

    if (!businessName) {
      throw new HttpsError("invalid-argument", "businessName is required.");
    }

    if (businessName.length > 120) {
      throw new HttpsError("invalid-argument", "businessName must be 120 characters or fewer.");
    }

    if (!businessCategory) {
      throw new HttpsError("invalid-argument", "businessCategory is required.");
    }

    if (businessCategory.length > 80) {
      throw new HttpsError("invalid-argument", "businessCategory must be 80 characters or fewer.");
    }

    if (shortDescription.length > 600) {
      throw new HttpsError("invalid-argument", "shortDescription is too long.");
    }

    if (countWords(shortDescription) > 99) {
      throw new HttpsError("invalid-argument", "shortDescription must be under 100 words.");
    }

    if (!["clean modern", "bold professional", "warm handmade", "dark premium"].includes(imageStyle)) {
      throw new HttpsError("invalid-argument", "imageStyle is not supported.");
    }

    if (!["gold and black", "blue and white", "green and natural", "orange and black"].includes(imageColor)) {
      throw new HttpsError("invalid-argument", "imageColor is not supported.");
    }

    if (!["logo", "cover"].includes(imageKind)) {
      throw new HttpsError("invalid-argument", "imageKind must be logo or cover.");
    }

    const apiKey = openaiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "OPENAI_API_KEY is not configured.");
    }

    const imageKindLabel = imageKind === "logo" ? "logo concept" : "cover photo concept";
    const prompt = [
      `Create a polished ${imageKindLabel} for a local business brand.`,
      `Business name: ${businessName}`,
      `Business category: ${businessCategory}`,
      shortDescription ? `Short description: ${shortDescription}` : "",
      `Style direction: ${imageStyle}`,
      `Color theme: ${imageColor}`,
      "",
      "Art direction rules:",
      imageKind === "logo"
        ? "- Build a clean, simple, memorable brand mark that feels usable as a logo."
        : "- Build a wide hero-style cover image that feels usable as a website or social cover photo.",
      "- Keep the composition professional, intentional, and uncluttered.",
      "- Use the requested color theme clearly.",
      "- Match the requested style without adding extra themes.",
      "- Do not include watermarks, mockup frames, or fake UI.",
      noText
        ? "- Do not include any readable text, words, letters, initials, monograms, brand names, or typography anywhere in the image."
        : "- Avoid paragraphs, taglines, or dense readable text inside the image.",
      "- Make the result feel relevant to the business type.",
      imageKind === "logo"
        ? "- Favor a transparent or minimal background and a centered composition."
        : "- Favor a strong landscape composition with breathing room and a premium brand feel.",
    ].join("\n");

    const openai = new OpenAI({ apiKey });
    let usageSummary: BusinessAiUsageSummary | null = null;

    try {
      usageSummary = await reserveBusinessAiUsage(db, userId, "image");

      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: imageKind === "logo" ? "1024x1024" : "1536x1024",
        quality: "medium",
        background: imageKind === "logo" ? "transparent" : "opaque",
        output_format: "png",
      });

      const imageBase64 = response.data?.[0]?.b64_json;

      if (!imageBase64) {
        throw new Error("OpenAI returned an empty image.");
      }

      logger.info("AI business image usage", {
        userId,
        model: "gpt-image-1",
        businessCategory,
        imageKind,
        imageStyle,
        imageColor,
        noText,
        businessNameLength: businessName.length,
        shortDescriptionLength: shortDescription.length,
      });

      return {
        success: true,
        image: {
          kind: imageKind,
          businessName,
          businessCategory,
          shortDescription,
          imageStyle,
          imageColor,
          noText,
          mimeType: "image/png",
          imageDataUrl: `data:image/png;base64,${imageBase64}`,
          altText: `${imageKindLabel} for ${businessName}`,
        },
        usage: usageSummary,
      };
    } catch (error) {
      if (usageSummary) {
        await rollbackReservedBusinessAiUsage(db, userId, "image", usageSummary.monthKey);
      }

      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("AI business image generation failed", {
        userId,
        businessName,
        businessCategory,
        imageKind,
        imageStyle,
        imageColor,
        noText,
        error,
      });
      throw new HttpsError("internal", "Failed to generate business image.");
    }
  },
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

type ResolvedPlanCode = "free" | "seller_pro" | "business_premium";
type ResolvedPlanStatus = "active" | "pending" | "trial" | "past_due" | "canceled" | "expired";
type BusinessAiUsageKind = "description" | "image";
type BusinessAiUsageSummary = {
  monthKey: string;
  monthLabel: string;
  descriptionCount: number;
  descriptionLimit: number;
  descriptionRemaining: number;
  imageCount: number;
  imageLimit: number;
  imageRemaining: number;
};

function normalizeValue(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizePlanStatus(value: unknown): ResolvedPlanStatus | null {
  const normalized = normalizeValue(value);

  switch (normalized) {
    case "active":
    case "pending":
    case "trial":
    case "past_due":
    case "canceled":
    case "cancelled":
    case "expired":
      return normalized === "cancelled" ? "canceled" : normalized;
    default:
      return null;
  }
}

function resolveUserPlanCode(userData: Record<string, unknown> | undefined): ResolvedPlanCode {
  const explicitCode = normalizeValue(userData?.planCode);

  if (explicitCode === "seller_pro" || explicitCode === "business_premium" || explicitCode === "free") {
    return explicitCode;
  }

  if (normalizeValue(userData?.sellerTier) === "pro") {
    return "seller_pro";
  }

  const accountType = normalizeValue(userData?.accountType);
  const businessTier = normalizeValue(userData?.businessTier);
  const subscriptionPlan = normalizeValue(userData?.subscriptionPlan);
  const premiumStatus = normalizePlanStatus(userData?.premiumStatus);

  if (
    accountType === "business" &&
    (
      businessTier === "premium" ||
      subscriptionPlan === "premium" ||
      subscriptionPlan === "business_premium" ||
      userData?.isPremium === true ||
      premiumStatus === "active" ||
      premiumStatus === "trial" ||
      premiumStatus === "past_due"
    )
  ) {
    return "business_premium";
  }

  if (subscriptionPlan === "seller_pro") {
    return "seller_pro";
  }

  return "free";
}

function resolveUserPlanStatus(userData: Record<string, unknown> | undefined): ResolvedPlanStatus {
  return (
    normalizePlanStatus(userData?.planStatus) ||
    normalizePlanStatus(userData?.sellerStatus) ||
    normalizePlanStatus(userData?.premiumStatus) ||
    normalizePlanStatus(userData?.subscriptionStatus) ||
    "active"
  );
}

function hasActiveBusinessPremium(userData: Record<string, unknown> | undefined): boolean {
  return resolveUserPlanCode(userData) === "business_premium" &&
    ["active", "trial"].includes(resolveUserPlanStatus(userData));
}

function hasServiceProviderProfileSignal(userData: Record<string, unknown> | undefined): boolean {
  return userData?.hasServiceListing === true ||
    userData?.hasServices === true ||
    normalizeValue(userData?.providerType) === "service" ||
    normalizeValue(userData?.primaryProfileType) === "service" ||
    normalizeValue(userData?.listingType) === "services" ||
    Boolean(normalizeValue(userData?.primaryServiceCategory));
}

function hasPremiumServiceProviderAccess(userData: Record<string, unknown> | undefined): boolean {
  return hasSellerHubAccess(userData) && hasServiceProviderProfileSignal(userData);
}

function hasPremiumProfileHubAccess(userData: Record<string, unknown> | undefined): boolean {
  return isAdminUser(userData) || hasActiveBusinessPremium(userData) || hasPremiumServiceProviderAccess(userData);
}

function hasSellerHubAccess(userData: Record<string, unknown> | undefined): boolean {
  const planCode = resolveUserPlanCode(userData);
  const planStatus = resolveUserPlanStatus(userData);
  return planCode !== "free" && (planStatus === "active" || planStatus === "trial");
}

function isAdminUser(userData: Record<string, unknown> | undefined): boolean {
  return normalizeValue(userData?.role) === "admin";
}

function normalizeSingleLine(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(value: string): number {
  return normalizeSingleLine(value)
    .split(" ")
    .filter(Boolean)
    .length;
}

async function detectServiceProviderProfile(
  db: FirebaseFirestore.Firestore,
  userId: string,
  userData: Record<string, unknown> | undefined,
): Promise<boolean> {
  if (hasServiceProviderProfileSignal(userData)) {
    return true;
  }

  try {
    const servicesSnap = await db.collection("services").where("userId", "==", userId).limit(1).get();
    return !servicesSnap.empty;
  } catch (error) {
    logger.warn("Failed to detect service provider profile", {
      userId,
      error,
    });
    return false;
  }
}

async function assertBusinessAiAssistantAccess(
  db: FirebaseFirestore.Firestore,
  userId: string,
  userData: Record<string, unknown> | undefined,
): Promise<void> {
  if (isAdminUser(userData) || hasActiveBusinessPremium(userData)) {
    return;
  }

  if (hasSellerHubAccess(userData) && await detectServiceProviderProfile(db, userId, userData)) {
    return;
  }

  if (!hasPremiumProfileHubAccess(userData)) {
    throw new HttpsError(
      "permission-denied",
      "An active premium business or premium service-provider plan is required to use the AI Business Assistant.",
    );
  }
}

function getBusinessAiUsagePeriod(date: Date = new Date()): { monthKey: string; monthLabel: string } {
  const keyParts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_AI_USAGE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = keyParts.find((part) => part.type === "year")?.value || "0000";
  const month = keyParts.find((part) => part.type === "month")?.value || "01";

  return {
    monthKey: `${year}-${month}`,
    monthLabel: new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_AI_USAGE_TIME_ZONE,
      month: "long",
      year: "numeric",
    }).format(date),
  };
}

function normalizeUsageCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function buildBusinessAiUsageSummary(
  monthKey: string,
  monthLabel: string,
  descriptionCount: number,
  imageCount: number,
): BusinessAiUsageSummary {
  return {
    monthKey,
    monthLabel,
    descriptionCount,
    descriptionLimit: BUSINESS_AI_DESCRIPTION_MONTHLY_LIMIT,
    descriptionRemaining: Math.max(0, BUSINESS_AI_DESCRIPTION_MONTHLY_LIMIT - descriptionCount),
    imageCount,
    imageLimit: BUSINESS_AI_IMAGE_MONTHLY_LIMIT,
    imageRemaining: Math.max(0, BUSINESS_AI_IMAGE_MONTHLY_LIMIT - imageCount),
  };
}

async function getBusinessAiUsageSummaryForUser(
  db: FirebaseFirestore.Firestore,
  userId: string,
): Promise<BusinessAiUsageSummary> {
  const { monthKey, monthLabel } = getBusinessAiUsagePeriod();
  const usageDoc = await db.collection(BUSINESS_AI_USAGE_COLLECTION).doc(`${userId}_${monthKey}`).get();
  const usageData = usageDoc.exists ? (usageDoc.data() || {}) : {};

  return buildBusinessAiUsageSummary(
    monthKey,
    monthLabel,
    normalizeUsageCount(usageData.descriptionCount),
    normalizeUsageCount(usageData.imageCount),
  );
}

async function reserveBusinessAiUsage(
  db: FirebaseFirestore.Firestore,
  userId: string,
  kind: BusinessAiUsageKind,
): Promise<BusinessAiUsageSummary> {
  const { monthKey, monthLabel } = getBusinessAiUsagePeriod();
  const usageRef = db.collection(BUSINESS_AI_USAGE_COLLECTION).doc(`${userId}_${monthKey}`);

  return db.runTransaction(async (transaction) => {
    const usageSnap = await transaction.get(usageRef);
    const usageData = usageSnap.exists ? (usageSnap.data() || {}) : {};
    const descriptionCount = normalizeUsageCount(usageData.descriptionCount);
    const imageCount = normalizeUsageCount(usageData.imageCount);

    if (kind === "description" && descriptionCount >= BUSINESS_AI_DESCRIPTION_MONTHLY_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        `You've reached your ${BUSINESS_AI_DESCRIPTION_MONTHLY_LIMIT} business profile generations for ${monthLabel}.`,
      );
    }

    if (kind === "image" && imageCount >= BUSINESS_AI_IMAGE_MONTHLY_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        `You've reached your ${BUSINESS_AI_IMAGE_MONTHLY_LIMIT} business image generations for ${monthLabel}.`,
      );
    }

    const nextDescriptionCount = kind === "description" ? descriptionCount + 1 : descriptionCount;
    const nextImageCount = kind === "image" ? imageCount + 1 : imageCount;
    const nextData: Record<string, unknown> = {
      uid: userId,
      monthKey,
      descriptionCount: nextDescriptionCount,
      imageCount: nextImageCount,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!usageSnap.exists) {
      nextData.createdAt = FieldValue.serverTimestamp();
    }

    transaction.set(usageRef, nextData, { merge: true });

    return buildBusinessAiUsageSummary(monthKey, monthLabel, nextDescriptionCount, nextImageCount);
  });
}

async function rollbackReservedBusinessAiUsage(
  db: FirebaseFirestore.Firestore,
  userId: string,
  kind: BusinessAiUsageKind,
  monthKey: string,
): Promise<void> {
  const usageRef = db.collection(BUSINESS_AI_USAGE_COLLECTION).doc(`${userId}_${monthKey}`);

  try {
    await db.runTransaction(async (transaction) => {
      const usageSnap = await transaction.get(usageRef);
      if (!usageSnap.exists) {
        return;
      }

      const usageData = usageSnap.data() || {};
      const descriptionCount = normalizeUsageCount(usageData.descriptionCount);
      const imageCount = normalizeUsageCount(usageData.imageCount);

      transaction.set(usageRef, {
        descriptionCount: kind === "description" ? Math.max(0, descriptionCount - 1) : descriptionCount,
        imageCount: kind === "image" ? Math.max(0, imageCount - 1) : imageCount,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  } catch (rollbackError) {
    logger.error("Failed to roll back reserved AI usage", {
      userId,
      kind,
      monthKey,
      rollbackError,
    });
  }
}

function truncateByWords(value: string, maxWords: number): string {
  const words = normalizeSingleLine(value).split(" ").filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return words.slice(0, maxWords).join(" ");
}

function truncateByChars(value: string, maxChars: number): string {
  const normalized = normalizeSingleLine(value);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
}

function buildFallbackBullets(productName: string, details: string): string[] {
  const detailText = normalizeSingleLine(details);
  const fallback = [
    `Clear local listing for ${productName}`,
    detailText ? truncateByWords(detailText, 14) : `Highlights key condition and value fast`,
    `Helps buyers understand the item quickly`,
  ];

  return fallback.map((bullet) => truncateByWords(bullet, 14));
}

function normalizeGeneratedListingOutput(
  productName: string,
  details: string,
  payload: unknown,
): { title: string; bullets: string[]; description: string } {
  const data = (payload && typeof payload === "object") ? payload as Record<string, unknown> : {};
  const safeProductName = truncateByChars(productName || "Local marketplace listing", 60);

  const title = truncateByChars(
    normalizeSingleLine(data.title) || safeProductName,
    60,
  );

  const bulletItems = Array.isArray(data.bullets) ? data.bullets : [];
  const bullets = bulletItems
    .map((bullet) => truncateByWords(String(bullet || ""), 14))
    .filter(Boolean)
    .slice(0, 3);

  while (bullets.length < 3) {
    bullets.push(buildFallbackBullets(productName, details)[bullets.length]);
  }

  const description = normalizeSingleLine(data.description) ||
    `${safeProductName} with a cleaner title and clearer buyer-facing details for your listing. Review and tweak the wording before posting it live.`;

  return {
    title,
    bullets,
    description,
  };
}

function normalizeGeneratedBusinessDescriptionOutput(
  businessName: string,
  payload: unknown,
): { description: string } {
  const data = (payload && typeof payload === "object") ? payload as Record<string, unknown> : {};
  const safeBusinessName = truncateByChars(businessName || "Local business", 80);
  const description = truncateByWords(
    normalizeSingleLine(data.description) ||
      `${safeBusinessName} is a local business focused on serving customers with dependable service and a clear sense of what it offers.`,
    95,
  );

  return {
    description,
  };
}

function normalizeReferenceImageSource(
  urlValue: unknown,
  legacyValue: unknown,
): { imageUrl: string; source: "url" | "data_url" } | null {
  const referenceImageUrl = String(urlValue || "").trim();

  if (referenceImageUrl) {
    if (!/^https:\/\/.+/i.test(referenceImageUrl)) {
      throw new HttpsError("invalid-argument", "referenceImageUrl must be a valid https URL.");
    }

    if (referenceImageUrl.length > 4096) {
      throw new HttpsError("invalid-argument", "referenceImageUrl is too long.");
    }

    return {
      imageUrl: referenceImageUrl,
      source: "url",
    };
  }

  if (!legacyValue || typeof legacyValue !== "object") {
    return null;
  }

  const imageData = legacyValue as Record<string, unknown>;
  const dataUrl = String(imageData.dataUrl || "").trim();
  const mimeType = normalizeSingleLine(imageData.mimeType || "image/jpeg").toLowerCase();

  if (!dataUrl) {
    return null;
  }

  if (!/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(dataUrl)) {
    throw new HttpsError("invalid-argument", "referenceImage must be a valid image data URL.");
  }

  if (!["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"].includes(mimeType)) {
    throw new HttpsError("invalid-argument", "referenceImage type is not supported.");
  }

  if (dataUrl.length > 4_800_000) {
    throw new HttpsError("invalid-argument", "referenceImage is too large.");
  }

  return {
    imageUrl: dataUrl,
    source: "data_url",
  };
}

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
    const requestedSuccessPath = typeof request.data?.successPath === "string"
      ? request.data.successPath.trim()
      : "";
    const requestedCancelPath = typeof request.data?.cancelPath === "string"
      ? request.data.cancelPath.trim()
      : "";
    const normalizeWebCheckoutPath = (value: string, fallback: string): string => {
      if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
        return fallback;
      }
      return value;
    };
    const successPath = normalizeWebCheckoutPath(
      requestedSuccessPath,
      "/premium-upgrade.html?checkout=premium",
    );
    const cancelPath = normalizeWebCheckoutPath(
      requestedCancelPath,
      "/premium-upgrade.html?premiumCanceled=1",
    );

    const successUrl = isMobileApp
      ? "myapp://auth-action?checkout=premium"
      : `${baseUrl}${successPath}`;
    const cancelUrl = isMobileApp
      ? "myapp://auth-action?premiumCanceled=1"
      : `${baseUrl}${cancelPath}`;

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
      planCode: "business_premium",
      planStatus: "active",
      businessTier: "premium",
      isPremium: true,
      premiumStatus: "active",
      subscriptionPlan: "premium",
      subscriptionStatus: "active",
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
            planCode: "business_premium",
            planStatus: "active",
            businessTier: "premium",
            isPremium: true,
            premiumStatus: "active",
            subscriptionPlan: "premium",
            subscriptionStatus: "active",
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
            planCode: "free",
            planStatus: "active",
            businessTier: "free",
            isPremium: false,
            premiumStatus: "canceled",
            subscriptionPlan: "free",
            subscriptionStatus: "canceled",
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
              planCode: "business_premium",
              planStatus: "past_due",
              premiumStatus: "past_due",
              subscriptionPlan: "premium",
              subscriptionStatus: "past_due",
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
      const isPremium = hasActiveBusinessPremium(userData as Record<string, unknown> | undefined);

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
