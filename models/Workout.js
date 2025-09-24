const mongoose = require('mongoose');

const WorkoutSchema = new mongoose.Schema({
  title: String,
  details: String,
  imageUrl: String
});

module.exports = mongoose.model('Workout', WorkoutSchema);


