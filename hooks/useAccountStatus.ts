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
  businessTier?: 'free' | 'premium';
  accountType?: 'personal' | 'user' | 'business';
};

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
};

export function useAccountStatus(): AccountStatus {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setLoading(false);
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
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
    });

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
  };
}
