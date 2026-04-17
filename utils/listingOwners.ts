import { Firestore, collection, documentId, getDocs, query, where } from 'firebase/firestore';

const USER_ID_CHUNK_SIZE = 10;

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function normalizeUserId(value: unknown): string {
  return String(value || '').trim();
}

export async function filterListingsWithExistingUsers<T extends { userId?: string | null }>(
  db: Firestore,
  listings: T[]
): Promise<T[]> {
  const listingUserIds = Array.from(
    new Set(
      listings
        .map((item) => normalizeUserId(item.userId))
        .filter(Boolean)
    )
  );

  if (!listingUserIds.length) {
    return [];
  }

  try {
    const existingUserIds = new Set<string>();
    const idChunks = chunkArray(listingUserIds, USER_ID_CHUNK_SIZE);

    for (const idChunk of idChunks) {
      const usersSnapshot = await getDocs(
        query(collection(db, 'users'), where(documentId(), 'in', idChunk))
      );
      usersSnapshot.forEach((userDoc) => {
        existingUserIds.add(userDoc.id);
      });
    }

    return listings.filter((item) => {
      const ownerId = normalizeUserId(item.userId);
      return !!ownerId && existingUserIds.has(ownerId);
    });
  } catch (error) {
    console.warn('filterListingsWithExistingUsers failed, returning all listings:', error);
    return listings;
  }
}
