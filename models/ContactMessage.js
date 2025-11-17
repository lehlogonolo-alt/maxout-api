const mongoose = require('mongoose');
const ContactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, default: '' },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' }
});
module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
