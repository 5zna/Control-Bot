const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  guildId: { type: String, default: null },
  inviteLink: { type: String, required: true },
  bannerLink: { type: String, default: '' },
  userId: { type: String, required: true },
  timestamp: { type: String, required: true },
  posted: { type: Boolean, default: false },
  postedAt: { type: String, default: null },
  messageId: { type: String, default: null },
  channelId: { type: String, default: null },
});

serverSchema.index({ id: 1 }, { unique: true });

module.exports = mongoose.model('Server', serverSchema);
