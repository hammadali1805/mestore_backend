import express from 'express';
import { authenticate, authorizeAdmin } from '../middleware/auth.js';
import DeliveryGuy from '../models/DeliveryGuy.js';

const router = express.Router();

// Get all delivery guys
router.get('/', authenticate, async (req, res) => {
  try {
    const deliveryGuys = await DeliveryGuy.find({ isActive: true });
    res.json(deliveryGuys);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching delivery guys', error: error.message });
  }
});

// Create delivery guy (admin only)
router.post('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const deliveryGuy = await DeliveryGuy.create({
      name,
      phone
    });

    res.status(201).json(deliveryGuy);
  } catch (error) {
    res.status(500).json({ message: 'Error creating delivery guy', error: error.message });
  }
});

// Update delivery guy (admin only)
router.put('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const deliveryGuy = await DeliveryGuy.findByIdAndUpdate(
      req.params.id,
      { name, phone },
      { new: true, runValidators: true }
    );

    if (!deliveryGuy) {
      return res.status(404).json({ message: 'Delivery guy not found' });
    }

    res.json(deliveryGuy);
  } catch (error) {
    res.status(500).json({ message: 'Error updating delivery guy', error: error.message });
  }
});

export default router;
