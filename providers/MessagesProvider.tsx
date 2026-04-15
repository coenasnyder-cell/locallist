import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';

type ThreadPreview = {
  id: string;
  listingTitle?: string;
  lastMessage?: string;
  lastTimestamp?: any;
  unreadBy?: string[];
  hiddenFor?: string[];
};

type MessagesContextType = {
  threadPreviews: ThreadPreview[];
  unreadCount: number;
};

const MessagesContext = createContext<MessagesContextType>({
  threadPreviews: [],
  unreadCount: 0,
});

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAccountStatus();

  const [threads, setThreads] = useState<ThreadPreview[]>([]);
  const [unreadThreads, setUnreadThreads] = useState<ThreadPreview[]>([]);

  useEffect(() => {
    console.log('[MessagesProvider] mounted');
    return () => console.log('[MessagesProvider] unmounted');
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user?.uid) {
      setThreads([]);
      setUnreadThreads([]);
      return;
    }

    const threadsQuery = query(
      collection(db, 'threads'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(threadsQuery, (snapshot) => {
      const rows = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));

      const sorted = rows.sort((a, b) => {
        const aTime = a.lastTimestamp?.toMillis?.() || 0;
        const bTime = b.lastTimestamp?.toMillis?.() || 0;
        return bTime - aTime;
      });

      const unread = sorted.filter((t) =>
        (t.unreadBy || []).includes(user.uid)
      );

      // ✅ SET BOTH STATES
      setThreads(sorted);
      setUnreadThreads(unread);
    });

    return () => unsubscribe();
  }, [user?.uid, loading]);

  const value = useMemo(
    () => ({
      threadPreviews: threads,
      unreadCount: unreadThreads.length,
    }),
    [threads, unreadThreads.length]
  );

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  return useContext(MessagesContext);
}