const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Workout = require('./models/Workout');



const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// GET /workouts
app.get('/workouts', async (req, res) => {
  try {
    const workouts = await Workout.find();
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
});

// POST /favourites (optional for future use)
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

