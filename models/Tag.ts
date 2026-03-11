import mongoose, { Document, Model, Schema } from 'mongoose';
import { applyArchiveFields, hasArchiveFields } from '@/lib/archive';
import type { ITagType } from './TagType.ts';

export interface ITag extends Document {
  name: string;
  type: ITagType['_id'];
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

const existingTagModel = mongoose.models.Tag as Model<ITag> | undefined;

if (existingTagModel && !hasArchiveFields(existingTagModel)) {
  delete mongoose.models.Tag;
}

const Tag: Model<ITag> =
  (mongoose.models.Tag as Model<ITag>) ||
  mongoose.model<ITag>('Tag', TagSchema);

export default Tag;
