const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const Workout = require('./models/Workout');
const admin = require('./firebase'); // Firebase Admin SDK

const app = express();
app.use(cors());
app.use(express.json());

// 🔔 Daily Motivation at 07:00
cron.schedule("0 7 * * *", () => {
  const message = {
    notification: {
      title: "💪 MaxOut Motivation",
      body: "Push yourself — no one else will!"
    },
    topic: "daily_motivation"
  };

  admin.messaging().send(message)
    .then(() => console.log("✅ Motivation sent at 07:00"))
    .catch(err => console.error("❌ FCM error:", err));
});

// 🔔 Workout Reminder at 17:00
cron.schedule("0 17 * * *", () => {
  const message = {
    notification: {
      title: "🔔 Workout Reminder",
      body: "Dont forget to stretch!"
    },
    topic: "workout_reminders"
  };

  admin.messaging().send(message)
    .then(() => console.log("✅ Reminder sent at 17:00"))
    .catch(err => console.error("❌ FCM error:", err));
});

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
      { title: 'Full Body Stretching', details: '15 min • 90 kcal', imageUrl: 'stretching.jpg'},
      { title: 'Running', details: '20 min • 200 kcal', imageUrl: 'running.jpeg' }
    ]);
    res.send('Workouts seeded!');
  } catch (err) {
    res.status(500).send('Seeding failed');
  }
});

// 📦 GET /workouts
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






