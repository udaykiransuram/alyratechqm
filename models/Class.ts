import mongoose, { Document, Model, Schema } from 'mongoose';
import { applyArchiveFields, hasArchiveFields } from '@/lib/archive';

export interface IClass extends Document {
  name: string;
  description?: string;
}

const ClassSchema: Schema<IClass> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required.'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

applyArchiveFields(ClassSchema);

const existingClassModel = mongoose.models.Class as Model<IClass> | undefined;

if (existingClassModel && !hasArchiveFields(existingClassModel)) {
  delete mongoose.models.Class;
}

const Class: Model<IClass> =
  (mongoose.models.Class as Model<IClass>) ||
  mongoose.model<IClass>('Class', ClassSchema);

export default Class;
