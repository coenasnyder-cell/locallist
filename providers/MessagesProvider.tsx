import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
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

    // Limit to 20 most recent threads to prevent memory/heap issues
    // Order by lastTimestamp in the query to avoid large in-memory sorts
    const threadsQuery = query(
      collection(db, 'threads'),
      where('participantIds', 'array-contains', user.uid),
      orderBy('lastTimestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(threadsQuery, (snapshot) => {
      const rows = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));

      // Unread filtering remains in-memory as it depends on the user.uid
      const unread = rows.filter((t) =>
        (t.unreadBy || []).includes(user.uid)
      );

      setThreads(rows);
      setUnreadThreads(unread);
    }, (error) => {
      console.error('[MessagesProvider] Snapshot error:', error);
      // If index is missing, it will log a link to create it in the Firebase console
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
