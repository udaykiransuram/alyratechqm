import mongoose, { Schema, Document } from 'mongoose';

export interface IFAQ extends Document {
  page: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FAQSchema = new Schema<IFAQ>(
  {
    page: {
      type: String,
      required: true,
      enum: ['homepage', 'product', 'about', 'benefits', 'talent-test', 'case-study', 'contact'],
    },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.FAQ || mongoose.model<IFAQ>('FAQ', FAQSchema);
