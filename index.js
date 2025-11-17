const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const Workout = require('./models/Workout');
// NEW: admin and chatbot models
const ContactMessage = require('./models/ContactMessage');
const ChatbotReport = require('./models/ChatbotReport');
const ChatLog = require('./models/ChatLog');

// 🔐 Parse and fix Firebase service account from environment variable
const rawServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
rawServiceAccount.private_key = rawServiceAccount.private_key.replace(/\\n/g, '\n');

// 🔥 Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(rawServiceAccount)
});

const app = express();
app.use(cors());
app.use(express.json());

// 🌐 Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// ===== Auth middleware (Firebase token + admin claim) =====
async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // contains uid and custom claims
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// 🏠 Homepage route
app.get('/', (req, res) => {
  res.send('Welcome to MaxOut API 💪');
});

// 🌱 Temporary seeding route
app.get('/seed', async (req, res) => {
  try {
    await Workout.insertMany([
      { title: 'Squats', details: '10 min • 120 kcal', imageUrl: 'squatt.jpg' },
      { title: 'Push Ups', details: '10 min • 80 kcal', imageUrl: 'pushup.jpg' },
      { title: 'Abs', details: '10 min • 90 kcal', imageUrl: 'abs.jpg' },
      { title: 'Leg Day', details: '10 min • 90 kcal', imageUrl: 'legday.jpg' },
      { title: 'Full Body Stretching', details: '10 min • 90 kcal', imageUrl: 'stretching.jpg' },
      { title: 'Running', details: '10 min • 200 kcal', imageUrl: 'running.jpeg' }
    ]);
    res.send('Workouts seeded!');
  } catch (err) {
    res.status(500).send('Seeding failed');
  }
});

// 📋 GET /workouts
app.get('/workouts', async (req, res) => {
  try {
    const workouts = await Workout.find();
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
});

// ⭐ POST /favourites
app.post('/favourites', async (req, res) => {
  const { title } = req.body;
  try {
    const workout = await Workout.findOne({ title });
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    res.json({ message: `${title} marked as favourite` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark favourite' });
  }
});

// 🔔 Trigger push notification manually (for EasyCron or testing)
app.get('/trigger-push', (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.PUSH_SECRET) {
    return res.status(403).send('Forbidden');
  }

  const message = {
    notification: {
      title: '💪 MaxOut Motivation',
      body: 'Push yourself — no one else will!'
    },
    topic: 'daily_motivation'
  };

  admin.messaging().send(message)
    .then(response => {
      console.log('✅ Manual notification sent:', response);
      res.send('Notification sent!');
    })
    .catch(error => {
      console.error('❌ Error sending notification:', error);
      res.status(500).send('Failed to send notification');
    });
});

// ===== Public submissions =====

// 📬 Contact form: create message
app.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'Missing fields' });

    const doc = await ContactMessage.create({ name, email, subject, message });
    res.json({ ok: true, id: doc._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit contact message' });
  }
});

// 🐞 Chatbot report: bug/support/etc.
app.post('/chatbot/report', verifyFirebaseToken, async (req, res) => {
  try {
    const { type, message, meta } = req.body;
    if (!type || !message) return res.status(400).json({ error: 'Missing fields' });

    const doc = await ChatbotReport.create({
      userId: req.user?.uid,
      type,
      message,
      meta: meta || {}
    });
    res.json({ ok: true, id: doc._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 💬 Chatbot log: append conversation messages
app.post('/chatbot/log', verifyFirebaseToken, async (req, res) => {
  try {
    const { sessionId, messages } = req.body; // messages: [{ role, text }]
    if (!sessionId || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid payload' });

    let log = await ChatLog.findOne({ sessionId, userId: req.user?.uid });
    if (!log) log = await ChatLog.create({ sessionId, userId: req.user?.uid, messages: [] });

    log.messages.push(...messages.map(m => ({ role: m.role, text: m.text })));
    await log.save();
    res.json({ ok: true, id: log._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to append chat log' });
  }
});

// ===== Admin-only views =====

// 👥 List Firebase users
app.get('/admin/users', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const list = await admin.auth().listUsers(1000);
    const users = list.users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      disabled: u.disabled,
      role: u.customClaims?.role || 'user',
      createdAt: u.metadata.creationTime,
      lastSignIn: u.metadata.lastSignInTime
    }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// 📩 Contact messages (list + update status)
app.get('/admin/messages', verifyFirebaseToken, requireAdmin, async (req, res) => {
  const items = await ContactMessage.find().sort({ createdAt: -1 });
  res.json(items);
});
app.patch('/admin/messages/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const ok = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json(ok);
});

// 🐞 Reports (list + update status)
app.get('/admin/reports', verifyFirebaseToken, requireAdmin, async (req, res) => {
  const items = await ChatbotReport.find().sort({ createdAt: -1 });
  res.json(items);
});
app.patch('/admin/reports/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const ok = await ChatbotReport.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json(ok);
});

// 💬 Chat logs (list + detail)
app.get('/admin/chatlogs', verifyFirebaseToken, requireAdmin, async (req, res) => {
  const items = await ChatLog.find().sort({ updatedAt: -1 }).limit(200);
  res.json(items);
});
app.get('/admin/chatlogs/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  const item = await ChatLog.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// 🚀 Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

