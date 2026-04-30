export type AccountType = 'personal' | 'user' | 'business';
export type BusinessTier = 'free' | 'premium';
export type PlanCode = 'free' | 'seller_pro' | 'business_premium';
export type PlanStatus = 'active' | 'pending' | 'trial' | 'past_due' | 'canceled' | 'cancelled' | 'expired';
export type LegacySubscriptionPlan =
  | 'free'
  | 'basic'
  | 'premium'
  | 'enterprise'
  | 'seller_pro'
  | 'business_premium';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  accountType?: AccountType;
  businessName?: string | null;
  businessDescription?: string | null;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  businessTier?: BusinessTier;
  planCode?: PlanCode;
  planStatus?: PlanStatus;
  sellerTier?: 'free' | 'pro';
  sellerStatus?: PlanStatus;
  isPremium?: boolean;
  premiumStatus?: PlanStatus;
  subscriptionPlan?: LegacySubscriptionPlan;
  subscriptionStatus?: PlanStatus;
  subscriptionStartedAt?: any;
  subscriptionExpiresAt?: any;
  isBanned?: boolean;
  isDisabled?: boolean;
  isVerified?: boolean;
  blockedUsers?: string[]; // Array of blocked user UIDs
  createdAt?: any;
  updatedAt?: any;
  /** Firestore timestamp when user accepted Terms / Privacy on onboarding. */
  termsAcceptedAt?: any;
  /** When false, other signed-in users cannot read this user doc (pre-onboarding stub). */
  publicProfileEnabled?: boolean;
}
