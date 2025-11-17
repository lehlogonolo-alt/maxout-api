require('dotenv').config(); // ✅ Load .env first
const mongoose = require('mongoose');
const Workout = require('./models/Workout');

// ✅ Use the actual value from .env
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

Workout.insertMany([
      { title: 'Squats', details: '10 min • 120 kcal', imageUrl: 'squatt.jpg' },
      { title: 'Push Ups', details: '10 min • 80 kcal', imageUrl: 'pushup.jpg' },
      { title: 'Abs', details: '10 min • 90 kcal', imageUrl: 'abs.jpg' },
      { title: 'Leg Day', details: '10 min • 90 kcal', imageUrl: 'legday.jpg' },
      { title: 'Full Body Stretching', details: '10 min • 90 kcal', imageUrl: 'stretching.jpg'},
      { title: 'Running', details: '10 min • 200 kcal', imageUrl: 'running.jpeg' }
]).then(() => {
  console.log('Workouts seeded');
  mongoose.disconnect();
});



