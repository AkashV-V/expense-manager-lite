const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, mobile, password } = req.body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate mobile: exactly 10 digits
    const mobileRegex = /^\d{10}$/;
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({ message: 'Mobile must be exactly 10 digits' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Generate username from email
    const username = email.split('@')[0] + Date.now();

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      fullName,
      email: email.toLowerCase(),
      mobile,
      username,
      password: hashedPassword
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
    const { identifier, password } = req.body;
    const searchIdentifier = typeof identifier === 'string' ? identifier.toLowerCase() : identifier;

    // Find user
    const user = await User.findOne({
      $or: [
        { email: searchIdentifier },
        { mobile: identifier }
      ]
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
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
        username: user.username,
        email: user.email
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GOOGLE OAUTH
router.post('/google', async (req, res) => {
  try {
    const { fullName, email, googleId, authProvider } = req.body;
    
    // Check if user exists
    let user = await User.findOne({ 
      $or: [{ email }, { googleId }] 
    });
    
    if (!user) {
      // Create new user
      user = new User({
        fullName,
        email,
        username: email.split('@')[0] + Date.now(),
        googleId,
        authProvider: 'google',
        password: 'google-oauth-' + googleId
      });
      await user.save();
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
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
