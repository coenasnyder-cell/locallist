import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, increment, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from "../firebase";

export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  images: string[];
  sellerName: string;
  sellerEmail: string;
  userId?: string;
  zipCode: string;
  city?: string;
  eventDate?: string;
  status: string;
  isFeatured: boolean;
  isSample: boolean;
  viewCount: number;
  favoritesCount: number;
  allowMessages: boolean;
  createdAt: any;
  expiresAt: any;
};

export default function SingleListing({ listing }: { listing: Listing }) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const currentUser = getAuth().currentUser;
  const isOwnListing = !!currentUser && currentUser.uid === listing.userId;

  useEffect(() => {
    const db = getFirestore(app);
    // Increment view count once per mount (owner views don't count)
    if (!isOwnListing) {
      updateDoc(doc(db, 'listings', listing.id), { viewCount: increment(1) }).catch(() => {});
    }
  }, [listing.id]);

  useEffect(() => {
    if (!currentUser || isOwnListing) return;
    const db = getFirestore(app);
    getDoc(doc(db, 'saveListings', `${currentUser.uid}_${listing.id}`))
      .then(snap => { setIsSaved(snap.exists()); })
      .catch(() => {});
  }, [listing.id]);

  const toggleSave = async () => {
    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to save listings.');
      return;
    }
    if (savingInProgress) return;
    setSavingInProgress(true);
    try {
      const db = getFirestore(app);
      const saveDocRef = doc(db, 'saveListings', `${currentUser.uid}_${listing.id}`);
      if (isSaved) {
        await deleteDoc(saveDocRef);
        setIsSaved(false);
      } else {
        await setDoc(saveDocRef, {
          listingId: listing.id,
          userId: currentUser.uid,
          title: listing.title || 'Untitled',
          description: listing.description || '',
          image: listing.images?.[0] || null,
          sellerName: listing.sellerName || '',
          price: listing.price || 0,
          city: listing.city || 'TBD',
          category: listing.category || '',
          savedAt: serverTimestamp(),
        });
        setIsSaved(true);
        Alert.alert('Listing Saved', 'You can view your saved listings under the Saved tab on your profile.', [{ text: 'OK' }]);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save listing. Please try again.');
    } finally {
      setSavingInProgress(false);
    }
  };

  const startThread = async () => {
  try {
    const db = getFirestore(app);
    const user = getAuth().currentUser;

    if (!user) {
      alert("Please log in to message sellers.");
      return;
    }

    if (!listing.userId) {
      alert("Seller ID missing on listing");
      return;
    }

    const threadsRef = collection(db, "threads");

    // Check if a thread already exists for this buyer and listing owner.
    const existingThreadQuery = query(
      threadsRef,
      where("listingId", "==", listing.id),
      where("participantIds", "array-contains", user.uid)
    );

    const existingThreadSnapshot = await getDocs(existingThreadQuery);

    if (!existingThreadSnapshot.empty) {
      const existingMatch = existingThreadSnapshot.docs.find((d) => {
        const ids: string[] = d.data().participantIds || [];
        return ids.includes(listing.userId || '');
      });

      if (existingMatch) {
        router.push({
          pathname: "/threadchat",
          params: { threadId: existingMatch.id }
        });
        return;
      }
    }

    const threadData = {
      listingId: listing.id,
      buyerId: user.uid,
      sellerId: listing.userId,
      participantIds: [user.uid, listing.userId],

      listingTitle: listing.title,
      listingImage: listing.images?.[0] || null,
      listingType: 'marketplace',
      leadType: 'marketplace',

      createdAt: serverTimestamp(),
      lastMessage: "",
      lastTimestamp: serverTimestamp(),
      unreadBy: [listing.userId],
    };

    const docRef = await addDoc(threadsRef, threadData);

    router.push({
      pathname: "/threadchat",
      params: { threadId: docRef.id }
    });

  } catch (error) {
    console.error(error);
    alert("Unable to start conversation.");
  }
};

  const submitListingReport = async (reason: string) => {
    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to report listings.');
      return;
    }

    if (isOwnListing) {
      Alert.alert('Not allowed', 'You cannot report your own listing.');
      return;
    }

    try {
      const db = getFirestore(app);
      await addDoc(collection(db, 'reportedListings'), {
        listingId: listing.id,
        listingTitle: listing.title || 'Untitled listing',
        listingImage: listing.images?.[0] || '',
        sellerId: listing.userId || '',
        sellerEmail: listing.sellerEmail || '',
        reportedBy: currentUser.uid,
        reason,
        details: 'Reported from listing details screen',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      Alert.alert('Report submitted', 'Thanks. Our moderators will review this listing.');
    } catch (error) {
      console.error('Error reporting listing:', error);
      Alert.alert('Error', 'Could not submit report. Please try again.');
    }
  };

  const reportListing = () => {
    Alert.alert('Report Listing', 'Why are you reporting this listing?', [
      {
        text: 'Spam',
        onPress: () => submitListingReport('spam'),
      },
      {
        text: 'Scam/Fraud',
        onPress: () => submitListingReport('scam'),
      },
      {
        text: 'Prohibited Item',
        onPress: () => submitListingReport('prohibited_item'),
      },
      {
        text: 'Misleading Content',
        onPress: () => submitListingReport('misleading_content'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const isExpired = () => {
    if (!listing.expiresAt) return false;
    const expiresAt = listing.expiresAt.toDate
      ? listing.expiresAt.toDate()
      : new Date(listing.expiresAt);
    return expiresAt < new Date();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView>
        <View style={styles.headerSpacer} />
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.arrowButton}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.titleCenterWrapper}>
            <Text style={styles.listingDetailsTitle}>Listing Details</Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          {/* Images */}
          <View style={styles.gallery}>
            {listing.images && listing.images.length > 0 ? (
              <View>
                <Image source={{ uri: listing.images[0] }} style={styles.image} />
                {listing.images.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                    {listing.images.slice(1).map((img, idx) => (
                      <Image key={idx} source={{ uri: img }} style={styles.imageSmall} />
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text>No Images</Text>
              </View>
            )}
          </View>

          {/* Details */}
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.price}>Price: ${listing.price}</Text>
          <View style={styles.viewCountRow}>
            <Feather name="eye" size={13} color="#999" />
            <Text style={styles.viewCountText}>{(listing.viewCount || 0) + (isOwnListing ? 0 : 1)} views</Text>
          </View>
          <Text style={styles.meta}>Category: {listing.category}</Text>
          <Text style={styles.meta}>Condition: {listing.condition}</Text>

          {listing.eventDate && (
            <Text style={styles.meta}>Event Date: {listing.eventDate}</Text>
          )}

          {isExpired() && (
            <Text style={styles.expiredText}>This listing has expired</Text>
          )}

          <Text style={styles.description}>{listing.description}</Text>

          {/* Seller Info */}
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerLabel}>Seller:</Text>
            <Text style={styles.sellerName}>{listing.sellerName}</Text>
            <Text style={styles.sellerLocation}>Location: {listing.city || 'TBD'}</Text>
          </View>
          <TouchableOpacity style={styles.messageButton} onPress={startThread}>
            <Text style={styles.messageButtonText}>Message Seller</Text>
          </TouchableOpacity>
          {!!currentUser && !isOwnListing && (
            <TouchableOpacity
              style={[styles.saveButton, isSaved && styles.saveButtonSaved]}
              onPress={toggleSave}
              disabled={savingInProgress}
            >
              <Feather name="bookmark" size={16} color={isSaved ? '#fff' : '#475569'} />
              <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextSaved]}>
                {isSaved ? 'Saved' : 'Save Listing'}
              </Text>
            </TouchableOpacity>
          )}
          {!!currentUser && !isOwnListing && (
            <TouchableOpacity style={styles.reportButton} onPress={reportListing}>
              <Feather name="flag" size={16} color="#dc2626" />
              <Text style={styles.reportButtonText}>Report Listing</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  detailsContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 24,
    // You can adjust/add more styling as needed
  },
  headerSpacer: {
    height: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    height: 32,
  },
  arrowButton: {
    position: 'absolute',
    left: 0,
    padding: 4,
    zIndex: 2,
  },
  titleCenterWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gallery: {
    marginBottom: 16,
    minHeight: 120,
  },
  galleryScroll: {
    marginTop: 8,
  },
  imageSmall: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#eee',
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 8,
  },
  price: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 8,
    fontWeight: '500',
  },
  meta: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
    fontWeight: '500',
  },
  viewCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  viewCountText: {
    fontSize: 12,
    color: '#999',
  },
  description: {
    fontSize: 14,
    marginVertical: 12,
    color: '#333',
  },
  sellerInfo: {
    marginTop: 12,
  },
  sellerLabel: {
    fontWeight: '500',
    fontSize: 15,
  },
  sellerName: {
    fontSize: 15,
    color: '#222',
  },
  sellerLocation: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  expiredText: {
    color: '#999',
    fontWeight: '500',
    fontSize: 15,
    marginTop: 8,
  },
  messageButton: {
    backgroundColor: '#475569',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#475569',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  saveButtonSaved: {
    backgroundColor: '#475569',
    borderColor: '#475569',
  },
  saveButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 15,
  },
  saveButtonTextSaved: {
    color: '#fff',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginBottom: 24,
    backgroundColor: '#fff1f2',
  },
  reportButtonText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 14,
  },
  listingDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 0.5,
  },
  messageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
});
