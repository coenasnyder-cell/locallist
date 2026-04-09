import { User } from 'firebase/auth';
import { doc, Firestore, serverTimestamp, setDoc } from 'firebase/firestore';

export type PersonalSignupFields = {
  name: string;
  email: string | null;
  zipCode: string;
  approved: boolean;
  authProvider?: 'google' | 'password';
};

/**
 * Single place for new personal-account Firestore shape (matches firestore.rules create constraints).
 */
type BuildOptions = {
  /** When true, do not reset createdAt / subscriptionStartedAt (post–sign-in completion of an existing doc). */
  existingProfile?: boolean;
};

export function buildPersonalUserData(fields: PersonalSignupFields, options?: BuildOptions) {
  const { name, email, zipCode, approved, authProvider } = fields;
  const base = {
    name: name.trim(),
    displayName: name.trim(),
    email,
    accountType: 'personal' as const,
    businessName: null,
    businessDescription: null,
    businessPhone: null,
    businessWebsite: null,
    subscriptionPlan: 'free' as const,
    subscriptionStatus: 'active' as const,
    subscriptionExpiresAt: null,
    zipCode: zipCode.trim(),
    status: approved ? ('approved' as const) : ('pending' as const),
    isDisabled: false,
    isBanned: false,
    lastLoginAt: serverTimestamp(),
    termsAcceptedAt: serverTimestamp(),
    digestNotification: false,
    listingUpNotification: true,
    messageNotification: true,
    phone: '',
    /** After onboarding / email signup: visible to other signed-in users for messaging, blocks, etc. */
    publicProfileEnabled: true,
    ...(authProvider ? { authProvider } : {}),
  };

  if (options?.existingProfile) {
    return base;
  }

  return {
    ...base,
    subscriptionStartedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
}

export async function writePersonalUserAndPending(
  db: Firestore,
  uid: string,
  fields: PersonalSignupFields,
  options?: BuildOptions
): Promise<void> {
  const approved = fields.approved;
  const data = buildPersonalUserData(fields, options);

  await setDoc(doc(db, 'users', uid), data, { merge: true });

  if (!approved) {
    await setDoc(doc(db, 'pendingApprovals', uid), {
      userId: uid,
      name: fields.name.trim(),
      email: fields.email,
      zipCode: fields.zipCode.trim(),
      requestedAt: serverTimestamp(),
      status: 'pending',
    });
  }
}

/** After Google/email sign-in when the user doc exists but name/ZIP are still required. */
export async function applyServiceAreaCompletion(
  db: Firestore,
  uid: string,
  fields: PersonalSignupFields
): Promise<void> {
  return writePersonalUserAndPending(db, uid, fields, { existingProfile: true });
}

export function getEmailFromUser(user: User): string {
  return (user.email ?? '').trim();
}
