import mongoose, { Document, Model, Schema } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

export interface IRegistration extends Document {
  studentName?: string;
  guardianName?: string;
  phone?: string;
  schoolKey?: string;
  schoolName?: string;
  classId?: string;
  classLevel?: string;
  sectionId?: string;
  sectionName?: string;
  aadhar?: string;
  careerAspiration?: string;
  rollNumber?: string;
  amount?: number;
  currency?: string;
  orderId?: string;
  status?: string;
  hallTicket?: string;
  hallTicketWhatsappSent?: boolean;
  reportWhatsappSent?: boolean;
}

const RegistrationSchema: Schema<IRegistration> = new Schema(
  {
    studentName: String,
    guardianName: String,
    phone: String,
    schoolKey: String,
    schoolName: String,
    classId: String,
    classLevel: String,
    sectionId: String,
    sectionName: String,
    aadhar: String,
    careerAspiration: String,
    rollNumber: String,
    amount: Number,
    currency: String,
    orderId: String,
    status: { type: String, default: "pending" },
    hallTicket: String,
    hallTicketWhatsappSent: { type: Boolean, default: false },
    reportWhatsappSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const modelRegistry = getModelRegistry();

const Registration: Model<IRegistration> =
  (modelRegistry.Registration as Model<IRegistration>) ||
  mongoose.model<IRegistration>("Registration", RegistrationSchema);

export default Registration;
