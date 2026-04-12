import { User } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { app } from '../firebase';

type ReviewTargetType = 'seller' | 'business' | 'service';

type SubmitUserReviewInput = {
  currentUser: User;
  ratedUserId: string;
  rating: number;
  reviewText: string;
  reviewTargetType: ReviewTargetType;
  reviewTargetId: string;
};

function normalizeName(value: unknown): string {
  return String(value || '').trim();
}

export async function submitUserReview({
  currentUser,
  ratedUserId,
  rating,
  reviewText,
  reviewTargetType,
  reviewTargetId,
}: SubmitUserReviewInput): Promise<void> {
  const trimmedRatedUserId = String(ratedUserId || '').trim();
  if (!trimmedRatedUserId) {
    throw new Error('Rated user ID is missing.');
  }

  if (currentUser.uid === trimmedRatedUserId) {
    throw new Error('You cannot review yourself.');
  }

  const normalizedRating = Number(rating);
  if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error('Rating must be between 1 and 5.');
  }

  const trimmedReviewText = String(reviewText || '').trim();
  if (!trimmedReviewText) {
    throw new Error('Please enter a review message.');
  }

  const db = getFirestore(app);
  const reviewerRef = doc(db, 'users', currentUser.uid);
  const ratedUserRef = doc(db, 'users', trimmedRatedUserId);

  const [reviewerSnap, ratedUserSnap] = await Promise.all([getDoc(reviewerRef), getDoc(ratedUserRef)]);

  const reviewerData = reviewerSnap.exists() ? reviewerSnap.data() : null;
  const ratedUserData = ratedUserSnap.exists() ? ratedUserSnap.data() : null;

  const reviewerName =
    normalizeName(reviewerData?.name)
    || normalizeName(reviewerData?.displayName)
    || normalizeName(currentUser.displayName)
    || normalizeName(currentUser.email?.split('@')[0])
    || 'User';

  const userType = normalizeName(ratedUserData?.accountType) || 'personal';

  await addDoc(collection(db, 'userReviews'), {
    userId: currentUser.uid,
    userName: reviewerName,
    ratedUserId: trimmedRatedUserId,
    userType,
    rating: normalizedRating,
    reviewText: trimmedReviewText,
    reviewTargetType,
    reviewTargetId: String(reviewTargetId || '').trim() || null,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
