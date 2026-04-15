import { useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase'; // make sure this exports Firestore
import { useAccountStatus } from '../hooks/useAccountStatus';
import ScreenTitleRow from './ScreenTitleRow';

type Thread = {
  id: string;
  listingTitle?: string;
  listingImage?: string;
  buyerId?: string;
  sellerId?: string;
  participantIds?: string[];
  lastMessage?: string;
  lastTimestamp?: unknown;
  hiddenFor?: string[];
};

type ParticipantSummary = {
  profileImage: string | null;
  name: string;
};

function getOtherParticipantId(thread: Thread, currentUserId: string): string | null {
  const participantIds = Array.isArray(thread.participantIds)
    ? thread.participantIds.filter((participantId) => typeof participantId === 'string' && participantId.trim().length > 0)
    : [thread.buyerId, thread.sellerId].filter((participantId): participantId is string => typeof participantId === 'string' && participantId.trim().length > 0);

  return participantIds.find((participantId) => participantId !== currentUserId) || null;
}

function getInitials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

export default function ThreadsList() {
  const { user, loading: authLoading } = useAccountStatus();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [participantByThreadId, setParticipantByThreadId] = useState<Record<string, ParticipantSummary>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return undefined;
    }

    if (!user?.uid) {
      setThreads([]);
      setLoading(false);
      return undefined;
    }

    const q = query(
      collection(db, 'threads'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const results = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Thread[];

      results.sort((a, b) => {
        const aTime = typeof (a.lastTimestamp as { toMillis?: () => number })?.toMillis === 'function'
          ? (a.lastTimestamp as { toMillis: () => number }).toMillis()
          : 0;
        const bTime = typeof (b.lastTimestamp as { toMillis?: () => number })?.toMillis === 'function'
          ? (b.lastTimestamp as { toMillis: () => number }).toMillis()
          : 0;
        return bTime - aTime;
      });

      const summaries = await Promise.all(
        results.map(async (thread) => {
          const otherParticipantId = getOtherParticipantId(thread, user.uid);
          if (!otherParticipantId) {
            return [thread.id, { profileImage: null, name: 'User' } as ParticipantSummary] as const;
          }

          try {
            const userSnap = await getDoc(doc(db, 'users', otherParticipantId));
            const userData = userSnap.exists() ? userSnap.data() || {} : {};
            const profileImage = String(userData.profileimage || userData.profileImage || userData.photoURL || '').trim() || null;
            const name = String(userData.name || userData.displayName || userData.email || 'User');
            return [thread.id, { profileImage, name } as ParticipantSummary] as const;
          } catch {
            return [thread.id, { profileImage: null, name: 'User' } as ParticipantSummary] as const;
          }
        })
      );

      setParticipantByThreadId(Object.fromEntries(summaries));

      setThreads(results);
      setLoading(false);
    }, () => {
      setThreads([]);
      setParticipantByThreadId({});
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authLoading, user?.uid]);

  const openThread = async (threadId: string) => {
    if (user?.uid) {
      try {
        await updateDoc(doc(db, 'threads', threadId), {
          unreadBy: arrayRemove(user.uid),
        });
      } catch {
        // Continue navigation even if read-state update fails.
      }
    }
    router.push({
      pathname: '/threadchat',
      params: { threadId }
    });
  };

  const archiveThread = async (threadId: string) => {
    if (!user?.uid) return;
    Alert.alert(
      'Archive Conversation',
      'This will hide the conversation from your inbox. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'threads', threadId), {
                hiddenFor: arrayUnion(user.uid),
              });
            } catch {
              Alert.alert('Error', 'Could not archive conversation right now.');
            }
          },
        },
      ]
    );
  };

  const unarchiveThread = async (threadId: string) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, 'threads', threadId), {
        hiddenFor: arrayRemove(user.uid),
      });
    } catch {
      Alert.alert('Error', 'Could not restore conversation right now.');
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/messagesbutton');
  };

  const filteredThreads = threads.filter((thread) => {
    const isArchived = (thread.hiddenFor || []).includes(user?.uid || '');
    return showArchived ? isArchived : !isArchived;
  });

  if (loading) {
    return (
      <View style={styles.stateWrap}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.stateText}>Loading conversations...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.stateText}>Sign in to view your messages.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.screenTitleRowWrap}>
        <ScreenTitleRow title="Messages" onBackPress={handleBack} />
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          onPress={() => setShowArchived(false)}
          style={[styles.filterButton, !showArchived && styles.filterButtonActive]}
        >
          <Text style={[styles.filterButtonText, !showArchived && styles.filterButtonTextActive]}>Inbox</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowArchived(true)}
          style={[styles.filterButton, showArchived && styles.filterButtonActive]}
        >
          <Text style={[styles.filterButtonText, showArchived && styles.filterButtonTextActive]}>Archived</Text>
        </TouchableOpacity>
      </View>

      {filteredThreads.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{showArchived ? 'No archived conversations' : 'No conversations yet'}</Text>
          <Text style={styles.emptyText}>
            {showArchived
              ? 'Archived conversations will show up here.'
              : 'When buyers message you, your inbox will appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
        data={filteredThreads}
        keyExtractor={(item) => item.id}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.threadContainer}>
            <TouchableOpacity
              onPress={() => openThread(item.id)}
              style={styles.threadTouchable}
            >
              {participantByThreadId[item.id]?.profileImage ? (
                <Image
                  source={{ uri: participantByThreadId[item.id].profileImage! }}
                  style={styles.threadAvatar}
                />
              ) : (
                <View style={styles.threadAvatarFallback}>
                  <Text style={styles.threadAvatarFallbackText}>{getInitials(participantByThreadId[item.id]?.name || 'User')}</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>
                  {item.listingTitle || 'Conversation'}
                </Text>

                <Text style={{ color: '#666', marginTop: 2 }}>
                  {item.lastMessage || 'No messages yet'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => (showArchived ? unarchiveThread(item.id) : archiveThread(item.id))}
              style={styles.archiveButton}
            >
              <Text style={styles.archiveButtonText}>{showArchived ? 'Restore' : 'Archive'}</Text>
            </TouchableOpacity>
          </View>
        )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  screenTitleRowWrap: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc',
  },
  stateText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  filterButtonActive: {
    backgroundColor: '#0f766e',
  },
  filterButtonText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  threadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 10,
  },
  threadTouchable: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
  },
  threadAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
    backgroundColor: '#e2e8f0',
  },
  threadAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarFallbackText: {
    color: '#1e293b',
    fontWeight: '800',
    fontSize: 14,
  },
  archiveButton: {
    marginRight: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eef2f7',
  },
  archiveButtonText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
});