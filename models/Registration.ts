import mongoose from 'mongoose';

const RegistrationSchema = new mongoose.Schema({
  studentName: String,
  guardianName: String,
  phone: String,
  classLevel: String,
  aadhar: String,
  careerAspiration: String,
  orderId: String,
  status: { type: String, default: 'pending' }, // pending | paid
  hallTicket: String,
  hallTicketWhatsappSent: { type: Boolean, default: false }, // Track WhatsApp status
  reportWhatsappSent: { type: Boolean, default: false },     // Track report WhatsApp status
}, { timestamps: true });

export default mongoose.models.Registration || mongoose.model('Registration', RegistrationSchema);