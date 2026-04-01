import { arrayRemove, arrayUnion, doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import { app } from '../firebase';
import { UserProfile } from '../types/User';

/**
 * Block a user by adding their UID to the current user's blockedUsers array
 */
export const blockUser = async (currentUserId: string, userIdToBlock: string): Promise<void> => {
  if (currentUserId === userIdToBlock) {
    throw new Error('Cannot block yourself');
  }

  const db = getFirestore(app);
  const userRef = doc(db, 'users', currentUserId);
  
  await updateDoc(userRef, {
    blockedUsers: arrayUnion(userIdToBlock)
  });
};

/**
 * Unblock a user by removing their UID from the current user's blockedUsers array
 */
export const unblockUser = async (currentUserId: string, userIdToUnblock: string): Promise<void> => {
  const db = getFirestore(app);
  const userRef = doc(db, 'users', currentUserId);
  
  await updateDoc(userRef, {
    blockedUsers: arrayRemove(userIdToUnblock)
  });
};

/**
 * Check if a user is blocked by the current user
 */
export const isUserBlocked = (profile: any | null, userId: string): boolean => {
  if (!profile || !userId) return false;
  return profile.blockedUsers?.includes(userId) || false;
};

/**
 * Get the list of blocked user IDs for the current user
 */
export const getBlockedUsers = (profile: any | null): string[] => {
  return profile?.blockedUsers || [];
};

/**
 * Check if current user is blocked by another user
 */
export const isBlockedBy = async (currentUserId: string, otherUserId: string): Promise<boolean> => {
  try {
    const db = getFirestore(app);
    const otherUserRef = doc(db, 'users', otherUserId);
    const otherUserDoc = await getDoc(otherUserRef);
    
    if (!otherUserDoc.exists()) return false;
    
    const otherUserData = otherUserDoc.data() as UserProfile;
    return otherUserData.blockedUsers?.includes(currentUserId) || false;
  } catch (error) {
    console.error('Error checking if blocked by user:', error);
    return false;
  }
};

/**
 * Check if two users have blocked each other (mutual block)
 */
export const isMutualBlock = async (user1Id: string, user2Id: string): Promise<boolean> => {
  try {
    const db = getFirestore(app);
    
    const user1Ref = doc(db, 'users', user1Id);
    const user2Ref = doc(db, 'users', user2Id);
    
    const [user1Doc, user2Doc] = await Promise.all([
      getDoc(user1Ref),
      getDoc(user2Ref)
    ]);
    
    if (!user1Doc.exists() || !user2Doc.exists()) return false;
    
    const user1Data = user1Doc.data() as UserProfile;
    const user2Data = user2Doc.data() as UserProfile;
    
    const user1BlocksUser2 = user1Data.blockedUsers?.includes(user2Id) || false;
    const user2BlocksUser1 = user2Data.blockedUsers?.includes(user1Id) || false;
    
    return user1BlocksUser2 && user2BlocksUser1;
  } catch (error) {
    console.error('Error checking mutual block:', error);
    return false;
  }
};
