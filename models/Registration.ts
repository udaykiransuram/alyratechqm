import mongoose from 'mongoose';

const RegistrationSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  classLevel: String,
  orderId: String,
  status: { type: String, default: 'pending' }, // pending | paid
}, { timestamps: true });

export default mongoose.models.Registration || mongoose.model('Registration', RegistrationSchema);