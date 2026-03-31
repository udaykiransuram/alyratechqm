import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { applyArchiveFields, hasArchiveFields } from '@/lib/archive';
import { getModelRegistry } from '@/lib/mongoose-models';
import type { ITagType } from './TagType.ts';

export interface ITag extends Document {
  name: string;
  type: ITagType['_id'];
  isArchived?: boolean;
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
}

const TagSchema: Schema<ITag> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Tag name is required.'],
      trim: true,
    },
    type: {
      type: Schema.Types.ObjectId,
      ref: 'TagType',
      required: [true, 'Tag type is required.'],
    },
  },
  {
    timestamps: true,
    indexes: [{ fields: { name: 1, type: 1 }, unique: true }],
  },
);

applyArchiveFields(TagSchema);

const modelRegistry = getModelRegistry();

const existingTagModel = modelRegistry.Tag as Model<ITag> | undefined;

if (existingTagModel && !hasArchiveFields(existingTagModel)) {
  delete modelRegistry.Tag;
}

const Tag: Model<ITag> =
  (modelRegistry.Tag as Model<ITag>) ||
  mongoose.model<ITag>('Tag', TagSchema);

export default Tag;
