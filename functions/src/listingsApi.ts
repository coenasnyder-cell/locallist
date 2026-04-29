import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

const openaiKey = defineSecret("OPENAI_API_KEY");
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const app = express();
const listingApiCors = cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 3600,
});

app.use(listingApiCors);
app.options("*", listingApiCors);
app.use(express.json({limit: "1mb"}));

type ModerationConfidence = "low" | "medium" | "high";
const REJECTION_REASONS = ["spam", "prohibited", "low_quality", "duplicate", "misleading"] as const;
type RejectionReason = typeof REJECTION_REASONS[number];

type ModerationResult = {
  flagged: boolean;
  reason: string;
  confidence: ModerationConfidence;
  rawResponse: string;
};
type PreModerationPriority = "normal" | "high";
type ModerationSource = "ai" | "pre_moderation";
type PreModerationDecision = {
  sendToAI: boolean;
  autoFlag?: boolean;
  autoApprove?: boolean;
  reason?: string;
  priority?: PreModerationPriority;
  matchedKeywords?: string[];
  matchedKeywordCategory?: string;
};
type StoredModerationResult = ModerationResult & {
  source: ModerationSource;
  priority: PreModerationPriority;
  matchedKeywords?: string[];
  matchedKeywordCategory?: string | null;
};

type ListingStatus = "approved" | "pending_review";
type ReviewedListingStatus = "approved" | "rejected";
type ModerationStats = {
  totalListings: number;
  flaggedCount: number;
  rejectedCount: number;
  approvedCount: number;
  lastFlaggedAt: FieldValue | Timestamp | null;
  lastRejectedAt: FieldValue | Timestamp | null;
};
type ModerationRiskLevel = "low" | "medium" | "high";
type ModerationReviewStatus = "clear" | "watch" | "at_risk" | "disabled_candidate";

type ListingRequestBody = {
  title?: unknown;
  description?: unknown;
  userId?: unknown;
  images?: unknown;
  price?: unknown;
  category?: unknown;
  condition?: unknown;
  zipCode?: unknown;
  city?: unknown;
  pickupLocation?: unknown;
  expiresAt?: unknown;
  viewCount?: unknown;
  isActive?: unknown;
  isFeatured?: unknown;
  featureRequested?: unknown;
  featureDurationDays?: unknown;
  featurePrice?: unknown;
  featurePaymentStatus?: unknown;
  favoritesCount?: unknown;
  allowMessages?: unknown;
  userName?: unknown;
  businessId?: unknown;
  sellerName?: unknown;
  sellerEmail?: unknown;
  sellerBusinessName?: unknown;
  sellerBusinessTier?: unknown;
  sellerAccountType?: unknown;
  flaggedOutOfState?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  resubmittedFromListingId?: unknown;
  listingId?: unknown;
  rejectionReason?: unknown;
  rejectionNotes?: unknown;
  adminNotes?: unknown;
  reason?: unknown;
};

type RequestUser = {
  id?: unknown;
  uid?: unknown;
  userId?: unknown;
};

type ListingRequest = Request<Record<string, never>, unknown, ListingRequestBody> & {
  user?: RequestUser;
};

const FALLBACK_MODERATION: Omit<ModerationResult, "rawResponse"> = {
  flagged: false,
  reason: "",
  confidence: "low",
};
const TRUSTED_USER_SCORE_THRESHOLD = 90;
const TRUSTED_USER_MIN_LISTINGS = 5;
const MAX_EMOJI_COUNT = 6;
const BANNED_KEYWORD_GROUPS = {
  scam: [
    "wire transfer",
    "cash app only",
    "send money first",
    "payment upfront",
    "deposit required before viewing",
    "western union",
    "gift card payment",
  ],
  illegal: [
    "stolen",
    "counterfeit",
    "fake id",
    "cocaine",
    "meth",
    "heroin",
    "weed for sale",
    "gun for sale",
    "ar 15",
    "ghost gun",
    "unregistered firearm",
  ],
  adult: [
    "onlyfans",
    "escort",
    "nude",
    "porn",
    "xxx",
    "adult service",
  ],
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeImages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeExpiresAt(value: unknown): Timestamp | null {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
}

function buildListingDocument(body: ListingRequestBody, userId: string, status: ListingStatus): Record<string, unknown> {
  const expiresAt = normalizeExpiresAt(body.expiresAt);

  return {
    images: normalizeImages(body.images),
    title: normalizeString(body.title),
    description: normalizeString(body.description),
    price: normalizeNumber(body.price),
    category: normalizeOptionalString(body.category),
    condition: normalizeOptionalString(body.condition),
    zipCode: normalizeOptionalString(body.zipCode),
    city: normalizeOptionalString(body.city),
    pickupLocation: normalizeOptionalString(body.pickupLocation),
    createdAt: FieldValue.serverTimestamp(),
    ...(expiresAt ? { expiresAt } : {}),
    status,
    viewCount: normalizeNumber(body.viewCount),
    isActive: normalizeBoolean(body.isActive, true),
    isFeatured: normalizeBoolean(body.isFeatured, false),
    featureRequested: normalizeBoolean(body.featureRequested, false),
    featureDurationDays: normalizeOptionalNumber(body.featureDurationDays),
    featurePrice: normalizeOptionalNumber(body.featurePrice),
    featurePaymentStatus: normalizeOptionalString(body.featurePaymentStatus) || "not_requested",
    favoritesCount: normalizeNumber(body.favoritesCount),
    allowMessages: normalizeBoolean(body.allowMessages, true),
    userId,
    userName: normalizeOptionalString(body.userName),
    businessId: normalizeOptionalString(body.businessId),
    sellerName: normalizeOptionalString(body.sellerName),
    sellerEmail: normalizeOptionalString(body.sellerEmail),
    sellerBusinessName: normalizeOptionalString(body.sellerBusinessName),
    sellerBusinessTier: normalizeOptionalString(body.sellerBusinessTier),
    sellerAccountType: normalizeOptionalString(body.sellerAccountType),
    flaggedOutOfState: normalizeBoolean(body.flaggedOutOfState, false),
    latitude: normalizeOptionalNumber(body.latitude),
    longitude: normalizeOptionalNumber(body.longitude),
    resubmittedFromListingId: normalizeOptionalString(body.resubmittedFromListingId),
  };
}

function normalizeListingText(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function getUserTrustScore(userData: Record<string, unknown>): number {
  const moderationRisk = userData.moderationRisk;
  if (moderationRisk && typeof moderationRisk === "object") {
    return normalizeNumber((moderationRisk as Record<string, unknown>).trustScore, 0);
  }

  return 0;
}

function getUserModerationHistory(userData: Record<string, unknown>): ModerationStats {
  return normalizeModerationStats(userData.moderationStats);
}

function countEmojiCharacters(value: string): number {
  const matches = value.match(/[\p{Extended_Pictographic}\uFE0F]/gu);
  return matches ? matches.length : 0;
}

function isAllCapsTitle(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < 6) {
    return false;
  }

  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, "");
  if (lettersOnly.length < 4) {
    return false;
  }

  return lettersOnly === lettersOnly.toUpperCase();
}

function shouldSendToAI(title: string, description: string, userData: Record<string, unknown>): PreModerationDecision {
  const combinedText = `${title} ${description}`;
  const normalizedText = normalizeListingText(combinedText);
  const normalizedTitle = normalizeListingText(title);
  const matchedKeywordEntry = Object.entries(BANNED_KEYWORD_GROUPS).find(([, keywords]) =>
    keywords.some((keyword) => normalizedText.includes(keyword)),
  );
  const matchedKeywords = matchedKeywordEntry ? matchedKeywordEntry[1].filter((keyword) => normalizedText.includes(keyword)) : [];

  if (matchedKeywords.length > 0) {
    return {
      sendToAI: false,
      autoFlag: true,
      reason: "keyword_match",
      matchedKeywords,
      matchedKeywordCategory: matchedKeywordEntry?.[0],
    };
  }

  const repeatedCharactersDetected =
    /([!$?])\1{3,}/.test(combinedText) ||
    /(.)\1{5,}/.test(normalizedText);
  const tooManyEmojisDetected = countEmojiCharacters(combinedText) > MAX_EMOJI_COUNT;
  const allCapsTitleDetected = isAllCapsTitle(title);

  if (repeatedCharactersDetected || tooManyEmojisDetected || allCapsTitleDetected) {
    return {
      sendToAI: true,
      priority: "high",
      reason: repeatedCharactersDetected ? "repeated_characters" :
        tooManyEmojisDetected ? "emoji_spam" :
          allCapsTitleDetected ? "all_caps_title" :
            "spam_pattern",
    };
  }

  const trustScore = getUserTrustScore(userData);
  const moderationHistory = getUserModerationHistory(userData);
  const isTrustedUser =
    trustScore >= TRUSTED_USER_SCORE_THRESHOLD &&
    moderationHistory.totalListings >= TRUSTED_USER_MIN_LISTINGS &&
    moderationHistory.rejectedCount === 0 &&
    moderationHistory.flaggedCount === 0;

  if (isTrustedUser && normalizedTitle) {
    return {
      sendToAI: false,
      autoApprove: true,
      reason: "trusted_user",
    };
  }

  return {
    sendToAI: true,
    priority: "normal",
    reason: "default",
  };
}

function buildPreModerationResult(decision: PreModerationDecision): StoredModerationResult {
  const matchedKeywordCategory = decision.matchedKeywordCategory || null;

  if (decision.autoFlag) {
    return {
      flagged: true,
      reason: decision.reason || "keyword_match",
      confidence: "high",
      rawResponse: "PRE_MODERATION_KEYWORD_MATCH",
      source: "pre_moderation",
      priority: decision.priority || "high",
      matchedKeywords: decision.matchedKeywords || [],
      matchedKeywordCategory,
    };
  }

  return {
    flagged: false,
    reason: decision.reason || "trusted_user",
    confidence: "low",
    rawResponse: "PRE_MODERATION_AUTO_APPROVE",
    source: "pre_moderation",
    priority: decision.priority || "normal",
    matchedKeywordCategory,
  };
}

function buildStoredModerationResult(
  moderation: ModerationResult,
  priority: PreModerationPriority = "normal",
): StoredModerationResult {
  return {
    ...moderation,
    source: "ai",
    priority,
    matchedKeywordCategory: null,
  };
}

function parseBearerToken(req: Request): string {
  const authorization = normalizeString(req.headers.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return normalizeString(match?.[1]);
}

async function requireAdmin(req: ListingRequest, res: Response, next: NextFunction): Promise<void> {
  const token = parseBearerToken(req);

  if (!token) {
    res.status(401).json({
      error: "Missing token",
    });
    return;
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);

    if (!decodedToken) {
      res.status(401).json({
        error: "Invalid token",
      });
      return;
    }

    if (decodedToken.admin !== true) {
      res.status(403).json({
        error: "Forbidden",
      });
      return;
    }

    req.user = {
      uid: decodedToken.uid,
      userId: decodedToken.uid,
    };

    next();
  } catch (error) {
    logger.error("Failed to verify admin token", {error});
    res.status(401).json({
      error: "Invalid token",
    });
  }
}

function normalizeListingId(value: unknown): string {
  return normalizeString(value);
}

function normalizeRejectionReason(value: unknown): RejectionReason | null {
  const normalized = normalizeString(value).toLowerCase();
  return REJECTION_REASONS.find((reason) => reason === normalized) ?? null;
}

function normalizeRejectionNotes(value: unknown): string {
  return normalizeString(value);
}

function getRejectionReasonLabel(reason: string): string {
  switch (reason) {
  case "spam":
    return "Spam";
  case "prohibited":
    return "Prohibited item or content";
  case "low_quality":
    return "Low quality listing";
  case "duplicate":
    return "Duplicate listing";
  case "misleading":
    return "Misleading information";
  default:
    return "Marketplace guidelines issue";
  }
}

function buildRejectionReasonDetail(reason: string, notes = ""): string {
  const label = getRejectionReasonLabel(reason);
  return notes ? `${label}. ${notes}` : label;
}

function normalizeModerationStats(value: unknown): ModerationStats {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return {
    totalListings: normalizeNumber(data.totalListings),
    flaggedCount: normalizeNumber(data.flaggedCount),
    rejectedCount: normalizeNumber(data.rejectedCount),
    approvedCount: normalizeNumber(data.approvedCount),
    lastFlaggedAt: data.lastFlaggedAt instanceof Timestamp || data.lastFlaggedAt === null ? data.lastFlaggedAt : null,
    lastRejectedAt: data.lastRejectedAt instanceof Timestamp || data.lastRejectedAt === null ? data.lastRejectedAt : null,
  };
}

function deriveModerationRisk(stats: ModerationStats): {
  trustScore: number;
  riskLevel: ModerationRiskLevel;
  reviewStatus: ModerationReviewStatus;
} {
  const trustScore = Math.max(
    0,
    Math.min(
      100,
      100 - (stats.flaggedCount * 5) - (stats.rejectedCount * 15) + Math.min(stats.approvedCount, 10),
    ),
  );
  const rejectionRate = stats.totalListings > 0 ? stats.rejectedCount / stats.totalListings : 0;
  const flaggedRate = stats.totalListings > 0 ? stats.flaggedCount / stats.totalListings : 0;

  let riskLevel: ModerationRiskLevel = "low";
  let reviewStatus: ModerationReviewStatus = "clear";

  if (trustScore <= 40 || stats.rejectedCount >= 5) {
    riskLevel = "high";
    reviewStatus = "disabled_candidate";
  } else if (trustScore <= 60 || stats.rejectedCount >= 3 || rejectionRate >= 0.4) {
    riskLevel = "high";
    reviewStatus = "at_risk";
  } else if (trustScore <= 80 || stats.flaggedCount >= 2 || flaggedRate >= 0.35) {
    riskLevel = "medium";
    reviewStatus = "watch";
  }

  return {
    trustScore,
    riskLevel,
    reviewStatus,
  };
}

function buildUserModerationUpdate(stats: ModerationStats): Record<string, unknown> {
  const risk = deriveModerationRisk(stats);

  return {
    moderationStats: stats,
    moderationRisk: {
      ...risk,
      updatedAt: FieldValue.serverTimestamp(),
    },
  };
}

function incrementUserModerationStats(
  currentStats: ModerationStats,
  options: {
    totalListings?: number;
    flaggedCount?: number;
    rejectedCount?: number;
    approvedCount?: number;
    lastFlaggedAt?: FieldValue | Timestamp | null;
    lastRejectedAt?: FieldValue | Timestamp | null;
  },
): ModerationStats {
  return {
    totalListings: currentStats.totalListings + (options.totalListings || 0),
    flaggedCount: currentStats.flaggedCount + (options.flaggedCount || 0),
    rejectedCount: currentStats.rejectedCount + (options.rejectedCount || 0),
    approvedCount: currentStats.approvedCount + (options.approvedCount || 0),
    lastFlaggedAt: options.lastFlaggedAt !== undefined ? options.lastFlaggedAt : currentStats.lastFlaggedAt,
    lastRejectedAt: options.lastRejectedAt !== undefined ? options.lastRejectedAt : currentStats.lastRejectedAt,
  };
}

async function updateListingReviewStatus(
  listingId: string,
  status: ReviewedListingStatus,
  reviewedBy: string,
  rejectionReason: string,
  rejectionNotes: string,
): Promise<void> {
  const listingRef = db.collection("listings").doc(listingId);
  const moderationRef = listingRef.collection("moderation").doc("result");

  await db.runTransaction(async (transaction) => {
    const listingSnap = await transaction.get(listingRef);

    if (!listingSnap.exists) {
      const notFoundError = new Error("Listing not found");
      notFoundError.name = "ListingNotFoundError";
      throw notFoundError;
    }

    const listingData = listingSnap.data() || {};
    const previousStatus = normalizeString(listingData.status).toLowerCase();
    const listingOwnerId = normalizeString(listingData.userId);
    const reviewedAt = FieldValue.serverTimestamp();
    const nextListingFields: Record<string, unknown> = {
      status,
      reviewedAt,
      reviewedBy,
      updatedAt: reviewedAt,
      rejectionReason: status === "rejected" ? rejectionReason : "",
      rejectionNotes: status === "rejected" ? rejectionNotes : "",
      rejectedAt: status === "rejected" ? reviewedAt : null,
      rejectedBy: status === "rejected" ? reviewedBy : null,
    };

    const nextModerationFields: Record<string, unknown> = {
      decision: status,
      reviewedAt,
      reviewedBy,
      rejectionReason: status === "rejected" ? rejectionReason : "",
      rejectionNotes: status === "rejected" ? rejectionNotes : "",
    };

    transaction.set(listingRef, nextListingFields, {merge: true});
    transaction.set(moderationRef, nextModerationFields, {merge: true});

    if (listingOwnerId) {
      const userRef = db.collection("users").doc(listingOwnerId);
      const userSnap = await transaction.get(userRef);
      const currentStats = normalizeModerationStats(userSnap.data()?.moderationStats);
      let nextStats = currentStats;

      if (status === "rejected" && previousStatus !== "rejected") {
        nextStats = incrementUserModerationStats(currentStats, {
          rejectedCount: 1,
          lastRejectedAt: FieldValue.serverTimestamp(),
        });
      } else if (status === "approved" && previousStatus !== "approved") {
        nextStats = incrementUserModerationStats(currentStats, {
          approvedCount: 1,
        });
      }

      if (nextStats !== currentStats) {
        transaction.set(userRef, buildUserModerationUpdate(nextStats), {merge: true});
      }
    }
  });
}

function resolveUserId(req: ListingRequest): string {
  const user = req.user;

  if (user) {
    const candidateUserId = normalizeString(user.userId ?? user.uid ?? user.id);
    if (candidateUserId) {
      return candidateUserId;
    }
  }

  return normalizeString(req.body?.userId);
}

function buildModerationPrompt(title: string, description: string): string {
  return `Review this marketplace listing for a local buy/sell app. Flag if it contains scam language, prohibited items, misleading pricing, or spam. Title: ${title}. Description: ${description}. Return only valid JSON: { flagged: boolean, reason: string, confidence: 'low'|'medium'|'high' }`;
}

function parseModerationResponse(rawResponse: string): Omit<ModerationResult, "rawResponse"> {
  if (!rawResponse) {
    return {...FALLBACK_MODERATION};
  }

  const candidates = [rawResponse.trim()];
  const firstBraceIndex = rawResponse.indexOf("{");
  const lastBraceIndex = rawResponse.lastIndexOf("}");

  if (firstBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
    const extractedJson = rawResponse.slice(firstBraceIndex, lastBraceIndex + 1).trim();
    if (extractedJson && extractedJson !== candidates[0]) {
      candidates.push(extractedJson);
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const confidence = parsed.confidence;

      return {
        flagged: typeof parsed.flagged === "boolean" ? parsed.flagged : FALLBACK_MODERATION.flagged,
        reason: typeof parsed.reason === "string" ? parsed.reason : FALLBACK_MODERATION.reason,
        confidence:
          confidence === "low" || confidence === "medium" || confidence === "high" ?
            confidence :
            FALLBACK_MODERATION.confidence,
      };
    } catch (error) {
      logger.warn("Failed to parse moderation response JSON candidate", {
        error,
      });
    }
  }

  return {...FALLBACK_MODERATION};
}

function getListingStatus(moderation: Omit<ModerationResult, "rawResponse">): ListingStatus {
  return moderation.flagged && (moderation.confidence === "medium" || moderation.confidence === "high") ?
    "pending_review" :
    "approved";
}

async function moderateListing(title: string, description: string): Promise<ModerationResult> {
const apiKey = openaiKey.value();

if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY");
}
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: buildModerationPrompt(title, description),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("OpenAI moderation request failed", {
      status: response.status,
      body: errorText,
    });
    throw new Error(`OpenAI moderation request failed with status ${response.status}`);
  }

  const completion = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = completion.choices?.[0]?.message?.content;
  const rawResponse = Array.isArray(content) ?
    content
      .map((part) => typeof part?.text === "string" ? part.text : "")
      .join("")
      .trim() :
    typeof content === "string" ? content.trim() : "";

  const parsedModeration = parseModerationResponse(rawResponse);

  return {
    ...parsedModeration,
    rawResponse,
  };
}

function getDateValue(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (value instanceof Timestamp) {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    try {
      const parsed = ((value as { toDate: () => Date }).toDate());
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function isWithinDateRange(value: unknown, fromDate: Date | null, toDate: Date | null): boolean {
  const parsed = getDateValue(value);
  if (!parsed) {
    return false;
  }

  if (fromDate && parsed < fromDate) {
    return false;
  }

  if (toDate) {
    const endOfDay = new Date(toDate);
    endOfDay.setHours(23, 59, 59, 999);
    if (parsed > endOfDay) {
      return false;
    }
  }

  return true;
}

function toIsoStringOrNull(value: unknown): string | null {
  const parsed = getDateValue(value);
  return parsed ? parsed.toISOString() : null;
}

function parseDateQuery(value: unknown): Date | null {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePositiveIntegerQuery(value: unknown, fallback: number, max: number): number {
  const raw = Number.parseInt(normalizeString(value), 10);
  if (!Number.isFinite(raw) || raw <= 0) {
    return fallback;
  }

  return Math.min(raw, max);
}

function normalizeReasonKey(value: unknown): string {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return "unspecified";
  }

  return normalized
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_") || "unspecified";
}

function getDayBucket(value: unknown): string | null {
  const parsed = getDateValue(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function incrementCount(target: Record<string, number>, key: string, amount = 1): void {
  target[key] = (target[key] || 0) + amount;
}

app.post("/api/listings", async (req: ListingRequest, res: Response) => {
  const title = normalizeString(req.body?.title);
  const description = normalizeString(req.body?.description);
  const userId = resolveUserId(req);

  if (!title || !description || !userId) {
    res.status(400).json({
      error: "title, description, and userId are required",
    });
    return;
  }

  try {
    const listingRef = db.collection("listings").doc();
    const moderationRef = listingRef.collection("moderation").doc("result");
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};
    const preModeration = shouldSendToAI(title, description, userData);
let moderation;

if (preModeration.sendToAI) {
  try {
    const aiResult = await moderateListing(title, description);

    moderation = buildStoredModerationResult(
      aiResult,
      preModeration.priority || "normal",
    );
  } catch (error) {
    logger.error("🔥 AI moderation failed, using fallback", { error });

  moderation = {
  flagged: false,
  reason: "fallback_error",
  confidence: "low" as const,
  rawResponse: "FALLBACK",
  source: "ai" as const,
  priority: preModeration.priority || "normal",
  matchedKeywords: [],
  matchedKeywordCategory: null,
};
  }
} else {
  moderation = buildPreModerationResult(preModeration);
}
    const status = preModeration.autoApprove ? "approved" : getListingStatus(moderation);

    await db.runTransaction(async (transaction) => {
      const transactionUserSnap = await transaction.get(userRef);
      const currentStats = normalizeModerationStats(transactionUserSnap.data()?.moderationStats);
      const nextStats = incrementUserModerationStats(currentStats, {
        totalListings: 1,
        flaggedCount: moderation.flagged ? 1 : 0,
        approvedCount: status === "approved" ? 1 : 0,
        lastFlaggedAt: moderation.flagged ? FieldValue.serverTimestamp() : currentStats.lastFlaggedAt,
      });

      transaction.set(listingRef, buildListingDocument(req.body || {}, userId, status));
      transaction.set(moderationRef, {
        flagged: moderation.flagged,
        reason: moderation.reason,
        confidence: moderation.confidence,
        rawResponse: moderation.rawResponse,
        source: moderation.source,
        priority: moderation.priority,
        matchedKeywords: moderation.matchedKeywords || [],
        matchedKeywordCategory: moderation.matchedKeywordCategory || null,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(userRef, buildUserModerationUpdate(nextStats), {merge: true});
    });

    res.status(201).json({
      listingId: listingRef.id,
      status,
    });
  } catch (error) {
    logger.error("Failed to create listing with moderation", {
      error,
      title,
      userId,
    });

    res.status(500).json({
      error: "Failed to create listing",
    });
  }
});

app.post("/api/admin/approve-listing", requireAdmin, async (req: ListingRequest, res: Response) => {
  const listingId = normalizeListingId(req.body?.listingId);
  const reviewedBy = resolveUserId(req);

  if (!listingId) {
    res.status(400).json({
      error: "listingId is required",
    });
    return;
  }

  try {
    await updateListingReviewStatus(listingId, "approved", reviewedBy, "", "");
    res.status(200).json({
      listingId,
      status: "approved",
      rejectionReason: "",
      rejectionNotes: "",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingNotFoundError") {
      res.status(404).json({
        error: "Listing not found",
      });
      return;
    }

    logger.error("Failed to approve listing", {error, listingId, reviewedBy});
    res.status(500).json({
      error: "Failed to approve listing",
    });
  }
});

app.post("/api/admin/reject-listing", requireAdmin, async (req: ListingRequest, res: Response) => {
  const listingId = normalizeListingId(req.body?.listingId);
  const reviewedBy = resolveUserId(req);
  const rejectionReason = normalizeRejectionReason(req.body?.rejectionReason ?? req.body?.reason);
  const rejectionNotes = normalizeRejectionNotes(req.body?.rejectionNotes ?? req.body?.adminNotes);

  if (!listingId) {
    res.status(400).json({
      error: "listingId is required",
    });
    return;
  }

  if (!rejectionReason) {
    res.status(400).json({
      error: "rejectionReason must be one of: spam, prohibited, low_quality, duplicate, misleading",
      allowedReasons: REJECTION_REASONS,
    });
    return;
  }

  try {
    await updateListingReviewStatus(listingId, "rejected", reviewedBy, rejectionReason, rejectionNotes);
    res.status(200).json({
      listingId,
      status: "rejected",
      rejectionReason,
      rejectionReasonLabel: getRejectionReasonLabel(rejectionReason),
      rejectionNotes,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingNotFoundError") {
      res.status(404).json({
        error: "Listing not found",
      });
      return;
    }

    logger.error("Failed to reject listing", {error, listingId, reviewedBy});
    res.status(500).json({
      error: "Failed to reject listing",
    });
  }
});

app.get("/api/admin/moderation-report", requireAdmin, async (req: Request, res: Response) => {
  const fromDate = parseDateQuery(req.query.from);
  const toDate = parseDateQuery(req.query.to);
  const recentLimit = parsePositiveIntegerQuery(req.query.recentLimit, 20, 100);
  const atRiskLimit = parsePositiveIntegerQuery(req.query.atRiskLimit, 25, 100);
  const offenderLimit = parsePositiveIntegerQuery(req.query.offenderLimit, 10, 50);

  try {
    const [listingsSnap, moderationSnap, usersSnap] = await Promise.all([
      db.collection("listings").get(),
      db.collectionGroup("moderation").get(),
      db.collection("users").get(),
    ]);

    const moderationByListingId = new Map<string, Record<string, unknown>>();
    moderationSnap.docs.forEach((docSnap) => {
      if (docSnap.id !== "result") {
        return;
      }

      const listingRef = docSnap.ref.parent.parent;
      if (!listingRef) {
        return;
      }

      moderationByListingId.set(listingRef.id, docSnap.data());
    });

    const summary = {
      totalListings: 0,
      approved: 0,
      rejected: 0,
      flagged: 0,
      pendingReview: 0,
    };
    const rejectionReasons: Record<string, number> = {};
    const flaggedReasons: Record<string, number> = {};
    const rejectionsByDay: Record<string, number> = {};
    const perCategoryModerationStats: Record<string, {
      total: number;
      approved: number;
      rejected: number;
      flagged: number;
      pendingReview: number;
    }> = {};
    const perReasonConfidenceBreakdown: Record<string, {
      low: number;
      medium: number;
      high: number;
    }> = {};
    const recentRejections: Array<Record<string, unknown>> = [];
    const recentFlaggedListings: Array<Record<string, unknown>> = [];

    listingsSnap.docs.forEach((docSnap) => {
      const listingData = docSnap.data() || {};
      const moderationData = moderationByListingId.get(docSnap.id) || {};
      const createdAt = listingData.createdAt;
      const status = normalizeString(listingData.status).toLowerCase();
      const moderationFlagged = moderationData.flagged === true;
      const categoryKey = normalizeOptionalString(listingData.category) || "uncategorized";

      if (!isWithinDateRange(createdAt, fromDate, toDate)) {
        return;
      }

      summary.totalListings += 1;
      if (!perCategoryModerationStats[categoryKey]) {
        perCategoryModerationStats[categoryKey] = {
          total: 0,
          approved: 0,
          rejected: 0,
          flagged: 0,
          pendingReview: 0,
        };
      }
      perCategoryModerationStats[categoryKey].total += 1;

      if (status === "approved") {
        summary.approved += 1;
        perCategoryModerationStats[categoryKey].approved += 1;
      } else if (status === "rejected") {
        summary.rejected += 1;
        perCategoryModerationStats[categoryKey].rejected += 1;
      } else if (status === "pending_review") {
        summary.pendingReview += 1;
        perCategoryModerationStats[categoryKey].pendingReview += 1;
      }

      if (moderationFlagged) {
        summary.flagged += 1;
        const flaggedReasonKey = normalizeReasonKey(moderationData.reason);
        const confidenceKey = normalizeString(moderationData.confidence).toLowerCase();
        incrementCount(flaggedReasons, flaggedReasonKey);
        perCategoryModerationStats[categoryKey].flagged += 1;
        if (!perReasonConfidenceBreakdown[flaggedReasonKey]) {
          perReasonConfidenceBreakdown[flaggedReasonKey] = {
            low: 0,
            medium: 0,
            high: 0,
          };
        }
        if (confidenceKey === "medium" || confidenceKey === "high") {
          perReasonConfidenceBreakdown[flaggedReasonKey][confidenceKey] += 1;
        } else {
          perReasonConfidenceBreakdown[flaggedReasonKey].low += 1;
        }
        recentFlaggedListings.push({
          listingId: docSnap.id,
          title: normalizeString(listingData.title) || "Untitled Listing",
          reason: flaggedReasonKey,
          confidence: normalizeString(moderationData.confidence) || "low",
          createdAt: toIsoStringOrNull(createdAt),
          status: status || "unknown",
        });
      }

      if (status === "rejected") {
        const standardizedReason = normalizeRejectionReason(
          listingData.rejectionReason ||
          moderationData.rejectionReason,
        );
        const rejectionReasonSource =
          standardizedReason ||
          moderationData.reason;
        const rejectionReasonKey = standardizedReason || normalizeReasonKey(rejectionReasonSource);
        const rejectionNotes = normalizeString(listingData.rejectionNotes || moderationData.rejectionNotes);
        const rejectionDayBucket = getDayBucket(listingData.rejectedAt) || getDayBucket(createdAt);
        incrementCount(rejectionReasons, rejectionReasonKey);
        if (rejectionDayBucket) {
          incrementCount(rejectionsByDay, rejectionDayBucket);
        }
        recentRejections.push({
          listingId: docSnap.id,
          userId: normalizeString(listingData.userId),
          title: normalizeString(listingData.title) || "Untitled Listing",
          reason: rejectionReasonKey,
          reasonLabel: getRejectionReasonLabel(rejectionReasonKey),
          rejectionReason: buildRejectionReasonDetail(rejectionReasonKey, rejectionNotes),
          rejectionNotes: rejectionNotes || null,
          category: normalizeOptionalString(listingData.category),
          rejectedAt: toIsoStringOrNull(listingData.rejectedAt),
          createdAt: toIsoStringOrNull(createdAt),
        });
      }
    });

    recentRejections.sort((a, b) => {
      const aTime = getDateValue(a.rejectedAt)?.getTime() || 0;
      const bTime = getDateValue(b.rejectedAt)?.getTime() || 0;
      return bTime - aTime;
    });

    recentFlaggedListings.sort((a, b) => {
      const aTime = getDateValue(a.createdAt)?.getTime() || 0;
      const bTime = getDateValue(b.createdAt)?.getTime() || 0;
      return bTime - aTime;
    });

    const atRiskUsers = usersSnap.docs.map((docSnap) => {
      const userData = docSnap.data() || {};
      const moderationStats = normalizeModerationStats(userData.moderationStats);
      const moderationRisk = deriveModerationRisk(moderationStats);

      return {
        userId: docSnap.id,
        email: normalizeOptionalString(userData.email),
        trustScore: Number((moderationRisk.trustScore / 100).toFixed(2)),
        trustScorePercent: moderationRisk.trustScore,
        riskLevel: moderationRisk.riskLevel,
        reviewStatus: moderationRisk.reviewStatus,
        rejectedCount: moderationStats.rejectedCount,
        flaggedCount: moderationStats.flaggedCount,
        approvedCount: moderationStats.approvedCount,
        totalListings: moderationStats.totalListings,
        isDisabled: userData.isDisabled === true,
        disabledReason: normalizeOptionalString(userData.disabledReason),
        lastRejectedAt: toIsoStringOrNull(moderationStats.lastRejectedAt),
        lastFlaggedAt: toIsoStringOrNull(moderationStats.lastFlaggedAt),
      };
    }).filter((user) => user.reviewStatus === "at_risk" || user.reviewStatus === "disabled_candidate")
      .sort((a, b) => {
        if (a.trustScorePercent !== b.trustScorePercent) {
          return a.trustScorePercent - b.trustScorePercent;
        }

        return b.rejectedCount - a.rejectedCount;
      })
      .slice(0, atRiskLimit);

    const allUsersWithModeration = usersSnap.docs.map((docSnap) => {
      const userData = docSnap.data() || {};
      const moderationStats = normalizeModerationStats(userData.moderationStats);
      const moderationRisk = deriveModerationRisk(moderationStats);

      return {
        userId: docSnap.id,
        email: normalizeOptionalString(userData.email),
        trustScore: Number((moderationRisk.trustScore / 100).toFixed(2)),
        trustScorePercent: moderationRisk.trustScore,
        riskLevel: moderationRisk.riskLevel,
        reviewStatus: moderationRisk.reviewStatus,
        rejectedCount: moderationStats.rejectedCount,
        flaggedCount: moderationStats.flaggedCount,
        approvedCount: moderationStats.approvedCount,
        totalListings: moderationStats.totalListings,
        lastRejectedAt: toIsoStringOrNull(moderationStats.lastRejectedAt),
        lastFlaggedAt: toIsoStringOrNull(moderationStats.lastFlaggedAt),
      };
    });

    const topRepeatOffenders = allUsersWithModeration
      .filter((user) => user.rejectedCount > 0)
      .sort((a, b) => {
        if (b.rejectedCount !== a.rejectedCount) {
          return b.rejectedCount - a.rejectedCount;
        }

        if (a.trustScorePercent !== b.trustScorePercent) {
          return a.trustScorePercent - b.trustScorePercent;
        }

        return b.totalListings - a.totalListings;
      })
      .slice(0, offenderLimit);

    const topRepeatFlaggers = allUsersWithModeration
      .filter((user) => user.flaggedCount > 0)
      .sort((a, b) => {
        if (b.flaggedCount !== a.flaggedCount) {
          return b.flaggedCount - a.flaggedCount;
        }

        if (a.trustScorePercent !== b.trustScorePercent) {
          return a.trustScorePercent - b.trustScorePercent;
        }

        return b.totalListings - a.totalListings;
      })
      .slice(0, offenderLimit);

    const report = {
      generatedAt: new Date().toISOString(),
      filters: {
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
        recentLimit,
        atRiskLimit,
        offenderLimit,
      },
      rejectionReasonCatalog: REJECTION_REASONS,
      summary,
      rejectionReasons,
      flaggedReasons,
      rejectionsByDay,
      perCategoryModerationStats,
      perReasonConfidenceBreakdown,
      recentRejections: recentRejections.slice(0, recentLimit),
      recentFlaggedListings: recentFlaggedListings.slice(0, recentLimit),
      atRiskUsers,
      topRepeatOffenders,
      topRepeatFlaggers,
    };

    res.status(200).json(report);
  } catch (error) {
    logger.error("Failed to generate moderation report", {
      error,
      fromDate: fromDate?.toISOString() || null,
      toDate: toDate?.toISOString() || null,
      recentLimit,
      atRiskLimit,
      offenderLimit,
    });
    res.status(500).json({
      error: "Failed to generate moderation report",
    });
  }
});

app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof SyntaxError) {
    res.status(400).json({
      error: "Invalid JSON body",
    });
    return;
  }

  next(error);
});

export const listingsApi = onRequest({
  secrets: ["OPENAI_API_KEY"],
  invoker: "public",
}, app);
