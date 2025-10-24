const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

// 🔐 Parse and fix Firebase service account
const rawServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
rawServiceAccount.private_key = rawServiceAccount.private_key.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert(rawServiceAccount)
});

// 🔔 Schedule daily push at 07:00 SAST (05:00 UTC)
cron.schedule('0 5 * * *', () => {
  const message = {
    notification: {
      title: '💪 MaxOut Motivation',
      body: 'Push yourself — no one else will!'
    },
    topic: 'daily_motivation'
  };

  admin.messaging().send(message)
    .then(response => {
      console.log('✅ Daily notification sent:', response);
    })
    .catch(error => {
      console.error('❌ Error sending notification:', error);
    });
});

console.log('⏳ MaxOut worker running...');
