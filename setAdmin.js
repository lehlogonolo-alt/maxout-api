// setAdmin.js
const admin = require('firebase-admin');
require('dotenv').config();

// Parse service account from .env
const rawServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
rawServiceAccount.private_key = rawServiceAccount.private_key.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert(rawServiceAccount)
});

async function setAdmin(uid) {
  try {
    await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
    console.log(`✅ Admin role set for UID: ${uid}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to set admin role:', err);
    process.exit(1);
  }
}

// Replace with your UID
setAdmin('6RXAq9w5v4WicJmR82zWRfEESFQ2');
