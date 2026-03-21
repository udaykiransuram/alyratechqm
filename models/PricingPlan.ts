import mongoose, { Schema, Document } from 'mongoose';

export interface IPricingPlan extends Document {
  name: string;
  description: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly' | 'one-time';
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  displayOrder: number;
  studentLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PricingPlanSchema = new Schema<IPricingPlan>({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  billingPeriod: {
    type: String,
    enum: ['monthly', 'yearly', 'one-time'],
    default: 'yearly',
  },
  features: [{
    type: String,
  }],
  isPopular: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  studentLimit: Number,
}, {
  timestamps: true,
});

export default mongoose.models.PricingPlan || mongoose.model<IPricingPlan>('PricingPlan', PricingPlanSchema);
