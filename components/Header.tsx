import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ImageSourcePropType, ViewStyle } from 'react-native';
import { Alert, Animated, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';
import { signOutNativeGoogle } from '../utils/nativeGoogleAuth';


type HeaderProps = {
  onMenuPress?: () => void;
  onSearchPress?: () => void;
  onNotificationsPress?: () => void;
  logoSource?: ImageSourcePropType;
  showTitle?: boolean;
  compact?: boolean;
  style?: ViewStyle;
};

type ThreadPreview = {
  id: string;
  listingTitle?: string;
  lastMessage?: string;
  lastTimestamp?: any;
  unreadBy?: string[];
};

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: '#f0f8fc',
  },
  safeArea: {
    backgroundColor: '#f0f8fc',
  },
  container: {
    height: 60,
    paddingHorizontal: 12,
    paddingBottom: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  menuButton: {
    padding: 6,
  },
  hamburger: {
    width: 22,
    height: 2.5,
    backgroundColor: '#333',
    borderRadius: 2,
    marginBottom: 3.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoButton: {
    width: 64,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoButtonCompact: {
    paddingTop: 0,
  },
  logo: {
    width: 100,
    height: 150,
    resizeMode: 'contain',
  },
  logoCompact: {
    width: 72,
    height: 72,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    position: 'relative',
  },
  rightButton: {
    padding: 6,
  },
  profileButton: {
    padding: 5,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  bellWrap: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 2,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  notificationsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  notificationsModalRoot: {
    flex: 1,
  },
  notificationsDropdown: {
    position: 'absolute',
    top: 66,
    right: 10,
    width: 300,
    maxHeight: 360,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
  },
  notificationsHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  notificationsHeaderText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  notificationItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  notificationItemTitle: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  notificationItemMessage: {
    color: '#475569',
    marginTop: 2,
    fontSize: 12,
  },
  notificationItemEmpty: {
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  notificationItemEmptyText: {
    color: '#64748b',
    fontSize: 13,
  },
  notificationFooterButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  notificationFooterText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 280,
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  sidebarTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 3,
    borderRadius: 6,
  },
  menuItemText: {
    fontSize: 15,
    color: '#333',
  },
});

export default function Header({
  onMenuPress,
  onSearchPress,
  onNotificationsPress,
  logoSource = require('../assets/images/logo.png'),
  showTitle = false,
  compact = false,
  style,
}: HeaderProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [threadPreviews, setThreadPreviews] = useState<ThreadPreview[]>([]);
  const [slideAnim] = useState(new Animated.Value(-280));
  const isMountedRef = useRef(true);
  const router = useRouter();
  const { user, loading, isAdmin } = useAccountStatus();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      slideAnim.stopAnimation();
    };
  }, [slideAnim]);

  useEffect(() => {
    if (!user?.uid) {
      setThreadPreviews([]);
      return undefined;
    }

    const threadsQuery = query(collection(db, 'threads'), where('participantIds', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(
      threadsQuery,
      (snapshot) => {
        if (!isMountedRef.current) return;
        const rows = snapshot.docs.map((threadDoc) => ({ id: threadDoc.id, ...(threadDoc.data() as Omit<ThreadPreview, 'id'>) }));
        const unread = rows
          .filter((thread) => (thread.unreadBy || []).includes(user.uid))
          .sort((a, b) => {
            const aTime = typeof a.lastTimestamp?.toMillis === 'function' ? a.lastTimestamp.toMillis() : 0;
            const bTime = typeof b.lastTimestamp?.toMillis === 'function' ? b.lastTimestamp.toMillis() : 0;
            return bTime - aTime;
          })
          .slice(0, 6);
        setThreadPreviews(unread);
      },
      () => {
        if (!isMountedRef.current) return;
        setThreadPreviews([]);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const unreadCount = useMemo(() => threadPreviews.length, [threadPreviews]);

  const handleMenuPress = () => {
    setMenuVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    if (onMenuPress) onMenuPress();
  };

  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: -280,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (isMountedRef.current) {
        setMenuVisible(false);
      }
    });
  };

  const handleNavigate = (path: string) => {
    closeMenu();
    if (Platform.OS === 'web') {
      // For web, use window.location for HTML pages
      if (path.endsWith('.html')) {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        window.location.href = `${window.location.origin}${normalizedPath}`;
      } else {
        router.push(path as any);
      }
    } else {
      router.push(path as any);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#f0f8fc', '#f9f9f9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.container, style]}
        >
          <View style={styles.left}>
            <TouchableOpacity
              onPress={handleMenuPress}
              accessibilityLabel="Open menu"
              style={styles.menuButton}
            >
              <View style={styles.hamburger} />
              <View style={styles.hamburger} />
              <View style={styles.hamburger} />
          </TouchableOpacity>
        </View>

        <View style={styles.center}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            accessibilityLabel="App logo"
            style={[styles.logoButton, compact && styles.logoButtonCompact]}
          >
            <Image source={logoSource} style={[styles.logo, compact && styles.logoCompact]} accessibilityLabel="Local List logo" />
          </TouchableOpacity>
        </View>

        <View style={styles.right}>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => router.push('/admin')}
              accessibilityLabel="Admin Dashboard"
              style={styles.rightButton}
            >
              <Ionicons name="shield-outline" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          )}

          {!user && !loading && (
            <TouchableOpacity
              onPress={() => router.push('/signInOrSignUp')}
              accessibilityLabel="Login"
              style={styles.rightButton}
            >
              <Ionicons name="person-circle-outline" size={20} color="#333" />
            </TouchableOpacity>
          )}

          {user && (
            <>
              <TouchableOpacity
                onPress={() => {
                  if (onNotificationsPress) {
                    onNotificationsPress();
                    return;
                  }
                  setNotificationsVisible((prev) => !prev);
                }}
                accessibilityLabel="Notifications"
                style={[styles.rightButton, styles.bellWrap]}
              >
                <Ionicons name="notifications-outline" size={21} color="#334155" />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profilebutton')}
                accessibilityLabel="Profile"
                style={[styles.rightButton, styles.profileButton]}
              >
                <Ionicons name="person-circle" size={24} color="#334155" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const auth = getAuth();
                    await Promise.allSettled([signOut(auth), signOutNativeGoogle()]);
                    router.replace('/');
                    Alert.alert('Signed out', 'You are now signed out.');
                  } catch (e) {
                    Alert.alert('Error', 'Sign out failed.');
                  }
                }}
                accessibilityLabel="Log out"
                style={styles.rightButton}
              >
                <Feather name="log-out" size={18} color="#333" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </LinearGradient>

      <Modal
        transparent
        visible={notificationsVisible}
        animationType="fade"
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <View style={styles.notificationsModalRoot}>
          <TouchableOpacity style={styles.notificationsOverlay} activeOpacity={1} onPress={() => setNotificationsVisible(false)} />
          <View style={styles.notificationsDropdown}>
            <View style={styles.notificationsHeader}>
              <Text style={styles.notificationsHeaderText}>New Messages</Text>
            </View>
            {threadPreviews.length === 0 ? (
              <View style={styles.notificationItemEmpty}>
                <Text style={styles.notificationItemEmptyText}>No new messages right now.</Text>
              </View>
            ) : (
              threadPreviews.map((thread) => (
                <TouchableOpacity
                  key={thread.id}
                  style={styles.notificationItem}
                  onPress={() => {
                    setNotificationsVisible(false);
                    if (Platform.OS === 'web') {
                      handleNavigate('messages.html');
                    } else {
                      router.push({ pathname: '/threadchat', params: { threadId: thread.id } });
                    }
                  }}
                >
                  <Text style={styles.notificationItemTitle} numberOfLines={1}>{thread.listingTitle || 'New message'}</Text>
                  <Text style={styles.notificationItemMessage} numberOfLines={1}>{thread.lastMessage || 'Tap to open conversation'}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={styles.notificationFooterButton}
              onPress={() => {
                setNotificationsVisible(false);
                if (Platform.OS === 'web') {
                  handleNavigate('messages.html');
                } else {
                  router.push('/(tabs)/messagesbutton');
                }
              }}
            >
              <Text style={styles.notificationFooterText}>View all messages</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={menuVisible}
        animationType="none"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <Animated.View
            style={[
              styles.sidebar,
              { transform: [{ translateX: slideAnim }] }
            ]}
          >
            <Text style={styles.sidebarTitle}>Menu</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigate(Platform.OS === 'web' ? 'index.html' : '/(tabs)')}
            >
              <Text style={styles.menuItemText}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigate(Platform.OS === 'web' ? 'browse.html' : '/(tabs)/browsebutton')}
            >
              <Text style={styles.menuItemText}>Marketplace</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigate(Platform.OS === 'web' ? 'featured-listings.html' : '/(tabs)/communitybutton')}
            >
              <Text style={styles.menuItemText}>Community Hub</Text>
            </TouchableOpacity>

            {user && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate(Platform.OS === 'web' ? 'messages.html' : '/(tabs)/messagesbutton')}
              >
                <Text style={styles.menuItemText}>Messages</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigate(Platform.OS === 'web' ? 'support-legal-hub.html' : '/(tabs)/supporthubbutton')}
            >
              <Text style={styles.menuItemText}>Support and Legal Hub</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
      </View>
    </SafeAreaView>
  );
}
