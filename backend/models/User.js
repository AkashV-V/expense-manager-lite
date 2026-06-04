const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  mobile: { type: String, sparse: true },
  googleId: { type: String, sparse: true },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
