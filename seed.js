require('dotenv').config(); // ✅ Load .env first
const mongoose = require('mongoose');
const Workout = require('./models/Workout');

// ✅ Use the actual value from .env
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

Workout.insertMany([
  { title: 'Squats', details: '12 min • 120 kcal', imageUrl: 'squatt.png' },
  { title: 'Push Ups', details: '10 min • 80 kcal', imageUrl: 'pushup.png' },
  { title: 'Abs', details: '10 min • 90 kcal', imageUrl: 'abs.png' },
  { title: 'Leg Day', details: '10 min • 90 kcal', imageUrl: 'legday.png' },
  { title: 'Full Body Stretching', details: '15 min • 90 kcal', imageUrl: 'stretching.png' },
  { title: 'Running', details: '20 min • 200 kcal', imageUrl: 'running.png' }
]).then(() => {
  console.log('Workouts seeded');
  mongoose.disconnect();
});

