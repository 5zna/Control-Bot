const mongoose = require('mongoose');

const pendingSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  guildId: { type: String, default: null },
  inviteLink: { type: String, required: true },
  bannerLink: { type: String, default: '' },
  userId: { type: String, required: true },
  timestamp: { type: String, required: true },
});

pendingSchema.index({ id: 1 }, { unique: true });

module.exports = mongoose.model('Pending', pendingSchema);
