
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISchool extends Document {
  key: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

const SchoolSchema: Schema<ISchool> = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const School: Model<ISchool> = mongoose.models.School || mongoose.model<ISchool>('School', SchoolSchema);
export default School;
