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

//  Parse and fix Firebase service account from environment variable
const rawServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
rawServiceAccount.private_key = rawServiceAccount.private_key.replace(/\\n/g, '\n');

//  Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(rawServiceAccount)
});

const app = express();
app.use(cors());
app.use(express.json());

//  Connect to MongoDB
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

//  Homepage route
app.get('/', (req, res) => {
  res.send('Welcome to MaxOut API 💪');
});

//  Temporary seeding route
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

//  GET /workouts
app.get('/workouts', async (req, res) => {
  try {
    const workouts = await Workout.find();
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
});

//  POST /favourites
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

//  Trigger push notification manually (for EasyCron or testing)
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

//  Contact form: create message
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

//  Chatbot report: bug/support/etc.
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

//  Chatbot log: append conversation messages
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

//  List Firebase users with search + pagination
app.get('/admin/users', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { search = "", page = 1, pageSize = 10 } = req.query;

    // Fetch up to 1000 users from Firebase Auth
    const list = await admin.auth().listUsers(1000);

    // Map users into clean objects
    let users = list.users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      disabled: u.disabled,
      role: u.customClaims?.role || 'user',
      createdAt: u.metadata.creationTime,
      lastSignIn: u.metadata.lastSignInTime
    }));

    //  Apply search filter (email or UID)
    if (search) {
      const s = search.toLowerCase();
      users = users.filter(
        u =>
          (u.email && u.email.toLowerCase().includes(s)) ||
          u.uid.toLowerCase().includes(s)
      );
    }

    //  Pagination
    const totalPages = Math.ceil(users.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = users.slice(start, end);

    res.json({ items, totalPages });
  } catch (err) {
    console.error("❌ Failed to list users:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
});


//  Contact messages (list + update status)
app.get('/admin/messages', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { search = "", page = 1, pageSize = 10 } = req.query;

    let query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query = {
        $or: [
          { name: regex },
          { email: regex },
          { subject: regex },
          { message: regex }
        ]
      };
    }

    const totalCount = await ContactMessage.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    const items = await ContactMessage.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize));

    res.json({ items, totalPages });
  } catch (err) {
    console.error("❌ Failed to list messages:", err);
    res.status(500).json({ error: "Failed to list messages" });
  }
});

app.patch('/admin/messages/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const ok = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json(ok);
});

//  Reports (list + update status)
app.get('/admin/reports', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { search = "", page = 1, pageSize = 10 } = req.query;

    let query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query = {
        $or: [
          { type: regex },
          { message: regex },
          { userId: regex }
        ]
      };
    }

    const totalCount = await ChatbotReport.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    const items = await ChatbotReport.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize));

    res.json({ items, totalPages });
  } catch (err) {
    console.error("❌ Failed to list reports:", err);
    res.status(500).json({ error: "Failed to list reports" });
  }
});

app.patch('/admin/reports/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const ok = await ChatbotReport.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json(ok);
});


//  Chat logs (list + detail + delete)
app.get('/admin/chatlogs', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { search = "", page = 1, pageSize = 10 } = req.query;

    let query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query = {
        $or: [
          { sessionId: regex },
          { userId: regex },
          { "messages.text": regex }
        ]
      };
    }

    const totalCount = await ChatLog.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    const items = await ChatLog.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize));

    res.json({ items, totalPages });
  } catch (err) {
    console.error("❌ Failed to list chat logs:", err);
    res.status(500).json({ error: "Failed to list chat logs" });
  }
});

app.get('/admin/chatlogs/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const item = await ChatLog.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    console.error("❌ Failed to fetch chat log:", err);
    res.status(500).json({ error: "Failed to fetch chat log" });
  }
});

app.delete('/admin/chatlogs/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await ChatLog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Chat log not found' });
    res.json({ ok: true, id: deleted._id });
  } catch (err) {
    console.error("❌ Failed to delete chat log:", err);
    res.status(500).json({ error: "Failed to delete chat log" });
  }
});


// ===== Secure endpoint to set roles =====
// Use this to promote a user to admin by UID
app.post('/admin/set-role', async (req, res) => {
  try {
    const { secret, uid, role } = req.body;

    // Protect with secret key from .env
    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!uid || !role) {
      return res.status(400).json({ error: 'Missing uid or role' });
    }

    await admin.auth().setCustomUserClaims(uid, { role });

    res.json({ ok: true, message: `Role '${role}' set for UID: ${uid}` });
  } catch (err) {
    console.error('❌ Error setting role:', err);
    res.status(500).json({ error: 'Failed to set role' });
  }
});

// 🏋️ Admin Workouts (CRUD)
app.get('/admin/workouts', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { search = "", page = 1, pageSize = 10 } = req.query;

    let query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query = { $or: [{ title: regex }, { details: regex }] };
    }

    const totalCount = await Workout.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    const items = await Workout.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize));

    res.json({ items, totalPages });
  } catch (err) {
    console.error("❌ Failed to list workouts:", err);
    res.status(500).json({ error: "Failed to list workouts" });
  }
});

app.post('/admin/workouts', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { title, details, imageUrl } = req.body;
    if (!title || !details) return res.status(400).json({ error: 'Missing fields' });

    const workout = await Workout.create({ title, details, imageUrl });
    res.json({ ok: true, id: workout._id });
  } catch (err) {
    console.error("❌ Failed to add workout:", err);
    res.status(500).json({ error: "Failed to add workout" });
  }
});

app.patch('/admin/workouts/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { title, details, imageUrl } = req.body;
    const updated = await Workout.findByIdAndUpdate(
      req.params.id,
      { title, details, imageUrl },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Workout not found' });
    res.json(updated);
  } catch (err) {
    console.error("❌ Failed to update workout:", err);
    res.status(500).json({ error: "Failed to update workout" });
  }
});

app.delete('/admin/workouts/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await Workout.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Workout not found' });
    res.json({ ok: true, id: deleted._id });
  } catch (err) {
    console.error("❌ Failed to delete workout:", err);
    res.status(500).json({ error: "Failed to delete workout" });
  }
});


//  Delete a contact message
app.delete('/admin/messages/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Message not found' });
    res.json({ ok: true, id: deleted._id });
  } catch (err) {
    console.error("❌ Failed to delete message:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

//  Delete a report
app.delete('/admin/reports/:id', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await ChatbotReport.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Report not found' });
    res.json({ ok: true, id: deleted._id });
  } catch (err) {
    console.error("❌ Failed to delete report:", err);
    res.status(500).json({ error: "Failed to delete report" });
  }
});


// ===== Debug route to check claims =====
app.get('/whoami/:uid', async (req, res) => {
  try {
    const user = await admin.auth().getUser(req.params.uid);
    res.json({
      uid: user.uid,
      email: user.email,
      claims: user.customClaims || {}
    });
  } catch (err) {
    console.error('❌ Error fetching user claims:', err);
    res.status(500).json({ error: 'Failed to fetch user claims' });
  }
});

//  Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));








