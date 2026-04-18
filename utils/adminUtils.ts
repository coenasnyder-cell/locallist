import { getAuth, getIdTokenResult, User } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { app } from '../firebase';

/**
 * Fall back to the Firestore profile role if a custom auth claim is unavailable.
 */
async function hasAdminRoleInUserDoc(userId: string): Promise<boolean> {
  const db = getFirestore(app);
  const userDoc = await getDoc(doc(db, 'users', userId));

  if (!userDoc.exists()) {
    return false;
  }

  const userData = userDoc.data();
  return String(userData.role || '').toLowerCase() === 'admin';
}

export const resolveAdminStatus = async (user: User | null): Promise<boolean> => {
  if (!user) {
    return false;
  }

  try {
    const tokenResult = await getIdTokenResult(user);
    if (tokenResult.claims.admin === true) {
      return true;
    }
  } catch (error) {
    console.error('Error checking admin claim:', error);
  }

  try {
    return await hasAdminRoleInUserDoc(user.uid);
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Check if a user is an admin by checking auth claims first, then Firestore.
 */
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  const auth = getAuth(app);
  if (auth.currentUser?.uid === userId) {
    return resolveAdminStatus(auth.currentUser);
  }

  try {
    return await hasAdminRoleInUserDoc(userId);
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};
