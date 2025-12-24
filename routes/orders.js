import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';

const router = express.Router();

// Helper function to get IST date (UTC+5:30)
const getISTDate = () => {
  const now = new Date();
  // Convert to IST by adding 5 hours 30 minutes
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
};

const parseISTDate = (dateString) => {
  // Parse date string as IST
  const date = new Date(dateString + 'T00:00:00+05:30');
  return date;
};

// Get orders with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, customerId } = req.query;
    let query = {};

    // If agent, only show their orders
    if (req.user.role === 'agent') {
      query.agent = req.user._id;
    }

    // Filter by date (IST)
    if (date) {
      const startDate = parseISTDate(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = parseISTDate(date);
      endDate.setHours(23, 59, 59, 999);
      query.orderDate = { $gte: startDate, $lte: endDate };
    }

    // Filter by customer
    if (customerId) {
      query.customer = customerId;
    }

    const orders = await Order.find(query)
      .populate('customer', 'name phone address')
      .populate('agent', 'name phone')
      .populate('deliveryGuy', 'name phone')
      .populate('item', 'name')
      .sort({ orderDate: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
});

// Get today's customer statuses for agent
router.get('/today-status', authenticate, async (req, res) => {
  try {
    // Get today's date range in IST (00:00 to 23:59 IST)
    // IST is UTC+5:30, so we need to subtract 5:30 from IST midnight to get UTC time
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    
    // Calculate IST date
    const istNow = new Date(now.getTime() + istOffset);
    const istDateStr = istNow.toISOString().split('T')[0]; // YYYY-MM-DD in IST
    
    // Parse as UTC date and calculate the UTC times for IST day boundaries
    const [year, month, day] = istDateStr.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    startDate.setTime(startDate.getTime() - istOffset); // Convert IST midnight to UTC
    
    const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    endDate.setTime(endDate.getTime() - istOffset); // Convert IST end of day to UTC

    // Get agent's customers
    const customers = await Customer.find({ 
      assignedAgent: req.user._id,
      isActive: true 
    }).populate('assignedDeliveryGuy', 'name phone');

    // Get today's orders for these customers
    const customerIds = customers.map(c => c._id);
    const todayOrders = await Order.find({
      customer: { $in: customerIds },
      orderDate: { $gte: startDate, $lte: endDate }
    })
    .populate('item', 'name')
    .populate('agent', 'name phone')
    .populate('deliveryGuy', 'name phone')
    .sort({ orderDate: -1, createdAt: -1 }); // Sort by newest first

    // Combine customer info with their LATEST order status
    const customerStatuses = customers.map(customer => {
      // Find the latest order for this customer (first in sorted array)
      const order = todayOrders.find(o => o.customer.toString() === customer._id.toString());
      return {
        customer,
        order: order || null,
        hasOrder: !!order
      };
    });
    res.json(customerStatuses);
  } catch (error) {
    console.error('Error in today-status:', error);
    res.status(500).json({ message: 'Error fetching today status', error: error.message });
  }
});

// Get customer statuses for a specific date (for history)
router.get('/status-by-date', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' });
    }

    // Parse the date and calculate UTC range for IST day boundaries
    // Input format: YYYY-MM-DD (interpreted as IST date)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const [year, month, day] = date.split('-').map(Number);
    
    const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    startDate.setTime(startDate.getTime() - istOffset); // Convert IST midnight to UTC
    
    const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    endDate.setTime(endDate.getTime() - istOffset); // Convert IST end of day to UTC

    // Get agent's customers that existed and were assigned on or before the selected date
    const customers = await Customer.find({ 
      assignedAgent: req.user._id,
      isActive: true,
      createdAt: { $lte: endDate } // Only customers created on or before this date
    }).populate('assignedDeliveryGuy', 'name phone');

    // Get orders for these customers on the specified date
    const customerIds = customers.map(c => c._id);
    const orders = await Order.find({
      customer: { $in: customerIds },
      orderDate: { $gte: startDate, $lte: endDate }
    })
    .populate('item', 'name')
    .populate('agent', 'name phone')
    .populate('deliveryGuy', 'name phone')
    .sort({ orderDate: -1, createdAt: -1 }); // Sort by newest first

    // Combine customer info with their LATEST order status
    const customerStatuses = customers.map(customer => {
      // Find the latest order for this customer (first in sorted array)
      const order = orders.find(o => o.customer.toString() === customer._id.toString());
      return {
        customer,
        order: order || null,
        hasOrder: !!order
      };
    });
    res.json(customerStatuses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching status by date', error: error.message });
  }
});

// Create order
router.post('/', authenticate, async (req, res) => {
  try {
    const { customer, item, pieces, status, notes } = req.body;

    // Get customer to capture current assignments
    const customerDoc = await Customer.findById(customer);
    if (!customerDoc) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Verify customer is assigned to this agent (if not admin)
    if (req.user.role === 'agent') {
      if (customerDoc.assignedAgent.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to create order for this customer' });
      }

      // Agents can only create orders with 'called' status or 'pending'
      if (status && !['pending', 'called'].includes(status)) {
        return res.status(400).json({ message: 'New orders can only be created with pending or called status' });
      }
    }

    const order = await Order.create({
      customer,
      agent: req.user._id,
      deliveryGuy: customerDoc.assignedDeliveryGuy, // Capture current delivery guy
      item,
      pieces,
      status: status || 'pending',
      notes
    });

    const populatedOrder = await Order.findById(order._id)
      .populate('customer', 'name phone address')
      .populate('agent', 'name phone')
      .populate('deliveryGuy', 'name phone')
      .populate('item', 'name');

    res.status(201).json(populatedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
});

// Update order status
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { status, pieces, item, notes } = req.body;

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check authorization
    if (req.user.role === 'agent' && order.agent.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    // Validate sequential status progression for agents
    if (req.user.role === 'agent' && status) {
      // Allow cancellation from any status except delivered and already cancelled
      if (status === 'cancelled') {
        if (order.status === 'delivered' || order.status === 'cancelled') {
          return res.status(400).json({ 
            message: `Cannot cancel an order that is already ${order.status}.` 
          });
        }
        // Allow cancellation to proceed
      } else {
        // For other status changes, enforce sequential progression
        const validTransitions = {
          'pending': ['called'],
          'called': ['order_placed'],
          'order_placed': ['delivered'],
          'delivered': [],
          'cancelled': []
        };

        const allowedNextStatuses = validTransitions[order.status] || [];
        
        if (!allowedNextStatuses.includes(status)) {
          return res.status(400).json({ 
            message: `Cannot change status from ${order.status} to ${status}. Status must progress sequentially.` 
          });
        }

        // When transitioning from called to order_placed, item and pieces are required
        if (order.status === 'called' && status === 'order_placed') {
          if (!item || !pieces) {
            return res.status(400).json({ 
              message: 'Item and pieces are required when placing an order' 
            });
          }
        }
      }
    }

    // Update fields
    if (status) order.status = status;
    if (pieces) order.pieces = pieces;
    if (item) order.item = item;
    if (notes !== undefined) order.notes = notes;

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate('customer', 'name phone address')
      .populate('agent', 'name phone')
      .populate('deliveryGuy', 'name phone')
      .populate('item', 'name');

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Error updating order', error: error.message });
  }
});

// Get order history for a customer
router.get('/history/:customerId', authenticate, async (req, res) => {
  try {
    const { customerId } = req.params;

    // Verify access
    if (req.user.role === 'agent') {
      const customer = await Customer.findById(customerId);
      if (!customer || customer.assignedAgent.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const orders = await Order.find({ customer: customerId })
      .populate('item', 'name')
      .populate('agent', 'name')
      .sort({ orderDate: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order history', error: error.message });
  }
});

export default router;
