import express from 'express';
import { authenticate, authorizeAdmin } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Get all agents
router.get('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' }).select('-password');
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching agents', error: error.message });
  }
});

// Create new agent
router.post('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { name, phone, username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const agent = await User.create({
      name,
      phone,
      username,
      password,
      role: 'agent'
    });

    const agentData = agent.toObject();
    delete agentData.password;

    res.status(201).json(agentData);
  } catch (error) {
    res.status(500).json({ message: 'Error creating agent', error: error.message });
  }
});

// Update agent
router.put('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { name, phone, username, password } = req.body;
    
    const updateData = { name, phone, username };
    if (password) {
      updateData.password = password;
    }

    const agent = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json(agent);
  } catch (error) {
    res.status(500).json({ message: 'Error updating agent', error: error.message });
  }
});

export default router;
