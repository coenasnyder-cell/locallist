/**
 * One-time script to fix existing user documents
 * Run this with: node scripts/fix-user-profiles.js
 * 
 * This script adds the required status field and other missing fields
 * to existing user documents so they can create listings.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixUserProfiles() {
  console.log('Starting user profile migration...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Check if user is missing required fields
      const needsUpdate = !userData.status || 
                         typeof userData.isDisabled === 'undefined' || 
                         typeof userData.isBanned === 'undefined' ||
                         typeof userData.zipApproved === 'undefined' ||
                         !userData.blockedUsers;
      
      if (needsUpdate) {
        // Update with missing fields
        const updates = {};
        
        if (!userData.status) {
          updates.status = 'approved'; // Approve existing users
        }
        
        if (typeof userData.isDisabled === 'undefined') {
          updates.isDisabled = false;
        }
        
        if (typeof userData.isBanned === 'undefined') {
          updates.isBanned = false;
        }
        
        if (typeof userData.zipApproved === 'undefined') {
          updates.zipApproved = false;
        }
        
        if (!userData.blockedUsers) {
          updates.blockedUsers = [];
        }
        
        if (!userData.displayName && userData.email) {
          updates.displayName = userData.email.split('@')[0];
        }
        
        await db.collection('users').doc(userId).update(updates);
        console.log(`✓ Updated user: ${userData.email || userId}`);
        updatedCount++;
      } else {
        console.log(`- Skipped user (already up to date): ${userData.email || userId}`);
        skippedCount++;
      }
    }
    
    console.log('\n=== Migration Complete ===');
    console.log(`Updated: ${updatedCount} users`);
    console.log(`Skipped: ${skippedCount} users`);
    console.log(`Total: ${usersSnapshot.docs.length} users`);
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    process.exit(0);
  }
}

fixUserProfiles();
