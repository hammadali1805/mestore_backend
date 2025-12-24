import mongoose from 'mongoose';

const deliveryGuySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export default mongoose.model('DeliveryGuy', deliveryGuySchema);
