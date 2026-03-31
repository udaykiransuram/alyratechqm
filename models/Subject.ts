// models/Subject.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { applyArchiveFields, hasArchiveFields } from '@/lib/archive';
import { getModelRegistry } from '@/lib/mongoose-models';
import type { ITag } from './Tag.ts';

export interface ISubject extends Document {
  name: string;
  tags: ITag['_id'][];
  code?: string;
  description?: string;
  isArchived?: boolean;
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
}

const SubjectSchema: Schema<ISubject> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required.'],
      trim: true,
    }, 
    tags: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    description: {
      type: String,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Indexes
SubjectSchema.index({ name: 1 }, { unique: true });
SubjectSchema.index({ tags: 1 }); // Optimizes queries filtering subjects by tags

applyArchiveFields(SubjectSchema);

const modelRegistry = getModelRegistry();

const existingSubjectModel = modelRegistry.Subject as Model<ISubject> | undefined;

if (existingSubjectModel && !hasArchiveFields(existingSubjectModel)) {
  delete modelRegistry.Subject;
}

const Subject: Model<ISubject> =
  (modelRegistry.Subject as Model<ISubject>) ||
  mongoose.model<ISubject>('Subject', SubjectSchema);

export default Subject;
