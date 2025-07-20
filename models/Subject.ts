// models/Subject.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import { IClass } from './Class';
import { ITag } from './Tag';

export interface ISubject extends Document {
  name: string;
  class: IClass['_id'];
  tags: ITag['_id'][];
  code: string;
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
    code: {
      type: String,
      required: [true, 'Subject code is required.'],
      trim: true,
    },
  },
  {
    timestamps: true,
    indexes: [{ fields: { name: 1, class: 1 }, unique: true }],
  }
);

// ✅ Indexes
SubjectSchema.index({ name: 1 });
SubjectSchema.index({ class: 1 });
SubjectSchema.index({ tags: 1 }); // Optimizes queries filtering subjects by tags

const Subject: Model<ISubject> =
  mongoose.models.Subject || mongoose.model<ISubject>('Subject', SubjectSchema);

export default Subject;
