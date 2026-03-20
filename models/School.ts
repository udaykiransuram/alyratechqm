
import mongoose, { Schema, Document, Model } from 'mongoose';
import { getModelRegistry } from '@/lib/mongoose-models';

export interface ISchool extends Document {
  key: string;
  displayName: string;
  bootstrapAdminUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SchoolSchema: Schema<ISchool> = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true },
    bootstrapAdminUserId: { type: String, trim: true },
  },
  { timestamps: true }
);

const modelRegistry = getModelRegistry();

const School: Model<ISchool> =
  (modelRegistry.School as Model<ISchool>) ||
  mongoose.model<ISchool>('School', SchoolSchema);
export default School;
