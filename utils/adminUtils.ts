import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { app } from '../firebase';

/**
 * Check if a user is an admin by checking their role field in Firestore
 */
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    const db = getFirestore(app);
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    return userData.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};
