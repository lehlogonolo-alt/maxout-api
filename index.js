const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const Workout = require('./models/Workout');

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

// 🏠 Homepage route
app.get('/', (req, res) => {
  res.send('Welcome to MaxOut API 💪');
});

// 🌱 Temporary seeding route
app.get('/seed', async (req, res) => {
  try {
    await Workout.insertMany([
      { title: 'Squats', details: '12 min • 120 kcal', imageUrl: 'squatt.jpg' },
      { title: 'Push Ups', details: '10 min • 80 kcal', imageUrl: 'pushup.jpg' },
      { title: 'Abs', details: '10 min • 90 kcal', imageUrl: 'abs.jpg' },
      { title: 'Leg Day', details: '10 min • 90 kcal', imageUrl: 'legday.jpg' },
      { title: 'Full Body Stretching', details: '15 min • 90 kcal', imageUrl: 'stretching.jpg' },
      { title: 'Running', details: '20 min • 200 kcal', imageUrl: 'running.jpeg' }
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

// 🚀 Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));










