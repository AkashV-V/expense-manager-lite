const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// GOOGLE LOGIN
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    // Find or create user
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if email already exists (manual account)
      user = await User.findOne({ username: email.toLowerCase() });
      if (user) {
        // Link Google ID to existing account
        user.googleId = googleId;
        await user.save();
      } else {
        // Create new user from Google
        user = new User({
          fullName: name,
          username: email.toLowerCase(),
          googleId,
          password: await bcrypt.hash(googleId + Date.now(), 10) // dummy password
        });
        await user.save();
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, username: user.username, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, fullName: user.fullName, username: user.username }
    });

  } catch (err) {
    console.error('Google auth error:', err);
    if (err.name?.includes('Mongo') || err.name?.includes('Mongoose') || err.message?.includes('buffering timed out')) {
      return res.status(500).json({ message: 'Database connection error. Please check backend MongoDB logs.' });
    }
    res.status(401).json({ message: 'Invalid Google token' });
  }
});

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { fullName, username, password, mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Check if mobile number exists
    const existingMobile = await User.findOne({ mobileNumber });
    if (existingMobile) {
      return res.status(400).json({ message: 'Mobile number already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      fullName,
      username: username.toLowerCase(),
      password: hashedPassword,
      mobileNumber
    });

    await user.save();
    res.status(201).json({ message: 'Account created successfully!' });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user by username or mobileNumber
    const user = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { mobileNumber: username }
      ]
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, username: user.username, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
