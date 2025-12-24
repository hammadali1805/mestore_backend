import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deliveryGuy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryGuy'
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  pieces: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['pending', 'called', 'order_placed', 'delivered', 'cancelled'],
    default: 'pending'
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String
  }
}, { timestamps: true });

// Index for efficient querying by date and agent
orderSchema.index({ orderDate: 1, agent: 1 });
orderSchema.index({ customer: 1, orderDate: -1 });

export default mongoose.model('Order', orderSchema);
