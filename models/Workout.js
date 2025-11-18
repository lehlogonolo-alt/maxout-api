const mongoose = require('mongoose');

const WorkoutSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    details: { type: String, required: true },
    imageUrl: { type: String }
  },
  { timestamps: true } //  adds createdAt and updatedAt automatically
);

module.exports = mongoose.model('Workout', WorkoutSchema);




