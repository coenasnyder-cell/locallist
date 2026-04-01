import { addDoc, collection, doc, getFirestore, serverTimestamp, updateDoc } from 'firebase/firestore';
import { app } from '../firebase';
import { FeaturePurchase } from '../types/Listing';

const FEATURE_PRICE = 5.0; // $5.00 USD
const FEATURE_DURATION_DAYS = 7;

/**
 * Create a featured listing purchase record
 * This initiates the purchase and marks the listing as featured
 * 
 * @param listingId - The listing ID to feature
 * @param userId - The user ID creating the purchase
 * @param paymentMethod - How the payment will be made ('manual' for now, 'stripe' later)
 * @returns The purchase record with ID
 */
export async function createFeaturePurchase(
  listingId: string,
  userId: string,
  paymentMethod: 'manual' | 'stripe' = 'manual'
): Promise<FeaturePurchase> {
  const db = getFirestore(app);
  
  // Calculate expiration (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + FEATURE_DURATION_DAYS);

  // Create purchase record
  const purchaseData = {
    listingId,
    userId,
    amount: FEATURE_PRICE,
    currency: 'USD',
    status: paymentMethod === 'manual' ? 'pending' : 'pending', // pending until admin verifies
    paymentMethod,
    purchasedAt: serverTimestamp(),
    expiresAt: expiresAt.toISOString(),
  };

  try {
    const docRef = await addDoc(collection(db, 'featurePurchases'), purchaseData);
    
    // Update listing to mark as featured
    await updateDoc(doc(db, 'listings', listingId), {
      is_featured: true,
      featureExpiresAt: expiresAt.toISOString(),
      featurePurchaseId: docRef.id,
      updatedAt: new Date().toISOString(),
    });

    return {
      id: docRef.id,
      ...purchaseData,
      expiresAt: expiresAt.toISOString(),
      purchasedAt: new Date().toISOString(),
    } as FeaturePurchase;
  } catch (error) {
    console.error('Error creating feature purchase:', error);
    throw new Error('Failed to create featured listing purchase');
  }
}

/**
 * Get user's feature purchase history
 * @param userId - The user ID to fetch purchases for
 */
export async function getUserFeaturePurchases(userId: string): Promise<FeaturePurchase[]> {
  const db = getFirestore(app);
  // This would require a Firestore query - implement in your component
  return [];
}

/**
 * Check if a listing is currently featured (not expired)
 * @param featureExpiresAt - The expiration timestamp from the listing
 * @returns true if featured and not expired
 */
export function isListingCurrentlyFeatured(featureExpiresAt?: string): boolean {
  if (!featureExpiresAt) return false;
  
  const now = new Date();
  const expiresAt = new Date(featureExpiresAt);
  
  return expiresAt > now;
}

/**
 * Get display info about featured listing status
 */
export function getFeaturedListingInfo(featureExpiresAt?: string) {
  if (!isListingCurrentlyFeatured(featureExpiresAt)) {
    return {
      isFeatured: false,
      daysRemaining: 0,
      displayText: null,
    };
  }

  const now = new Date();
  const expiresAt = new Date(featureExpiresAt!);
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    isFeatured: true,
    daysRemaining: Math.max(0, daysRemaining),
    displayText: daysRemaining === 1 ? 'Featured (expires today)' : `Featured (${daysRemaining} days)`,
  };
}

/**
 * Format feature listing cost for display
 */
export function getFeaturePrice(): { amount: number; currency: string; formatted: string } {
  return {
    amount: FEATURE_PRICE,
    currency: 'USD',
    formatted: `$${FEATURE_PRICE.toFixed(2)}`,
  };
}

/**
 * Get feature duration
 */
export function getFeatureDuration(): { days: number; hours: number } {
  return {
    days: FEATURE_DURATION_DAYS,
    hours: FEATURE_DURATION_DAYS * 24,
  };
}
