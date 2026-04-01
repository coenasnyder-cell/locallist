
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, arrayRemove, arrayUnion, collection, doc, query as firestoreQuery, getDoc, onSnapshot, orderBy, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase'; // Adjust import if needed
import Header from './Header';

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  messageRowSender: {
    justifyContent: 'flex-end',
  },
  messageRowReceiver: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 18,
    marginHorizontal: 6,
  },
  bubbleSender: {
    backgroundColor: '#dcf8c6',
    borderTopRightRadius: 4,
  },
  bubbleReceiver: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ccc',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    padding: 10,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    fontSize: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e6f0fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
  },
  backText: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  topRowTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  listingCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    gap: 12,
  },
  listingImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  listingImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  listingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  viewListingButton: {
    backgroundColor: '#475569',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  viewListingButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteMessageButton: {
    padding: 4,
    marginLeft: 4,
  },
  deleteMessageText: {
    fontSize: 16,
  },
  reportMenuButton: {
    padding: 8,
    marginRight: 8,
  },
  reportMenuButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  reportDropdownMenu: {
    position: 'absolute',
    right: 8,
    top: 50,
    backgroundColor: '#fff',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 1000,
    minWidth: 180,
  },
  reportMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  reportMenuItemText: {
    fontSize: 14,
    color: '#333',
  },
  reportMenuItemLast: {
    borderBottomWidth: 0,
  },
});

const ThreadChat = () => {
  const params = useLocalSearchParams();
  const router = useRouter();
  const threadId = typeof params.threadId === 'string' ? params.threadId : Array.isArray(params.threadId) ? params.threadId[0] : '';
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(null);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [listingData, setListingData] = useState<{title: string, image: string | null, listingId: string | null}>({
    title: 'Conversation',
    image: null,
    listingId: null
  });
  const [otherUserProfilePic, setOtherUserProfilePic] = useState<string | null>(null);
  const [currentUserProfilePic, setCurrentUserProfilePic] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);
  const previousMessageCountRef = useRef(0);
  const user = getAuth().currentUser;

  const formatMessageTime = (value: any): string => {
    try {
      if (!value) return '';
      if (typeof value?.toDate === 'function') {
        return value.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

 useEffect(() => {
  let isMounted = true;
  let unsubscribe: any;
  let unsubscribeThread: any;

  // Only proceed if threadId is valid
  if (!threadId) {
    return;
  }
  
  // Fetch thread data to get other participant and listing info
  const fetchThreadData = async () => {
    if (!user) return;
    
    try {
      const threadDoc = await getDoc(doc(db, 'threads', threadId));
      if (threadDoc.exists() && isMounted) {
        const threadData = threadDoc.data();
        
        // Set listing data
        setListingData({
          title: threadData?.listingTitle || 'Conversation',
          image: threadData?.listingImage || null,
          listingId: threadData?.listingId || null
        });
        
        const otherUserId = threadData?.participantIds?.find((id: string) => id !== user.uid);
        
        if (otherUserId) {
          setOtherParticipantId(otherUserId);
          
          // Check if current user has blocked other participant
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userBlockedList = userDoc.data()?.blockedUsers || [];
          const currentUserPic = userDoc.data()?.profileimage || null;
          if (isMounted) {
            setCurrentUserProfilePic(currentUserPic);
          }
          
          // Check if other participant has blocked current user
          const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
          const otherBlockedList = otherUserDoc.data()?.blockedUsers || [];
          const otherUserPic = otherUserDoc.data()?.profileimage || null;
          if (isMounted) {
            setOtherUserProfilePic(otherUserPic);
          }
          
          if (isMounted && (userBlockedList.includes(otherUserId) || otherBlockedList.includes(user.uid))) {
            setIsUserBlocked(true);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching thread data:', error);
    }
  };
  
  fetchThreadData();

  // While this chat is open, clear unread state for the current user.
  unsubscribeThread = onSnapshot(doc(db, 'threads', threadId), async (threadSnap) => {
    if (!threadSnap.exists() || !user?.uid) return;
    const unreadBy = (threadSnap.data()?.unreadBy || []) as string[];
    if (unreadBy.includes(user.uid)) {
      try {
        await updateDoc(doc(db, 'threads', threadId), {
          unreadBy: arrayRemove(user.uid),
        });
      } catch {
        // Keep chat usable even if read-state update fails.
      }
    }
  });
  
  const q = firestoreQuery(
    collection(db, 'threads', threadId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  unsubscribe = onSnapshot(
    q,
    (snapshot: any) => {
      if (isMounted) {
        setChatError('');
        setMessages(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      }
    },
    (error: any) => {
      if (!isMounted) return;
      const code = String(error?.code || '');
      if (code.includes('permission-denied') || code.includes('unauthenticated')) {
        setChatError('You no longer have access to this conversation.');
      } else {
        setChatError('Messages could not be loaded right now. Please try again.');
      }
    }
  );

  return () => {
    isMounted = false;
    if (unsubscribe) {
      unsubscribe();
    }
    if (unsubscribeThread) {
      unsubscribeThread();
    }
  };
}, [threadId, user]);

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (messages.length === 0 || messages.length <= previousCount) return;

    const timeoutId = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: previousCount > 0 });
    }, 80);

    return () => clearTimeout(timeoutId);
  }, [messages.length]);

  const sendMessage = async () => {
    if (!text.trim() || !user || !threadId) return;
    
    if (isUserBlocked) {
      alert('You cannot message this user because they have blocked you or you have blocked them.');
      return;
    }
    
    try {
      await addDoc(collection(db, 'threads', threadId, 'messages'), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'threads', threadId), {
        lastMessage: text,
        lastTimestamp: serverTimestamp(),
      });
      setText('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      const code = String(error?.code || '');
      if (code.includes('permission-denied') || code.includes('unauthenticated')) {
        Alert.alert('Message Failed', 'You are not authorized to send messages in this conversation.');
      } else {
        Alert.alert('Message Failed', 'Could not send your message. Please try again.');
      }
    }
  };

  const deleteMessage = async (messageId: string) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'threads', threadId, 'messages', messageId), {
                deleted: true,
                deletedAt: Timestamp.now()
              });
            } catch (error) {
              console.error('Error deleting message:', error);
              Alert.alert('Error', 'Failed to delete message. Please try again.');
            }
          }
        }
      ]
    );
  };

  const reportMessage = async () => {
    Alert.alert('Report Message', 'Report this conversation to our moderators?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          try {
            await addDoc(collection(db, 'messageReports'), {
              threadId,
              reportedBy: user?.uid,
              reportedUserId: otherParticipantId,
              explanation: 'Reported from Messages',
              createdAt: serverTimestamp(),
              status: 'pending'
            });
            Alert.alert('Success', 'Report submitted successfully.');
            setShowReportMenu(false);
          } catch (error) {
            console.error('Error reporting message:', error);
            Alert.alert('Error', 'Failed to report. Please try again.');
          }
        }
      }
    ]);
  };

  const reportUser = async () => {
    Alert.alert('Report User', 'Why are you reporting this user?', [
      {
        text: 'Spam',
        onPress: async () => {
          try {
            await addDoc(collection(db, 'userReports'), {
              reportedUserId: otherParticipantId,
              reportedBy: user?.uid,
              reason: 'spam',
              explanation: 'Reported from Messages',
              createdAt: serverTimestamp(),
              status: 'pending'
            });
            Alert.alert('Success', 'User reported successfully.');
            setShowReportMenu(false);
          } catch (error) {
            console.error('Error reporting user:', error);
            Alert.alert('Error', 'Failed to report user. Please try again.');
          }
        }
      },
      { text: 'Harassment', onPress: async () => {
          try {
            await addDoc(collection(db, 'userReports'), {
              reportedUserId: otherParticipantId,
              reportedBy: user?.uid,
              reason: 'harassment',
              explanation: 'Reported from Messages',
              createdAt: serverTimestamp(),
              status: 'pending'
            });
            Alert.alert('Success', 'User reported successfully.');
            setShowReportMenu(false);
          } catch (error) {
            alert('Error reporting user');
          }
        }
      },
      { text: 'Scam', onPress: async () => {
          try {
            await addDoc(collection(db, 'userReports'), {
              reportedUserId: otherParticipantId,
              reportedBy: user?.uid,
              reason: 'scam',
              explanation: 'Reported from Messages',
              createdAt: serverTimestamp(),
              status: 'pending'
            });
            Alert.alert('Success', 'User reported successfully.');
            setShowReportMenu(false);
          } catch (error) {
            alert('Error reporting user');
          }
        }
      },
      { text: 'Cancel', style: 'cancel', onPress: () => setShowReportMenu(false) }
    ]);
  };

  const blockUser = async () => {
    Alert.alert('Block User', 'Are you sure you want to block this user? You will not be able to send or receive messages from them.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'users', user!.uid), {
              blockedUsers: arrayUnion(otherParticipantId)
            });
            setIsUserBlocked(true);
            setShowReportMenu(false);
            Alert.alert('Success', 'User blocked successfully.');
          } catch (error) {
            console.error('Error blocking user:', error);
            Alert.alert('Error', 'Failed to block user. Please try again.');
          }
        }
      }
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <View style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
        {/* Custom row above messages */}
        <View style={styles.topRow}>
          <Text style={styles.backText} onPress={() => router.push('/(tabs)/messagesbutton')}>{'< Back To Messages'}</Text>
          <Text style={styles.topRowTitle}></Text>
          <TouchableOpacity 
            style={styles.reportMenuButton}
            onPress={() => setShowReportMenu(!showReportMenu)}
          >
            <Text style={styles.reportMenuButtonText}>⋮</Text>
          </TouchableOpacity>
          {showReportMenu && (
            <View style={styles.reportDropdownMenu}>
              <TouchableOpacity style={styles.reportMenuItem} onPress={reportMessage}>
                <Text style={styles.reportMenuItemText}>Report Conversation</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportMenuItem} onPress={reportUser}>
                <Text style={styles.reportMenuItemText}>Report User</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.reportMenuItem, styles.reportMenuItemLast]} onPress={blockUser}>
                <Text style={[styles.reportMenuItemText, { color: '#d9534f' }]}>🚫 Block User</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {chatError ? (
          <View style={{ marginHorizontal: 10, marginTop: 8, backgroundColor: '#fff3cd', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 8, padding: 10 }}>
            <Text style={{ color: '#92400e', fontSize: 13, fontWeight: '600' }}>{chatError}</Text>
          </View>
        ) : null}

        {/* Listing Card */}
        {listingData.listingId && (
          <View style={styles.listingCard}>
            {listingData.image ? (
              <Image 
                source={{ uri: listingData.image }} 
                style={styles.listingImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.listingImagePlaceholder}>
                <Text style={{ color: '#999', fontSize: 12 }}>No Image</Text>
              </View>
            )}
            <View style={styles.listingInfo}>
              <Text style={styles.listingTitle} numberOfLines={2}>
                {listingData.title}
              </Text>
              <TouchableOpacity 
                style={styles.viewListingButton}
                onPress={() => router.push({
                  pathname: '/listing',
                  params: { id: listingData.listingId }
                })}
              >
                <Text style={styles.viewListingButtonText}>View Listing</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          renderItem={({ item }) => {
            const isSender = item.senderId === user?.uid;
            const isDeleted = item.deleted === true;
            const profilePic = isSender ? currentUserProfilePic : otherUserProfilePic;
            
            return (
              <View
                style={[
                  styles.messageRow,
                  isSender ? styles.messageRowSender : styles.messageRowReceiver,
                ]}
              >
                {!isSender && (
                  profilePic ? (
                    <Image 
                      source={{ uri: profilePic }} 
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: '#bbb' }]} />
                  )
                )}
                <View style={[styles.bubble, isSender ? styles.bubbleSender : styles.bubbleReceiver]}>
                  <Text style={{ color: isDeleted ? '#999' : '#222', fontStyle: isDeleted ? 'italic' : 'normal' }}>
                    {isDeleted ? 'Message deleted' : item.text}
                  </Text>
                  {!!formatMessageTime(item.createdAt) && (
                    <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                      {formatMessageTime(item.createdAt)}
                    </Text>
                  )}
                </View>
                {isSender && !isDeleted && (
                  <TouchableOpacity 
                    style={styles.deleteMessageButton}
                    onPress={() => deleteMessage(item.id)}
                  >
                    <Text style={styles.deleteMessageText}>🗑️</Text>
                  </TouchableOpacity>
                )}
                {isSender && isDeleted && (
                  currentUserProfilePic ? (
                    <Image 
                      source={{ uri: currentUserProfilePic }} 
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: '#bbb' }]} />
                  )
                )}
              </View>
            );
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        />
        {isUserBlocked ? (
          <View style={[styles.inputContainer, { position: 'relative', height: 'auto', bottom: 0, padding: 16 }]}>
            <View style={{ alignItems: 'center', padding: 12 }}>
              <Text style={{ fontSize: 24, marginBottom: 8 }}>🚫</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}>You have blocked this user</Text>
              <Text style={{ fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' }}>
                You cannot view or send messages until you unblock them
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor="#aaa"
              returnKeyType="send"
              onSubmitEditing={sendMessage}
            />
            <Button title="Send" onPress={sendMessage} />
          </View>
        )}
      </View>
    </View>
  );
};

export default ThreadChat;