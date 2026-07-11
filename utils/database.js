const mongoose = require('mongoose');

let isConnected = false;

async function connectDatabase() {
  if (isConnected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');
  await mongoose.connect(uri);
  isConnected = true;
  console.log('[DB] Connected to MongoDB');
}

async function disconnectDatabase() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[DB] Disconnected from MongoDB');
}

module.exports = { connectDatabase, disconnectDatabase };
