const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using default credentials from Firebase CLI
// Make sure you're logged in: firebase login
const serviceAccountPath = require('path').join(__dirname, 'serviceAccountKey.json');

let app;
try {
  const serviceAccount = require(serviceAccountPath);
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (e) {
  console.log('Service account key not found. Using default Firebase credentials...');
  app = admin.initializeApp({
    projectId: 'local-list-wski21',
  });
}

const db = admin.firestore();

async function setAdminRole(userId) {
  try {
    console.log(`🔐 Setting admin role for user: ${userId}\n`);
    
    const userRef = db.collection('users').doc(userId);
    
    // First, check if user exists
    const userDoc = await userRef.get();
    if (!userDoc.exists()) {
      console.error(`❌ User not found: ${userId}`);
      process.exit(1);
    }
    
    // Update the user role to admin
    await userRef.update({
      role: 'admin',
    });
    
    console.log('✅ Successfully set admin role!');
    
    // Verify the update
    const updatedDoc = await userRef.get();
    const userData = updatedDoc.data();
    console.log('\n📋 Updated user data:');
    console.log(`   Email: ${userData.email}`);
    console.log(`   Role: ${userData.role}`);
    console.log('\n✨ You now have admin access to the app!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting admin role:', error.message);
    process.exit(1);
  }
}

const userId = process.argv[2] || '4LaqQJM6jiPVNZu6DQlnw3MbRXz1';
setAdminRole(userId);
