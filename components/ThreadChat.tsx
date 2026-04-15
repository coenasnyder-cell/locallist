import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  query as firestoreQuery,
  getDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../firebase';
import Header from './Header';
import ScreenTitleRow from './ScreenTitleRow';

type MessageRecord = {
  id: string;
  text?: string;
  senderId?: string;
  createdAt?: unknown;
  deleted?: boolean;
  editedAt?: unknown;
  editedBy?: string;
  isEdited?: boolean;
};

type ThreadRecord = {
  buyerId?: string;
  participantIds?: string[];
  listingId?: string | null;
  listingImage?: string | null;
  listingTitle?: string;
  listingType?: string;
  sellerId?: string;
};

type UserSummary = {
  id: string | null;
  name: string;
  profileImage: string | null;
};

function formatMessageTime(value: unknown): string {
  try {
    if (!value) return '';
    if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const parsed = new Date(value as string | number | Date);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return '?';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function getOtherParticipantId(thread: ThreadRecord | null, currentUserId: string): string | null {
  if (!thread) return null;

  const participantIds = Array.isArray(thread.participantIds)
    ? thread.participantIds.filter((participantId) => typeof participantId === 'string' && participantId.trim().length > 0)
    : [thread.buyerId, thread.sellerId].filter((participantId): participantId is string => typeof participantId === 'string' && participantId.trim().length > 0);

  return participantIds.find((participantId) => participantId !== currentUserId) || null;
}

const ThreadChat = () => {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const threadId = typeof params.threadId === 'string' ? params.threadId : Array.isArray(params.threadId) ? params.threadId[0] : '';
  const user = getAuth().currentUser;

  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [text, setText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [threadData, setThreadData] = useState<ThreadRecord | null>(null);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [chatError, setChatError] = useState('');
  const [currentUserSummary, setCurrentUserSummary] = useState<UserSummary>({
    id: user?.uid || null,
    name: user?.displayName || user?.email || 'You',
    profileImage: null,
  });
  const [otherUserSummary, setOtherUserSummary] = useState<UserSummary>({
    id: null,
    name: 'User',
    profileImage: null,
  });
  const [isBlockedByCurrentUser, setIsBlockedByCurrentUser] = useState(false);
  const [isBlockedByOtherUser, setIsBlockedByOtherUser] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const previousMessageCountRef = useRef(0);

  const listingTitle = threadData?.listingTitle || 'Conversation';
  const listingImage = threadData?.listingImage || null;
  const listingId = threadData?.listingId || null;
  const listingType = String(threadData?.listingType || '').toLowerCase();
  const isMessagingBlocked = isBlockedByCurrentUser || isBlockedByOtherUser;

  useEffect(() => {
    console.log('[ThreadChat] mounted');
    return () => console.log('[ThreadChat] unmounted');
  }, []);

  const blockedMessage = useMemo(() => {
    if (isBlockedByCurrentUser) {
      return 'You have blocked this user. You cannot view or send messages until you unblock them.';
    }

    if (isBlockedByOtherUser) {
      return 'This user has blocked you. You can no longer send messages in this conversation.';
    }

    return '';
  }, [isBlockedByCurrentUser, isBlockedByOtherUser]);

  useEffect(() => {
    let isMounted = true;

    const loadThreadData = async () => {
      if (!threadId || !user?.uid) return;

      try {
        const threadSnap = await getDoc(doc(db, 'threads', threadId));
        if (!threadSnap.exists() || !isMounted) return;

        const nextThreadData = threadSnap.data() as ThreadRecord;
        setThreadData(nextThreadData);

        const currentUserSnap = await getDoc(doc(db, 'users', user.uid));
        const currentUserData = currentUserSnap.exists() ? currentUserSnap.data() || {} : {};
        const otherParticipantId = getOtherParticipantId(nextThreadData, user.uid);

        const currentBlockedUsers = Array.isArray(currentUserData.blockedUsers) ? currentUserData.blockedUsers : [];
        const currentName = String(currentUserData.name || currentUserData.displayName || user.displayName || user.email || 'You');
        const currentProfileImage = String(currentUserData.profileimage || user.photoURL || '') || null;

        if (isMounted) {
          setCurrentUserSummary({
            id: user.uid,
            name: currentName,
            profileImage: currentProfileImage,
          });
          setIsBlockedByCurrentUser(Boolean(otherParticipantId && currentBlockedUsers.includes(otherParticipantId)));
        }

        if (!otherParticipantId) {
          if (isMounted) {
            setOtherUserSummary({ id: null, name: 'User', profileImage: null });
            setIsBlockedByOtherUser(false);
          }
          return;
        }

        const otherUserSnap = await getDoc(doc(db, 'users', otherParticipantId));
        const otherUserData = otherUserSnap.exists() ? otherUserSnap.data() || {} : {};
        const otherBlockedUsers = Array.isArray(otherUserData.blockedUsers) ? otherUserData.blockedUsers : [];

        if (isMounted) {
          setOtherUserSummary({
            id: otherParticipantId,
            name: String(otherUserData.name || otherUserData.displayName || otherUserData.email || 'User'),
            profileImage: String(otherUserData.profileimage || otherUserData.photoURL || '') || null,
          });
          setIsBlockedByOtherUser(otherBlockedUsers.includes(user.uid));
        }
      } catch (error) {
        console.error('Error fetching thread data:', error);
      }
    };

    loadThreadData();

    return () => {
      isMounted = false;
    };
  }, [threadId, user?.displayName, user?.email, user?.photoURL, user?.uid]);

  useEffect(() => {
    if (!threadId || !user?.uid) return undefined;

    const unsubscribeThread = onSnapshot(doc(db, 'threads', threadId), async (threadSnap) => {
      if (!threadSnap.exists()) return;

      const nextThreadData = threadSnap.data() as ThreadRecord;
      setThreadData(nextThreadData);

      const unreadBy = Array.isArray((threadSnap.data() || {}).unreadBy) ? (threadSnap.data() || {}).unreadBy : [];
      if (unreadBy.includes(user.uid)) {
        try {
          await updateDoc(doc(db, 'threads', threadId), {
            unreadBy: arrayRemove(user.uid),
          });
        } catch {
          // Keep the chat usable if read-state writes fail.
        }
      }
    });

    return () => unsubscribeThread();
  }, [threadId, user?.uid]);

  useEffect(() => {
    if (!threadId) return undefined;

    const messagesQuery = firestoreQuery(collection(db, 'threads', threadId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        setChatError('');
        setMessages(snapshot.docs.map((messageDoc) => ({ id: messageDoc.id, ...(messageDoc.data() as Omit<MessageRecord, 'id'>) })));
      },
      (error) => {
        const code = String(error?.code || '');
        if (code.includes('permission-denied') || code.includes('unauthenticated')) {
          setChatError('You no longer have access to this conversation.');
        } else {
          setChatError('Messages could not be loaded right now. Please try again.');
        }
      }
    );

    return () => unsubscribeMessages();
  }, [threadId]);

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (messages.length === 0 || messages.length <= previousCount) return;

    const timeoutId = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: previousCount > 0 });
    }, 80);

    return () => clearTimeout(timeoutId);
  }, [messages.length]);

  const closeReportMenu = () => setShowReportMenu(false);

  const handleBack = () => {
    closeReportMenu();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/messagesbutton');
  };

  const handleViewListing = () => {
    closeReportMenu();
    if (!listingId) return;

    if (listingType === 'pet') {
      router.push({ pathname: '/pet-details', params: { id: listingId } });
      return;
    }

    router.push({ pathname: '/listing', params: { id: listingId } });
  };

  const handleOpenReportMessage = () => {
    if (!threadId) return;
    closeReportMenu();
    router.push({
      pathname: '/(app)/report-message' as any,
      params: {
        threadId,
        listingTitle,
      },
    });
  };

  const handleOpenReportUser = () => {
    if (!otherUserSummary.id) return;
    closeReportMenu();
    router.push({
      pathname: '/(app)/report-user' as any,
      params: {
        threadId,
        userId: otherUserSummary.id,
        userName: otherUserSummary.name,
      },
    });
  };

  const handleBlockToggle = async () => {
    if (!user?.uid || !otherUserSummary.id) return;

    closeReportMenu();

    if (isBlockedByCurrentUser) {
      Alert.alert('Unblock User', 'Do you want to unblock this user? You will be able to send and receive messages again.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', user.uid), {
                blockedUsers: arrayRemove(otherUserSummary.id),
              });
              setIsBlockedByCurrentUser(false);
              Alert.alert('Success', 'User unblocked successfully.');
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user. Please try again.');
            }
          },
        },
      ]);
      return;
    }

    Alert.alert('Block User', 'Are you sure you want to block this user? You will not be able to send or receive messages from them.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              blockedUsers: arrayUnion(otherUserSummary.id),
            });
            setIsBlockedByCurrentUser(true);
            Alert.alert('Success', 'User blocked successfully.');
          } catch (error) {
            console.error('Error blocking user:', error);
            Alert.alert('Error', 'Failed to block user. Please try again.');
          }
        },
      },
    ]);
  };

  const sendMessage = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || !user?.uid || !threadId) return;

    if (isBlockedByCurrentUser) {
      Alert.alert('Messaging Disabled', 'You have blocked this user. Unblock them before sending a new message.');
      return;
    }

    if (isBlockedByOtherUser) {
      Alert.alert('Messaging Disabled', 'This user has blocked you, so you cannot send new messages.');
      return;
    }

    try {
      await addDoc(collection(db, 'threads', threadId, 'messages'), {
        text: trimmedText,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });

      const threadUpdate: Record<string, unknown> = {
        lastMessage: trimmedText,
        lastTimestamp: serverTimestamp(),
      };

      if (otherUserSummary.id) {
        threadUpdate.unreadBy = arrayUnion(otherUserSummary.id);
      }

      await updateDoc(doc(db, 'threads', threadId), threadUpdate);
      setText('');
    } catch (error: unknown) {
      const code = String((error as { code?: string })?.code || '');
      if (code.includes('permission-denied') || code.includes('unauthenticated')) {
        Alert.alert('Message Failed', 'You are not authorized to send messages in this conversation.');
      } else {
        Alert.alert('Message Failed', 'Could not send your message. Please try again.');
      }
    }
  };

  const startEditingMessage = (message: MessageRecord) => {
    if (!message.id || message.senderId !== user?.uid || message.deleted) return;
    setEditingMessageId(message.id);
    setEditingText(String(message.text || ''));
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const saveEditedMessage = async () => {
    if (!threadId || !editingMessageId || !user?.uid) return;

    const trimmedText = editingText.trim();
    if (!trimmedText) {
      Alert.alert('Edit Message', 'Message text cannot be empty.');
      return;
    }

    try {
      await updateDoc(doc(db, 'threads', threadId, 'messages', editingMessageId), {
        text: trimmedText,
        isEdited: true,
        editedBy: user.uid,
        editedAt: serverTimestamp(),
      });
      cancelEditingMessage();
    } catch (error) {
      console.error('Error editing message:', error);
      Alert.alert('Error', 'Failed to edit message. Please try again.');
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!threadId) return;

    Alert.alert('Delete Message', 'Are you sure you want to delete this message? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'threads', threadId, 'messages', messageId), {
              deleted: true,
              deletedAt: serverTimestamp(),
            });
          } catch (error) {
            console.error('Error deleting message:', error);
            Alert.alert('Error', 'Failed to delete message. Please try again.');
          }
        },
      },
    ]);
  };

  const openUserProfile = (userId: string | null) => {
    if (!userId) return;
    router.push({ pathname: '/public-profile', params: { userId } });
  };

  const renderAvatar = (summary: UserSummary, variant: 'sender' | 'receiver') => {
    const avatarContent = summary.profileImage ? (
      <Image source={{ uri: summary.profileImage }} style={styles.avatar} />
    ) : (
      <View style={[styles.avatar, variant === 'sender' ? styles.avatarSenderFallback : styles.avatarReceiverFallback]}>
        <Text style={styles.avatarFallbackText}>{getInitials(summary.name)}</Text>
      </View>
    );

    if (!summary.id) return avatarContent;

    return (
      <TouchableOpacity
        onPress={() => openUserProfile(summary.id)}
        activeOpacity={0.8}
        style={styles.avatarTapTarget}
      >
        {avatarContent}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <Header />
      {showReportMenu ? <Pressable style={styles.menuBackdrop} onPress={closeReportMenu} /> : null}

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 76 : 0}
      >
        <View style={styles.chatShell}>
          <View style={styles.screenTitleRowWrap}>
            <ScreenTitleRow title="Messages" onBackPress={handleBack} />
          </View>

          <View style={styles.contextCard}>
            {listingImage ? (
              <Image source={{ uri: listingImage }} style={styles.listingImage} resizeMode="cover" />
            ) : (
              <View style={styles.listingImagePlaceholder}>
                <Text style={styles.listingImagePlaceholderText}>{getInitials(listingTitle)}</Text>
              </View>
            )}

            <View style={styles.listingInfo}>
              <Text style={styles.listingTitle} numberOfLines={1}>{listingTitle}</Text>
              <Text style={styles.listingSubtitle} numberOfLines={1}>{otherUserSummary.name}</Text>
            </View>

            <View style={styles.contextActions}>
              <TouchableOpacity
                style={[styles.contextButton, !listingId ? styles.contextButtonDisabled : null]}
                onPress={handleViewListing}
                disabled={!listingId}
                activeOpacity={0.85}
              >
                <Text style={[styles.contextButtonText, !listingId ? styles.contextButtonTextDisabled : null]}>View Listing</Text>
              </TouchableOpacity>

              <View style={styles.reportMenuWrap}>
                <TouchableOpacity style={styles.reportButton} onPress={() => setShowReportMenu((open) => !open)} activeOpacity={0.85}>
                  <Text style={styles.reportButtonText}>Report</Text>
                </TouchableOpacity>

                {showReportMenu ? (
                  <View style={styles.reportDropdownMenu}>
                    <TouchableOpacity style={styles.reportMenuItem} onPress={handleOpenReportMessage} activeOpacity={0.85}>
                      <Text style={styles.reportMenuItemText}>Report Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reportMenuItem} onPress={handleOpenReportUser} activeOpacity={0.85}>
                      <Text style={styles.reportMenuItemText}>Report User</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.reportMenuItem, styles.reportMenuItemLast]} onPress={handleBlockToggle} activeOpacity={0.85}>
                      <Text style={[styles.reportMenuItemText, styles.reportMenuItemDanger]}>
                        {isBlockedByCurrentUser ? '✅ Unblock User' : '🚫 Block User'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {chatError ? (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>{chatError}</Text>
            </View>
          ) : null}

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews
            contentContainerStyle={[
              styles.messagesContent,
              { paddingBottom: isMessagingBlocked ? 28 : Math.max(140, insets.bottom + 112) },
            ]}
            renderItem={({ item }) => {
              const isSender = item.senderId === user?.uid;
              const isDeleted = item.deleted === true;
              const isEditingThisMessage = editingMessageId === item.id;
              const summary = isSender ? currentUserSummary : otherUserSummary;
              const timeLabel = formatMessageTime(item.createdAt);

              return (
                <View style={[styles.messageRow, isSender ? styles.messageRowSender : styles.messageRowReceiver]}>
                  {!isSender ? renderAvatar(summary, 'receiver') : null}

                  <View style={styles.messageColumn}>
                    <View style={[styles.bubble, isSender ? styles.bubbleSender : styles.bubbleReceiver]}>
                      {isEditingThisMessage ? (
                        <TextInput
                          style={styles.editInput}
                          value={editingText}
                          onChangeText={setEditingText}
                          multiline
                          autoFocus
                          maxLength={1200}
                        />
                      ) : (
                        <Text style={[styles.messageText, isDeleted ? styles.deletedMessageText : null]}>
                          {isDeleted ? 'Message deleted' : item.text || ''}
                        </Text>
                      )}
                      {timeLabel ? <Text style={styles.messageTime}>{timeLabel}</Text> : null}
                      {item.isEdited && !isDeleted ? <Text style={styles.editedLabel}>Edited</Text> : null}
                    </View>

                    {isSender && !isDeleted ? (
                      <View style={styles.messageActionsRow}>
                        {isEditingThisMessage ? (
                          <>
                            <TouchableOpacity style={styles.messageActionButton} onPress={saveEditedMessage} activeOpacity={0.8}>
                              <Text style={styles.editMessageText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.messageActionButton} onPress={cancelEditingMessage} activeOpacity={0.8}>
                              <Text style={styles.cancelMessageText}>Cancel</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity style={styles.messageActionButton} onPress={() => startEditingMessage(item)} activeOpacity={0.8}>
                              <Text style={styles.editMessageText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.messageActionButton} onPress={() => deleteMessage(item.id)} activeOpacity={0.8}>
                              <Text style={styles.deleteMessageText}>Delete</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    ) : null}
                  </View>

                  {isSender ? renderAvatar(summary, 'sender') : null}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyChatState}>
                <Text style={styles.emptyChatTitle}>No messages yet</Text>
                <Text style={styles.emptyChatText}>Start the conversation by sending the first message.</Text>
              </View>
            }
          />

          {isMessagingBlocked ? (
            <View style={[styles.blockedStateCard, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
              <Text style={styles.blockedStateIcon}>🚫</Text>
              <Text style={styles.blockedStateTitle}>{isBlockedByCurrentUser ? 'You blocked this user' : 'Messaging unavailable'}</Text>
              <Text style={styles.blockedStateText}>{blockedMessage}</Text>
            </View>
          ) : (
            <View style={[styles.inputContainer, { paddingBottom: Math.max(18, insets.bottom + 8) }]}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Type a message..."
                placeholderTextColor="#94a3b8"
                returnKeyType="send"
                onSubmitEditing={sendMessage}
              />
              <Button title="Send" onPress={sendMessage} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  chatShell: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  screenTitleRowWrap: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    zIndex: 50,
  },
  listingImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  listingImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingImagePlaceholderText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e3a8a',
  },
  listingInfo: {
    flex: 1,
    minWidth: 0,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  listingSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  contextActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#ffffff',
  },
  contextButtonDisabled: {
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  contextButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  contextButtonTextDisabled: {
    color: '#94a3b8',
  },
  reportMenuWrap: {
    position: 'relative',
  },
  reportButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#ffffff',
  },
  reportButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
  reportDropdownMenu: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 172,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 60,
    overflow: 'hidden',
  },
  reportMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  reportMenuItemLast: {
    borderBottomWidth: 0,
  },
  reportMenuItemText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  reportMenuItemDanger: {
    color: '#dc2626',
  },
  warningBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 10,
    padding: 12,
  },
  warningBannerText: {
    color: '#9a3412',
    fontSize: 13,
    fontWeight: '600',
  },
  messagesContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowSender: {
    justifyContent: 'flex-end',
  },
  messageRowReceiver: {
    justifyContent: 'flex-start',
  },
  messageColumn: {
    maxWidth: '78%',
  },
  bubble: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  bubbleSender: {
    backgroundColor: '#dcf8c6',
    borderTopRightRadius: 4,
  },
  bubbleReceiver: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    color: '#0f172a',
    fontSize: 15,
    lineHeight: 21,
  },
  deletedMessageText: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  messageTime: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  editedLabel: {
    marginTop: 2,
    fontSize: 10,
    color: '#64748b',
    fontStyle: 'italic',
  },
  editInput: {
    minWidth: 140,
    maxWidth: 240,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0f172a',
    fontSize: 14,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarTapTarget: {
    borderRadius: 16,
  },
  avatarSenderFallback: {
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarReceiverFallback: {
    backgroundColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  messageActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 8,
  },
  messageActionButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  editMessageText: {
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '700',
  },
  cancelMessageText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  deleteMessageText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '700',
  },
  emptyChatState: {
    marginTop: 36,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyChatTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyChatText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  blockedStateCard: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 24,
  },
  blockedStateIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  blockedStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  blockedStateText: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  inputContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 15,
  },
});

export default ThreadChat;