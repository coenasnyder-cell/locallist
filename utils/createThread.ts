import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { app } from '../firebase';

export async function createThread(
  threadId: string,
  participantIds: string[],
  unreadBy: string[],
  lastMessage: string,
  lastMessageTimestamp: number
) {
  const db = getFirestore(app);
  const threadRef = doc(db, 'threads', threadId);
  await setDoc(threadRef, {
    id: threadId,
    participantIds,
    unreadBy,
    lastMessage,
    lastMessageTimestamp,
  });
}