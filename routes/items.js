import express from 'express';
import { authenticate, authorizeAdmin } from '../middleware/auth.js';
import Item from '../models/Item.js';

const router = express.Router();

// Get all items
router.get('/', authenticate, async (req, res) => {
  try {
    const items = await Item.find({ isActive: true });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching items', error: error.message });
  }
});

// Create item (admin only)
router.post('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    const item = await Item.create({ name });

    res.status(201).json(item);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Item already exists' });
    }
    res.status(500).json({ message: 'Error creating item', error: error.message });
  }
});

// Update item (admin only)
router.put('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error updating item', error: error.message });
  }
});

export default router;
