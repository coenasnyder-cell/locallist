// Listing schema for Firestore and app
export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number | string;
  images: string[];
  zipCode?: string;
  city?: string;
  status?: 'pending' | 'approved' | 'rejected' | string;
  createdAt?: any;
  updatedAt?: any;
  userId: string;
  // Featured listing fields
  isFeatured?: boolean;
  featureTier?: 'premium' | 'basic';
  featureExpiresAt?: string; // ISO timestamp when feature expires
  featurePurchaseId?: string; // Reference to purchase record
  // Add more fields as needed
}

// Featured listing purchase record
export interface FeaturePurchase {
  id: string;
  listingId: string;
  userId: string;
  amount: number; // $5.00
  currency: string; // "USD"
  status: 'pending' | 'completed' | 'failed' | 'refunded'; // payment status
  paymentMethod: 'stripe' | 'manual' | 'other'; // how payment was made
  purchasedAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp (7 days from purchase)
  // Optional payment reference
  stripePaymentIntentId?: string; // for Stripe integration later
  notes?: string; // admin notes for manual payments
}
