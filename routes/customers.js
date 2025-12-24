import express from 'express';
import { authenticate, authorizeAdmin } from '../middleware/auth.js';
import Customer from '../models/Customer.js';

const router = express.Router();

// Get all customers
router.get('/', authenticate, async (req, res) => {
  try {
    let query = { isActive: true };
    
    // If agent, only show assigned customers
    if (req.user.role === 'agent') {
      query.assignedAgent = req.user._id;
    }

    const customers = await Customer.find(query)
      .populate('assignedAgent', 'name phone')
      .populate('assignedDeliveryGuy', 'name phone');
    
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers', error: error.message });
  }
});

// Get single customer
router.get('/:id', authenticate, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('assignedAgent', 'name phone')
      .populate('assignedDeliveryGuy', 'name phone');
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if agent is authorized to view this customer
    if (req.user.role === 'agent' && customer.assignedAgent?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer', error: error.message });
  }
});

// Create customer (admin only)
router.post('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { name, phone, address, assignedAgent, assignedDeliveryGuy } = req.body;

    const customer = await Customer.create({
      name,
      phone,
      address,
      assignedAgent,
      assignedDeliveryGuy
    });

    const populatedCustomer = await Customer.findById(customer._id)
      .populate('assignedAgent', 'name phone')
      .populate('assignedDeliveryGuy', 'name phone');

    res.status(201).json(populatedCustomer);
  } catch (error) {
    res.status(500).json({ message: 'Error creating customer', error: error.message });
  }
});

// Update customer (admin only)
router.put('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { name, phone, address, assignedAgent, assignedDeliveryGuy } = req.body;

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { name, phone, address, assignedAgent, assignedDeliveryGuy },
      { new: true, runValidators: true }
    )
      .populate('assignedAgent', 'name phone')
      .populate('assignedDeliveryGuy', 'name phone');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error updating customer', error: error.message });
  }
});

export default router;
