import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check for hardcoded admin credentials
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      // Check if admin user exists in DB
      let adminUser = await User.findOne({ username: process.env.ADMIN_USERNAME, role: 'admin' });
      
      // Create admin user if doesn't exist
      if (!adminUser) {
        adminUser = await User.create({
          name: 'Administrator',
          phone: '0000000000',
          username: process.env.ADMIN_USERNAME,
          password: process.env.ADMIN_PASSWORD,
          role: 'admin'
        });
      }

      const token = jwt.sign(
        { userId: adminUser._id, role: adminUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        token,
        user: {
          id: adminUser._id,
          name: adminUser.name,
          username: adminUser.username,
          role: adminUser.role
        }
      });
    }

    // Check for agent login
    const user = await User.findOne({ username, role: 'agent', isActive: true });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

export default router;
