 
const admin = require('firebase-admin');

// Usage:
// 1) Download a Firebase service account JSON key
// 2) Set SERVICE_ACCOUNT_PATH to the JSON file path
//    PowerShell: $env:SERVICE_ACCOUNT_PATH="C:\\path\\to\\serviceAccount.json"
// 3) Run: node scripts/migrateListingImages.js

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('Missing SERVICE_ACCOUNT_PATH env var.');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const PLACEHOLDER_URL = 'https://via.placeholder.com/600x400?text=No+Image';

function isLocalPath(url) {
  return typeof url === 'string' && (url.startsWith('file://') || url.startsWith('content://'));
}

async function migrateListings() {
  const snapshot = await db.collection('listings').get();
  let updatedCount = 0;
  let scannedCount = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    scannedCount += 1;
    const data = doc.data();
    const images = Array.isArray(data.images) ? data.images : [];

    if (!images.some(isLocalPath)) {
      continue;
    }

    const newImages = images.map((img) => (isLocalPath(img) ? PLACEHOLDER_URL : img));

    batch.update(doc.ref, {
      images: newImages,
      imageMigration: {
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        reason: 'replaced local file paths with placeholder'
      }
    });
    batchCount += 1;
    updatedCount += 1;

    if (batchCount >= 400) {
      await batch.commit();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`Scanned ${scannedCount} listings.`);
  console.log(`Updated ${updatedCount} listings.`);
}

migrateListings().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
