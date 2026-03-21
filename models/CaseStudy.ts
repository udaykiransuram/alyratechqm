import mongoose, { Schema, Document } from 'mongoose';

export interface ICaseStudy extends Document {
  schoolName: string;
  location: string;
  studentCount: number;
  challenge: string;
  solution: string;
  results: string[];
  metrics: {
    label: string;
    before: string | number;
    after: string | number;
    improvement: string;
  }[];
  testimonial?: {
    quote: string;
    author: string;
    role: string;
  };
  isFeatured: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const CaseStudySchema = new Schema<ICaseStudy>({
  schoolName: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  studentCount: {
    type: Number,
    required: true,
  },
  challenge: {
    type: String,
    required: true,
  },
  solution: {
    type: String,
    required: true,
  },
  results: [{
    type: String,
  }],
  metrics: [{
    label: { type: String, required: true },
    before: { type: Schema.Types.Mixed, required: true },
    after: { type: Schema.Types.Mixed, required: true },
    improvement: { type: String, required: true },
  }],
  testimonial: {
    quote: String,
    author: String,
    role: String,
  },
  isFeatured: {
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
}, {
  timestamps: true,
});

export default mongoose.models.CaseStudy || mongoose.model<ICaseStudy>('CaseStudy', CaseStudySchema);
