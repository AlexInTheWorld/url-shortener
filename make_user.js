const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userIP: String,
  urls: {
    original: [String], 
    short: [Number]
  }
});

const User = mongoose.model('User', userSchema);
// ============================================= //

exports.User = User;