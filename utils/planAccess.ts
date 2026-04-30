import { AccountType, PlanCode, PlanStatus, UserProfile } from '../types/User';

type MaybeUserProfile = Partial<UserProfile> | null | undefined;

const ACTIVE_PAID_PLAN_STATUSES = new Set<PlanStatus>(['active', 'trial']);

function normalizeValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizePlanStatus(status: unknown): PlanStatus | null {
  const normalized = normalizeValue(status);

  switch (normalized) {
    case 'active':
    case 'pending':
    case 'trial':
    case 'past_due':
    case 'canceled':
    case 'cancelled':
    case 'expired':
      return normalized as PlanStatus;
    default:
      return null;
  }
}

function normalizePlanCode(code: unknown): PlanCode | null {
  const normalized = normalizeValue(code);

  switch (normalized) {
    case 'free':
    case 'seller_pro':
    case 'business_premium':
      return normalized as PlanCode;
    default:
      return null;
  }
}

export function resolveAccountType(profile: MaybeUserProfile): AccountType {
  const normalized = normalizeValue(profile?.accountType);

  if (normalized === 'business') {
    return 'business';
  }

  if (normalized === 'personal') {
    return 'personal';
  }

  return 'user';
}

export function resolvePlanCode(profile: MaybeUserProfile): PlanCode {
  const explicitCode = normalizePlanCode(profile?.planCode);
  if (explicitCode) {
    return explicitCode;
  }

  const sellerTier = normalizeValue(profile?.sellerTier);
  if (sellerTier === 'pro') {
    return 'seller_pro';
  }

  const accountType = resolveAccountType(profile);
  const businessTier = normalizeValue(profile?.businessTier);
  const legacySubscriptionPlan = normalizeValue(profile?.subscriptionPlan);
  const legacyPremiumStatus = normalizePlanStatus(profile?.premiumStatus);

  if (
    accountType === 'business' &&
    (
      businessTier === 'premium' ||
      legacySubscriptionPlan === 'premium' ||
      legacySubscriptionPlan === 'business_premium' ||
      profile?.isPremium === true ||
      legacyPremiumStatus === 'active' ||
      legacyPremiumStatus === 'trial' ||
      legacyPremiumStatus === 'past_due'
    )
  ) {
    return 'business_premium';
  }

  if (legacySubscriptionPlan === 'seller_pro') {
    return 'seller_pro';
  }

  return 'free';
}

export function resolvePlanStatus(profile: MaybeUserProfile): PlanStatus {
  return (
    normalizePlanStatus(profile?.planStatus) ||
    normalizePlanStatus(profile?.sellerStatus) ||
    normalizePlanStatus(profile?.premiumStatus) ||
    normalizePlanStatus(profile?.subscriptionStatus) ||
    'active'
  );
}

export function resolvePlan(profile: MaybeUserProfile): {
  accountType: AccountType;
  planCode: PlanCode;
  planStatus: PlanStatus;
} {
  return {
    accountType: resolveAccountType(profile),
    planCode: resolvePlanCode(profile),
    planStatus: resolvePlanStatus(profile),
  };
}

export function hasActivePaidPlan(profile: MaybeUserProfile): boolean {
  const { planCode, planStatus } = resolvePlan(profile);
  return planCode !== 'free' && ACTIVE_PAID_PLAN_STATUSES.has(planStatus);
}

export function hasBusinessPremiumAccess(profile: MaybeUserProfile): boolean {
  const { planCode, planStatus } = resolvePlan(profile);
  return planCode === 'business_premium' && ACTIVE_PAID_PLAN_STATUSES.has(planStatus);
}

export function hasSellerProAccess(profile: MaybeUserProfile): boolean {
  const { planCode, planStatus } = resolvePlan(profile);
  return planCode === 'seller_pro' && ACTIVE_PAID_PLAN_STATUSES.has(planStatus);
}

export function hasServiceProviderProfile(profile: MaybeUserProfile): boolean {
  const record = profile as Record<string, unknown> | null | undefined;

  return Boolean(
    record?.hasServiceListing === true ||
    record?.hasServices === true ||
    normalizeValue(record?.providerType) === 'service' ||
    normalizeValue(record?.primaryProfileType) === 'service' ||
    normalizeValue(record?.listingType) === 'services' ||
    normalizeValue(record?.primaryServiceCategory)
  );
}

export function hasPremiumServiceProviderAccess(profile: MaybeUserProfile): boolean {
  return hasServiceProviderProfile(profile) && hasSellerProAccess(profile);
}

export function hasProfileHubAccess(profile: MaybeUserProfile): boolean {
  return resolveAccountType(profile) === 'business' || hasServiceProviderProfile(profile) || normalizeValue((profile as Record<string, unknown> | null | undefined)?.role) === 'admin';
}

export function hasPremiumProfileHubAccess(profile: MaybeUserProfile): boolean {
  return hasBusinessPremiumAccess(profile) || hasPremiumServiceProviderAccess(profile) || normalizeValue((profile as Record<string, unknown> | null | undefined)?.role) === 'admin';
}

export function hasBusinessOnlyAccess(profile: MaybeUserProfile): boolean {
  return resolveAccountType(profile) === 'business' || normalizeValue((profile as Record<string, unknown> | null | undefined)?.role) === 'admin';
}

export function hasSellerHubAccess(profile: MaybeUserProfile): boolean {
  return hasActivePaidPlan(profile);
}

export function hasAiSellerToolsAccess(profile: MaybeUserProfile): boolean {
  return hasActivePaidPlan(profile);
}
