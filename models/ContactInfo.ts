import mongoose, { Schema, Document } from 'mongoose';

export interface IContactInfo extends Document {
  email: string;
  phone: string;
  whatsappNumber?: string; // optional WhatsApp number
  address: string;
  city: string;
  tagline: string;
  responseTime: string;
  responseDescription: string;
  updatedAt: Date;
}

const ContactInfoSchema = new Schema<IContactInfo>({
  email: { type: String, required: true },
  phone: { type: String, required: true },
  whatsappNumber: { type: String },
  address: { type: String, required: true },
  city: { type: String, required: true },
  tagline: { type: String, required: true },
  responseTime: { type: String, required: true },
  responseDescription: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.ContactInfo || mongoose.model<IContactInfo>('ContactInfo', ContactInfoSchema);


