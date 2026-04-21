import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import type { ImageSourcePropType, ViewStyle } from 'react-native';
import { Alert, Animated, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccountStatus } from '../hooks/useAccountStatus';
import { signOutNativeGoogle } from '../utils/nativeGoogleAuth';

type HeaderProps = {
  onMenuPress?: () => void;
  onSearchPress?: () => void;
  logoSource?: ImageSourcePropType;
  showTitle?: boolean;
  compact?: boolean;
  style?: ViewStyle;
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
  logoSource = require('../assets/images/logo.png'),
  showTitle = false,
  compact = false,
  style,
}: HeaderProps) {
  const [menuVisible, setMenuVisible] = useState(false);
 const slideAnim = useRef(new Animated.Value(-280)).current;
  const isMountedRef = useRef(true);
  const router = useRouter();
  const { user, loading, isAdmin } = useAccountStatus();

  useEffect(() => {
    console.log('[Header] mounted');
    isMountedRef.current = true;
    return () => {
      console.log('[Header] unmounted');
      isMountedRef.current = false;
      slideAnim.stopAnimation();
    };
  }, [slideAnim]);

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

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
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
            onPress={() => handleNavigate('/(tabs)/index')}
            accessibilityLabel="App logo"
            style={[styles.logoButton, compact && styles.logoButtonCompact]}
          >
            <Image source={logoSource} style={[styles.logo, compact && styles.logoCompact]} contentFit="contain" accessibilityLabel="Local List logo" />
          </TouchableOpacity>
        </View>

        <View style={styles.right}>
          {!user && !loading && (
            <TouchableOpacity
              onPress={() => handleNavigate('/signInOrSignUp')}
              accessibilityLabel="Login"
              style={styles.rightButton}
            >
              <Ionicons name="person-circle-outline" size={20} color="#333" />
            </TouchableOpacity>
          )}

          {user && (
            <>
              <TouchableOpacity
                onPress={() => handleNavigate('/(app)/support-hub')}
                accessibilityLabel="Support"
                style={styles.rightButton}
              >
                <Ionicons name="help-circle-outline" size={24} color="#334155" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const auth = getAuth();
                    await Promise.allSettled([signOut(auth), signOutNativeGoogle()]);
                    router.replace('/publiclanding' as any);
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
              onPress={() => handleNavigate(Platform.OS === 'web' ? 'support-legal-hub.html' : '/(app)/support-hub')}
            >
              <Text style={styles.menuItemText}>Support and Legal Hub</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
      </View>
    </View>
  );
}
