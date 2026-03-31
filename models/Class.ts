import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { applyArchiveFields, hasArchiveFields } from '@/lib/archive';
import { getModelRegistry } from '@/lib/mongoose-models';

export interface IClass extends Document {
  name: string;
  description?: string;
  isArchived?: boolean;
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
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

const modelRegistry = getModelRegistry();

const existingClassModel = modelRegistry.Class as Model<IClass> | undefined;

if (existingClassModel && !hasArchiveFields(existingClassModel)) {
  delete modelRegistry.Class;
}

const Class: Model<IClass> =
  (modelRegistry.Class as Model<IClass>) ||
  mongoose.model<IClass>('Class', ClassSchema);

export default Class;
