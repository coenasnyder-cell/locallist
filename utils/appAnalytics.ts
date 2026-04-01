import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import { app } from '../firebase';

export type AppAnalyticsEventName =
  | 'first_listing_cta_tap'
  | 'listing_form_started'
  | 'listing_draft_restored'
  | 'listing_submitted'
  | 'featured_checkout_started'
  | 'featured_checkout_success';

type AppAnalyticsPayload = {
  userId?: string | null;
  [key: string]: unknown;
};

export async function trackAppEvent(eventName: AppAnalyticsEventName, payload: AppAnalyticsPayload = {}): Promise<void> {
  try {
    const db = getFirestore(app);
    await addDoc(collection(db, 'appAnalyticsEvents'), {
      eventName,
      ...payload,
      platform: Platform.OS,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Tracking should never break user flows.
    console.error('trackAppEvent error', error);
  }
}
