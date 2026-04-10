import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { app } from '../firebase';
import { UserProfile as BaseUserProfile } from '../types/User';

type UserProfile = BaseUserProfile & {
  status?: string;
  role?: string;
  zipApproved?: boolean;
  name?: string;
  zipCode?: string;
  businessTier?: 'free' | 'premium';
  accountType?: 'personal' | 'user' | 'business';
  /** Set when user completes the service-area + terms gate (Firestore timestamp). */
  termsAcceptedAt?: unknown;
};

function isPersonalScopeAccount(profile: UserProfile | null): boolean {
  if (!profile) return true;
  const t = String(profile.accountType || '').toLowerCase();
  return t === '' || t === 'personal' || t === 'user';
}

/**
 * True until the user has finished the mandatory onboarding flow: valid ZIP + name in Firestore
 * and termsAcceptedAt from the ZIP screen (Continue). Google/Firebase Auth displayName alone does not count.
 * Email/password signup sets termsAcceptedAt when the profile is first written with ZIP + name.
 *
 * Google sign-in creates a stub with publicProfileEnabled: false; we keep showing the gate until ZIP screen
 * completion sets publicProfileEnabled true (even if stale name/zip/terms exist on the document).
 */
export function profileNeedsServiceArea(profile: UserProfile | null): boolean {
  if (!profile) return true;

  if (profile.publicProfileEnabled === false) {
    return true;
  }

  const zip = String(profile.zipCode || '').trim();
  const name = String(profile.name || profile.displayName || '').trim();

  const zipOk = /^[0-9]{5}$/.test(zip);
  const nameOk = name.length > 0;
  const termsOk = profile.termsAcceptedAt != null;

  return !(zipOk && nameOk && termsOk);
}

type AccountStatus = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  isDisabled: boolean;
  isAdmin: boolean;
  isBusinessAccount: boolean;
  isRegularAccount: boolean;
  /** True when signed-in, verified, but name/ZIP still missing (show mandatory service-area screen). */
  needsServiceAreaProfile: boolean;
  canPostListings: boolean;
  postingBlockedReason: string | null;
};

export function useAccountStatus(): AccountStatus {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (!authUser) {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return undefined;
    }

    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
        setLoading(false);
      },
      () => {
        setProfile(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const providerIds = user?.providerData?.map((provider) => provider.providerId) ?? [];
  const isPasswordUser = providerIds.includes('password');
  const isVerified = !!user && (!isPasswordUser || !!user.emailVerified);
  const isBanned = !!profile?.isBanned;
  const isDisabled = !!profile?.isDisabled;
  const isActive = !!profile && profile.status === 'approved' && !isBanned && !isDisabled;
  const normalizedRole = String(profile?.role || '').toLowerCase();
  const normalizedAccountType = String(profile?.accountType || '').toLowerCase();
  const isAdmin = normalizedRole === 'admin';
  const isBusinessAccount = normalizedAccountType === 'business';
  const isRegularAccount = !!user && (!!profile ? !isBusinessAccount : false);
  const needsServiceAreaProfile = !!user && isVerified && profileNeedsServiceArea(profile);
  const normalizedStatus = String(profile?.status || '').toLowerCase();

  let postingBlockedReason: string | null = null;
  if (!user) {
    postingBlockedReason = 'Please sign in to post a listing.';
  } else if (loading) {
    postingBlockedReason = 'Checking account status. Please try again in a moment.';
  } else if (!profile) {
    postingBlockedReason = 'Your account profile is not ready yet. Please try again shortly.';
  } else if (isBanned) {
    postingBlockedReason = 'Your account has been banned. Contact support for help.';
  } else if (isDisabled) {
    postingBlockedReason = 'Your account is disabled. Contact support for help.';
  } else if (!isVerified) {
    postingBlockedReason = 'Please verify your email before posting listings.';
  } else if (profileNeedsServiceArea(profile)) {
    postingBlockedReason = 'Finish ZIP verification in Update Profile before posting listings.';
  } else if (normalizedStatus === 'pending') {
    postingBlockedReason = 'Your ZIP verification is pending admin approval before you can post listings.';
  } else if (normalizedStatus === 'rejected') {
    postingBlockedReason = 'Your ZIP was not approved for posting. Please update your profile or contact support.';
  }

  const canPostListings = !postingBlockedReason;

  return {
    user,
    profile,
    loading,
    isVerified,
    isActive,
    isBanned,
    isDisabled,
    isAdmin,
    isBusinessAccount,
    isRegularAccount,
    needsServiceAreaProfile,
    canPostListings,
    postingBlockedReason,
  };
}
