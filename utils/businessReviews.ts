import { User } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { app } from '../firebase';

type ReviewTargetType = 'business' | 'service';

type SubmitBusinessReviewInput = {
  currentUser: User;
  businessId: string;
  rating: number;
  reviewText: string;
  reviewTargetType: ReviewTargetType;
  reviewTargetId: string;
};

export async function submitBusinessReview({
  currentUser,
  businessId,
  rating,
  reviewText,
  reviewTargetType,
  reviewTargetId,
}: SubmitBusinessReviewInput): Promise<void> {
  const trimmedBusinessId = String(businessId || '').trim();
  if (!trimmedBusinessId) {
    throw new Error('Business ID is missing.');
  }

  if (currentUser.uid === trimmedBusinessId) {
    throw new Error('You cannot review your own business.');
  }

  const normalizedRating = Math.round(Number(rating));
  if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error('Rating must be between 1 and 5.');
  }

  const trimmedReviewText = String(reviewText || '').trim();
  if (!trimmedReviewText) {
    throw new Error('Please enter a review message.');
  }

  const db = getFirestore(app);
  const reviewerRef = doc(db, 'users', currentUser.uid);
  const reviewerSnap = await getDoc(reviewerRef);
  const reviewerData = reviewerSnap.exists() ? reviewerSnap.data() : null;

  const reviewerName =
    String(reviewerData?.name || '').trim()
    || String(reviewerData?.displayName || '').trim()
    || String(currentUser.displayName || '').trim()
    || String(currentUser.email?.split('@')[0] || '').trim()
    || 'User';

  await addDoc(collection(db, 'businessReviews'), {
    userId: currentUser.uid,
    userName: reviewerName,
    businessId: trimmedBusinessId,
    rating: normalizedRating,
    reviewText: trimmedReviewText,
    reviewTargetType,
    reviewTargetId: String(reviewTargetId || '').trim() || null,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
