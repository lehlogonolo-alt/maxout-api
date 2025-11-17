const mongoose = require('mongoose');
const ChatbotReportSchema = new mongoose.Schema({
  userId: { type: String },
  type: { type: String, enum: ['bug', 'support', 'about', 'download'], required: true },
  message: { type: String, required: true },
  meta: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' }
});
module.exports = mongoose.model('ChatbotReport', ChatbotReportSchema);
