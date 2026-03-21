import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteStats extends Document {
  section: 'homepage' | 'about' | 'casestudy' | 'benefits';
  stats: {
    key: string;
    label: string;
    value: string | number;
    icon?: string;
  }[];
  updatedAt: Date;
}

const SiteStatsSchema = new Schema<ISiteStats>({
  section: {
    type: String,
    required: true,
    enum: ['homepage', 'about', 'casestudy', 'benefits'],
    unique: true,
  },
  stats: [{
    key: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    icon: { type: String },
  }],
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.SiteStats || mongoose.model<ISiteStats>('SiteStats', SiteStatsSchema);
