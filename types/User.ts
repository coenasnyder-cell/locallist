export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  accountType?: 'personal' | 'user' | 'business';
  businessName?: string | null;
  businessDescription?: string | null;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  businessTier?: 'free' | 'premium';
  isPremium?: boolean;
  premiumStatus?: 'active' | 'pending' | 'canceled' | 'cancelled' | 'expired';
  subscriptionPlan?: 'free' | 'basic' | 'premium' | 'enterprise';
  subscriptionStatus?: 'active' | 'cancelled' | 'expired' | 'trial';
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
