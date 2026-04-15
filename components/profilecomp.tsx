import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';
import CommunityDisclosures from './CommunityDisclosures';
import EditBusinessProfileComp from './EditBusinessProfileComp';
import ManageBlockedUsers from './ManageBlockedUsers';
import SimpleSettingsPage from './SimpleSettingsPage';

type SectionKey = 'marketplace' | 'eventsYardSales' | 'pets' | 'services';
type SectionTab = 'active' | 'saved' | 'sold' | 'archived';
type OnboardingStepKey = 'verifyEmail' | 'completeProfile' | 'postFirstListing' | 'readMessages' | 'firstSale';

type AnyItem = Record<string, any>;

const SECTION_LABELS: Record<SectionKey, string> = {
  marketplace: 'Marketplace',
  eventsYardSales: 'Events / Yard Sales',
  pets: 'Pets',
  services: 'Services',
};

const TAB_OPTIONS: { key: SectionTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'saved', label: 'Saved' },
  { key: 'sold', label: 'Sold' },
  { key: 'archived', label: 'Archived/Expired' },
];

const ONBOARDING_CHECKS_STORAGE_KEY = 'profile-onboarding-checks-v1';

function defaultOnboardingChecks(): Record<OnboardingStepKey, boolean> {
  return {
    verifyEmail: false,
    completeProfile: false,
    postFirstListing: false,
    readMessages: false,
    firstSale: false,
  };
}

function toDate(value: any): Date | null {
  if (!value) return null;
  try {
    if (typeof value?.toDate === 'function') {
      const parsed = value.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function isPastDate(value: any): boolean {
  const parsed = toDate(value);
  if (!parsed) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return day < now;
}

function normalizeSavedSection(item: AnyItem): SectionKey {
  const listingType = String(item?.listingType || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();

  if (listingType === 'event' || category.includes('yard sale') || category.includes('yardsale') || category.includes('yard-sale')) {
    return 'eventsYardSales';
  }

  if (listingType === 'pet' || category.includes('pet')) {
    return 'pets';
  }

  if (listingType === 'service' || category.includes('service')) {
    return 'services';
  }

  return 'marketplace';
}

export default function Profile() {
  const router = useRouter();
  const { user, profile, isAdmin, isBusinessAccount } = useAccountStatus();
  const isMountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [savedListings, setSavedListings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [yardSales, setYardSales] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);

  const [showSettings, setShowSettings] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showEditBusiness, setShowEditBusiness] = useState(false);
  const [manualOnboardingChecks, setManualOnboardingChecks] = useState<Record<OnboardingStepKey, boolean>>(defaultOnboardingChecks());

  const [sectionTabs, setSectionTabs] = useState<Record<SectionKey, SectionTab>>({
    marketplace: 'active',
    eventsYardSales: 'active',
    pets: 'active',
    services: 'active',
  });
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionKey, boolean>>({
    marketplace: false,
    eventsYardSales: false,
    pets: false,
    services: false,
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRequestIdRef.current += 1;
    };
  }, []);

  const fetchData = async () => {
    if (!user?.uid) return;

    const requestId = ++fetchRequestIdRef.current;

    try {
      const db = getFirestore(app);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;
      setUserProfile(userDoc.exists() ? userDoc.data() : null);

      const [listingsSnap, savedSnap, servicesSnap, eventsSnap, yardsSnap, petsSnap] = await Promise.all([
        getDocs(query(collection(db, 'listings'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'saveListings'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'services'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'events'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'yardSales'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'pets'), where('userId', '==', user.uid))),
      ]);

      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;

      setListings(listingsSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
      setSavedListings(savedSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
      setServices(servicesSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
      setEvents(eventsSnap.docs.map((item) => ({ id: item.id, __kind: 'event', ...item.data() })));
      setYardSales(yardsSnap.docs.map((item) => ({ id: item.id, __kind: 'yardsale', ...item.data() })));
      setPets(petsSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (error) {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;
      console.error('Error loading profile data:', error);
    }
  };

  const removeSavedListing = async (docId: string) => {
    try {
      const db = getFirestore(app);
      await deleteDoc(doc(db, 'saveListings', docId));
      fetchData();
    } catch {
      Alert.alert('Error', 'Could not remove saved listing.');
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
      return () => {
        fetchRequestIdRef.current += 1;
      };
    }, [user?.uid])
  );

  useEffect(() => {
    if (profile && isMountedRef.current) {
      setUserProfile((prev: any) => ({ ...(prev || {}), ...profile }));
    }
  }, [profile]);

  useEffect(() => {
    if (showEditBusiness && !isBusinessAccount && isMountedRef.current) {
      setShowEditBusiness(false);
    }
  }, [isBusinessAccount, showEditBusiness]);

  const activeMarketplaceCount = useMemo(
    () => listings.filter((item) => !['sold', 'archived', 'deleted'].includes(String(item.status || '').toLowerCase())).length,
    [listings]
  );

  const soldMarketplaceCount = useMemo(
    () => listings.filter((item) => String(item.status || '').toLowerCase() === 'sold').length,
    [listings]
  );

  useEffect(() => {
    let isMounted = true;

    const loadManualChecks = async () => {
      if (!user?.uid) {
        if (isMounted) setManualOnboardingChecks(defaultOnboardingChecks());
        return;
      }

      try {
        const key = `${ONBOARDING_CHECKS_STORAGE_KEY}:${user.uid}`;
        const saved = await AsyncStorage.getItem(key);
        if (!isMounted) return;

        if (!saved) {
          setManualOnboardingChecks(defaultOnboardingChecks());
          return;
        }

        const parsed = JSON.parse(saved) as Partial<Record<OnboardingStepKey, boolean>>;
        setManualOnboardingChecks({
          ...defaultOnboardingChecks(),
          ...parsed,
        });
      } catch {
        if (isMounted) setManualOnboardingChecks(defaultOnboardingChecks());
      }
    };

    loadManualChecks();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const setManualOnboardingStep = (step: OnboardingStepKey, completed: boolean) => {
    setManualOnboardingChecks((prev) => {
      const next = { ...prev, [step]: completed };
      if (user?.uid) {
        const key = `${ONBOARDING_CHECKS_STORAGE_KEY}:${user.uid}`;
        AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => undefined);
      }
      return next;
    });
  };

  const toggleManualOnboardingStep = (step: OnboardingStepKey) => {
    setManualOnboardingStep(step, !manualOnboardingChecks[step]);
  };

  const hasVerifiedEmail = Boolean(user?.emailVerified) || manualOnboardingChecks.verifyEmail;
  const hasCompletedProfile = Boolean(
    (userProfile?.name || userProfile?.displayName || user?.displayName) &&
    (userProfile?.zipCode || userProfile?.zip || userProfile?.city)
  ) || manualOnboardingChecks.completeProfile;
  const totalOwnedPosts = listings.length + services.length + events.length + yardSales.length + pets.length;
  const hasPostedFirstListing = totalOwnedPosts > 0 || manualOnboardingChecks.postFirstListing;
  const hasReadMessages = manualOnboardingChecks.readMessages;
  const hasFirstSale = soldMarketplaceCount > 0 || manualOnboardingChecks.firstSale;
  const onboardingCompletedSteps = [hasVerifiedEmail, hasCompletedProfile, hasPostedFirstListing, hasReadMessages, hasFirstSale].filter(Boolean).length;

  const getSectionItems = (section: SectionKey, tab: SectionTab): AnyItem[] => {
    if (section === 'marketplace') {
      if (tab === 'saved') return savedListings.filter((item) => normalizeSavedSection(item) === 'marketplace');
      if (tab === 'sold') return listings.filter((item) => String(item.status || '').toLowerCase() === 'sold');
      if (tab === 'archived') {
        return listings.filter((item) => {
          const status = String(item.status || '').toLowerCase();
          return status === 'archived' || status === 'expired' || status === 'deleted';
        });
      }

      return listings.filter((item) => {
        const status = String(item.status || '').toLowerCase();
        return status !== 'sold' && status !== 'archived' && status !== 'deleted';
      });
    }

    if (section === 'eventsYardSales') {
      const combined = [...events, ...yardSales];

      if (tab === 'saved') return savedListings.filter((item) => normalizeSavedSection(item) === 'eventsYardSales');
      if (tab === 'sold') return [];
      if (tab === 'archived') {
        return combined.filter((item) => {
          const status = String(item.eventStatus || item.yardsalestatus || '').toLowerCase();
          const endDate = item.eventEndDate || item.yardsaleEndDate || item.yardsaleExpires || item.eventDate || item.yardsaleDate;
          return status === 'cancelled' || status === 'archived' || status === 'expired' || isPastDate(endDate);
        });
      }

      return combined.filter((item) => {
        const status = String(item.eventStatus || item.yardsalestatus || '').toLowerCase();
        const endDate = item.eventEndDate || item.yardsaleEndDate || item.yardsaleExpires || item.eventDate || item.yardsaleDate;
        return status !== 'cancelled' && status !== 'archived' && status !== 'expired' && !isPastDate(endDate);
      });
    }

    if (section === 'pets') {
      if (tab === 'saved') return savedListings.filter((item) => normalizeSavedSection(item) === 'pets');
      if (tab === 'sold') {
        return pets.filter((item) => {
          const status = String(item.petStatus || '').toLowerCase();
          return status === 'adopted' || status === 'reunited';
        });
      }
      if (tab === 'archived') {
        return pets.filter((item) => {
          const status = String(item.petStatus || '').toLowerCase();
          return status === 'archived' || status === 'expired' || status === 'closed';
        });
      }

      return pets.filter((item) => {
        const status = String(item.petStatus || '').toLowerCase();
        return status !== 'adopted' && status !== 'reunited' && status !== 'archived' && status !== 'expired' && status !== 'closed';
      });
    }

    if (tab === 'saved') return savedListings.filter((item) => normalizeSavedSection(item) === 'services');
    if (tab === 'sold') {
      return services.filter((item) => {
        const status = String(item.status || '').toLowerCase();
        return status === 'sold' || status === 'completed';
      });
    }
    if (tab === 'archived') {
      return services.filter((item) => {
        const status = String(item.status || '').toLowerCase();
        return status === 'archived' || status === 'expired' || status === 'inactive' || status === 'rejected';
      });
    }

    return services.filter((item) => {
      const status = String(item.status || '').toLowerCase();
      return status !== 'archived' && status !== 'expired' && status !== 'inactive' && status !== 'rejected' && status !== 'sold' && status !== 'completed';
    });
  };

  const getItemTitle = (section: SectionKey, item: AnyItem): string => {
    if (section === 'eventsYardSales') {
      if (item.__kind === 'event') return item.eventTitle || 'Event';
      return item.yardsaleTitle || 'Yard Sale';
    }
    if (section === 'pets') return item.petName || item.title || 'Pet Listing';
    if (section === 'services') return item.serviceName || item.title || 'Service';
    return item.title || 'Listing';
  };

  const getItemSubtitle = (section: SectionKey, item: AnyItem): string => {
    if (section === 'eventsYardSales') {
      const start = toDate(item.eventDate || item.yardsaleDate);
      const end = toDate(item.eventEndDate || item.yardsaleEndDate || item.yardsaleExpires || item.eventDate || item.yardsaleDate);
      if (start && end) {
        const startText = start.toLocaleDateString();
        const endText = end.toLocaleDateString();
        return startText === endText ? startText : `${startText} - ${endText}`;
      }
      return item.eventCity || item.yardsalelocation || 'Date pending';
    }

    if (section === 'pets') return item.petType || item.petStatus || 'Pet';
    if (section === 'services') return item.category || item.priceType || 'Service';

    if (typeof item.price === 'number') return `$${item.price}`;
    return item.category || 'Marketplace';
  };

  const getItemImage = (section: SectionKey, item: AnyItem): string | null => {
    if (section === 'eventsYardSales') return item.eventImage || item.yardsaleImage || item.image || null;
    if (section === 'pets') return item.petImages?.[0] || item.image || null;
    if (section === 'services') return item.serviceImage || item.businessLogo || item.image || null;
    return item.images?.[0] || item.image || null;
  };

  const openCreateHub = () => {
    router.push('/(tabs)/listbutton');
  };

  const handleOpenItem = (section: SectionKey, tab: SectionTab, item: AnyItem) => {
    if (tab === 'saved' && item.id) {
      if (section === 'eventsYardSales') {
        const listingType = String(item.listingType || '').toLowerCase();
        const category = String(item.category || '').toLowerCase();
        if (listingType === 'event') {
          router.push('/(app)/eventslist');
          return;
        }
        if (category.includes('yard sale') || category.includes('yardsale') || category.includes('yard-sale')) {
          router.push('/(app)/yardsalelistings');
          return;
        }
      }

      if (section === 'pets') {
        const petId = item.listingId || item.id;
        router.push({ pathname: '/pet-details', params: { id: petId } });
        return;
      }

      if (section === 'marketplace') {
        const listingId = item.listingId || item.id;
        if (listingId) {
          router.push({ pathname: '/listing', params: { id: listingId } });
        }
      }
      return;
    }

    if (section === 'marketplace') {
      router.push({ pathname: '/listing', params: { id: item.id } });
      return;
    }

    if (section === 'eventsYardSales') {
      if (item.__kind === 'event') router.push('/(app)/eventslist');
      else router.push('/(app)/yardsalelistings');
      return;
    }

    if (section === 'pets') {
      router.push({ pathname: '/pet-details', params: { id: item.id } });
    }
  };

  const toggleSectionCollapsed = (section: SectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!user) return null;

  if (showSettings) {
    return (
      <SimpleSettingsPage
        onClose={() => {
          setShowSettings(false);
          fetchData();
        }}
      />
    );
  }

  if (showEditBusiness) {
    if (!isBusinessAccount) return null;

    return (
      <View style={styles.container}>
        <View style={styles.guidelinesHeader}>
          <TouchableOpacity
            onPress={() => {
              setShowEditBusiness(false);
              fetchData();
            }}
          >
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.guidelinesTitle}>Edit Business Profile</Text>
          <View style={{ width: 24 }} />
        </View>
        <EditBusinessProfileComp
          onClose={() => {
            setShowEditBusiness(false);
            fetchData();
          }}
        />
      </View>
    );
  }

  if (showGuidelines) {
    return (
      <View style={styles.container}>
        <View style={styles.guidelinesHeader}>
          <TouchableOpacity onPress={() => setShowGuidelines(false)}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.guidelinesTitle}>Guidelines</Text>
          <View style={{ width: 24 }} />
        </View>
        <CommunityDisclosures />
      </View>
    );
  }

  if (showBlockedUsers) {
    return (
      <View style={styles.container}>
        <View style={styles.guidelinesHeader}>
          <TouchableOpacity onPress={() => setShowBlockedUsers(false)}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.guidelinesTitle}>Blocked Users</Text>
          <View style={{ width: 24 }} />
        </View>
        <ManageBlockedUsers />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.row1}>
        <View style={styles.profilePhotoSection}>
          {userProfile?.profileimage ? (
            <Image source={{ uri: userProfile.profileimage }} style={styles.profilePhoto} />
          ) : (
            <View style={styles.profilePhotoPlaceholder}>
              <Feather name="user" size={40} color="#bbb" />
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{userProfile?.name || user.displayName || 'User'}</Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity onPress={() => router.push('/admin')} style={{ marginRight: 12 }}>
            <Feather name="shield" size={24} color="#F44336" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => setShowSettings(true)} style={{ marginRight: 12 }}>
          <Feather name="settings" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.row2}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{activeMarketplaceCount}</Text>
          <Text style={styles.statTitle}>Active</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{soldMarketplaceCount}</Text>
          <Text style={styles.statTitle}>Sold</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{savedListings.length}</Text>
          <Text style={styles.statTitle}>Saved</Text>
        </View>
      </View>

      {!isBusinessAccount ? (
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Welcome to Local List! We are happy to have you here!</Text>
          <Text style={styles.welcomeSubtitle}>Here are some action steps to help:</Text>

          <View style={styles.welcomeStepRow}>
            <TouchableOpacity onPress={() => toggleManualOnboardingStep('verifyEmail')} activeOpacity={0.8}>
              <Feather name={hasVerifiedEmail ? 'check-circle' : 'circle'} size={16} color={hasVerifiedEmail ? '#16a34a' : '#64748b'} />
            </TouchableOpacity>
            <Text style={styles.welcomeStepText}>Verify your email</Text>
          </View>

          <View style={styles.welcomeStepRow}>
            <TouchableOpacity onPress={() => toggleManualOnboardingStep('completeProfile')} activeOpacity={0.8}>
              <Feather name={hasCompletedProfile ? 'check-circle' : 'circle'} size={16} color={hasCompletedProfile ? '#16a34a' : '#64748b'} />
            </TouchableOpacity>
            <Text style={styles.welcomeStepText}>Complete your profile</Text>
          </View>

          <View style={styles.welcomeStepRow}>
            <TouchableOpacity onPress={() => toggleManualOnboardingStep('postFirstListing')} activeOpacity={0.8}>
              <Feather name={hasPostedFirstListing ? 'check-circle' : 'circle'} size={16} color={hasPostedFirstListing ? '#16a34a' : '#64748b'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.welcomeStepLinkButton}
              activeOpacity={0.75}
              onPress={() => {
                setManualOnboardingStep('postFirstListing', true);
                openCreateHub();
              }}
            >
              <Text style={[styles.welcomeStepText, styles.welcomeStepLink]}>Post your first listing</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.welcomeStepRow}>
            <TouchableOpacity onPress={() => toggleManualOnboardingStep('readMessages')} activeOpacity={0.8}>
              <Feather name={hasReadMessages ? 'check-circle' : 'circle'} size={16} color={hasReadMessages ? '#16a34a' : '#64748b'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.welcomeStepLinkButton}
              activeOpacity={0.75}
              onPress={() => {
                setManualOnboardingStep('readMessages', true);
                router.push('/(tabs)/messagesbutton');
              }}
            >
              <Text style={[styles.welcomeStepText, styles.welcomeStepLink]}>{'Read your messages\nGet your first sale.'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.welcomeStepRow}>
            <TouchableOpacity onPress={() => toggleManualOnboardingStep('firstSale')} activeOpacity={0.8}>
              <Feather name={hasFirstSale ? 'check-circle' : 'circle'} size={16} color={hasFirstSale ? '#16a34a' : '#64748b'} />
            </TouchableOpacity>
            <Text style={styles.welcomeStepText}>Mark one listing as sold</Text>
          </View>

          <TouchableOpacity
            style={styles.progressButton}
            onPress={() => {
              Alert.alert(
                'Your Progress',
                `You have completed ${onboardingCompletedSteps}/5 setup steps.`,
                [
                  { text: 'Verify Email', onPress: () => router.push('/verify-email') },
                  { text: 'Edit Profile', onPress: () => setShowSettings(true) },
                  {
                    text: 'Post Listing',
                    onPress: () => {
                      setManualOnboardingStep('postFirstListing', true);
                      openCreateHub();
                    },
                  },
                  {
                    text: 'Messages',
                    onPress: () => {
                      setManualOnboardingStep('readMessages', true);
                      router.push('/(tabs)/messagesbutton');
                    },
                  },
                  { text: 'Close', style: 'cancel' },
                ]
              );
            }}
          >
            <Text style={styles.progressButtonText}>View Progress</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isBusinessAccount ? (
        <View style={styles.businessProfileSection}>
          <View style={styles.businessHeader}>
            <Feather name="briefcase" size={24} color="#4CAF50" />
            <Text style={styles.businessTitle}>Business Profile</Text>
            <TouchableOpacity onPress={() => setShowEditBusiness(true)} style={{ marginLeft: 'auto' }}>
              <Feather name="edit" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>

          <View style={styles.businessInfo}>
            <Text style={styles.businessNameLabel}>Business Name</Text>
            <Text style={styles.businessName}>{userProfile?.businessName || 'Business'}</Text>
          </View>

          {userProfile?.businessDescription ? (
            <View style={styles.businessInfo}>
              <Text style={styles.businessLabel}>Description</Text>
              <Text style={styles.businessText}>{userProfile.businessDescription}</Text>
            </View>
          ) : null}

          {userProfile?.businessPhone ? (
            <View style={styles.businessInfo}>
              <Text style={styles.businessLabel}>Phone</Text>
              <Text style={styles.businessText}>{userProfile.businessPhone}</Text>
            </View>
          ) : null}

          {userProfile?.businessWebsite ? (
            <View style={styles.businessInfo}>
              <Text style={styles.businessLabel}>Website</Text>
              <Text style={styles.businessText}>{userProfile.businessWebsite}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.listingsSection}>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.actionCard, styles.actionCardGuidelines]} onPress={() => setShowGuidelines(true)}>
            <Feather name="book" size={22} color="#fff" />
            <Text style={styles.actionCardText}>Guidelines</Text>
          </TouchableOpacity>

          {isBusinessAccount ? (
            <TouchableOpacity style={[styles.actionCard, styles.actionCardBusinessHub]} onPress={() => router.push('/businesslocal')}>
              <Feather name="briefcase" size={22} color="#fff" />
              <Text style={styles.actionCardText}>Business Hub</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={[styles.actionCard, styles.actionCardBlocked]} onPress={() => setShowBlockedUsers(true)}>
            <Feather name="user-x" size={22} color="#fff" />
            <Text style={styles.actionCardText}>Blocked Users</Text>
          </TouchableOpacity>

          {!isBusinessAccount ? (
            <TouchableOpacity style={[styles.actionCard, styles.actionCardUpgrade]} onPress={() => router.push('/premium-upgrade')}>
              <Feather name="briefcase" size={22} color="#fff" />
              <Text style={styles.actionCardText}>Upgrade Business</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {(Object.keys(SECTION_LABELS) as SectionKey[]).map((section) => {
          const currentTab = sectionTabs[section];
          const rows = getSectionItems(section, currentTab);
          const isCollapsed = collapsedSections[section];

          return (
            <View key={section} style={styles.sectionCard}>
              <TouchableOpacity
                style={[styles.sectionHeaderRow, !isCollapsed ? styles.sectionHeaderRowExpanded : null]}
                onPress={() => toggleSectionCollapsed(section)}
                activeOpacity={0.85}
              >
                <Text style={styles.sectionTitle}>{SECTION_LABELS[section]}</Text>
                <View style={styles.sectionHeaderRight}>
                  <View style={styles.sectionCountBadge}>
                    <Text style={styles.sectionCountText}>{rows.length}</Text>
                  </View>
                  <Feather
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color="#475569"
                  />
                </View>
              </TouchableOpacity>

              {!isCollapsed ? (
                <>
                  <View style={styles.sectionTabsRow}>
                    {TAB_OPTIONS.map((tabOption) => (
                      <TouchableOpacity
                        key={`${section}-${tabOption.key}`}
                        style={[styles.sectionTabButton, currentTab === tabOption.key ? styles.sectionTabButtonActive : null]}
                        onPress={() => setSectionTabs((prev) => ({ ...prev, [section]: tabOption.key }))}
                      >
                        <Text style={[styles.sectionTabText, currentTab === tabOption.key ? styles.sectionTabTextActive : null]}>
                          {tabOption.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {!rows.length ? (
                    <View style={styles.emptyStateWrap}>
                      <Text style={styles.emptyStateTitle}>No posts yet</Text>
                      <TouchableOpacity style={styles.emptyStateButton} onPress={openCreateHub}>
                        <Text style={styles.emptyStateButtonText}>Create your first listing</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    rows.map((item) => {
                      const imageUri = getItemImage(section, item);
                      return (
                        <TouchableOpacity
                          key={`${section}-${currentTab}-${item.id}`}
                          style={styles.listingRow}
                          activeOpacity={0.75}
                          onPress={() => handleOpenItem(section, currentTab, item)}
                        >
                          {imageUri ? (
                            <Image source={{ uri: imageUri }} style={styles.listingImage} />
                          ) : (
                            <View style={styles.listingImage} />
                          )}

                          <View style={styles.listingInfo}>
                            <Text style={styles.listingTitle}>{getItemTitle(section, item)}</Text>
                            <Text style={styles.listingPrice}>{getItemSubtitle(section, item)}</Text>
                          </View>

                          {currentTab === 'saved' ? (
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={(event: any) => {
                                event?.stopPropagation?.();
                                removeSavedListing(item.id);
                              }}
                            >
                              <Feather name="trash-2" size={20} color="#888" />
                            </TouchableOpacity>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    justifyContent: 'space-between',
  },
  profilePhotoSection: {
    marginRight: 16,
  },
  profilePhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f0f0',
  },
  profilePhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: 'bold' },
  row2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  welcomeCard: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    padding: 14,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  welcomeSubtitle: {
    marginTop: 6,
    marginBottom: 10,
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  welcomeStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  welcomeStepText: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  welcomeStepLinkButton: {
    flex: 1,
  },
  welcomeStepLink: {
    color: '#1d4ed8',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  progressButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  progressButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  stat: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#2980b9' },
  statTitle: { fontSize: 14, color: '#555', marginTop: 4 },
  listingsSection: {
    marginTop: 24,
    flex: 1,
    paddingBottom: 40,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionCard: {
    width: '31.5%',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 92,
    gap: 8,
  },
  actionCardText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionCardGuidelines: {
    backgroundColor: '#FF9800',
  },
  actionCardBlocked: {
    backgroundColor: '#E53935',
  },
  actionCardBusinessHub: {
    backgroundColor: '#475569',
  },
  actionCardUpgrade: {
    backgroundColor: '#4CAF50',
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    backgroundColor: '#f8fafc',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderRowExpanded: {
    marginBottom: 10,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCountBadge: {
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 0,
  },
  sectionTabsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  sectionTabButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  sectionTabButtonActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#dbeafe',
  },
  sectionTabText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  sectionTabTextActive: {
    color: '#1e3a8a',
  },
  emptyStateWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  emptyStateTitle: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptyStateButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  listingImage: {
    width: 72,
    height: 72,
    backgroundColor: '#d0d0d0',
    borderRadius: 10,
    marginRight: 12,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 13,
    color: '#475569',
  },
  deleteButton: {
    padding: 4,
  },
  guidelinesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  guidelinesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  businessProfileSection: {
    backgroundColor: '#f0f8f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  businessTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 8,
  },
  businessInfo: {
    marginBottom: 12,
  },
  businessNameLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  businessLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  businessText: {
    fontSize: 15,
    color: '#555',
  },
});
