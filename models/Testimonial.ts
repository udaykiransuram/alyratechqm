import mongoose, { Schema, Document } from 'mongoose';

export interface ITestimonial extends Document {
  section: 'homepage' | 'benefits' | 'product' | 'casestudy';
  quote: string;
  author: string;
  role: string;
  school?: string;
  location?: string;
  rating?: number;
  image?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const TestimonialSchema = new Schema<ITestimonial>({
  section: {
    type: String,
    required: true,
    enum: ['homepage', 'benefits', 'product', 'casestudy'],
  },
  quote: {
    type: String,
    required: true,
  },
  author: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  school: String,
  location: String,
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  image: String,
  isActive: {
    type: Boolean,
    default: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

export default mongoose.models.Testimonial || mongoose.model<ITestimonial>('Testimonial', TestimonialSchema);
