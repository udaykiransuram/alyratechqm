// models/Tag.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import { ITagType } from './TagType';

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
      ref: 'TagType', // Creates a reference to the TagType model
      required: [true, 'Tag type is required.'],
    },
  },
  {
    timestamps: true,
    // --- REMOVE any direct reference to Class or Subject here ---
    // --- ADD THIS COMPOUND INDEX ---
    // This ensures that the combination of 'name' and 'type' is unique.
    indexes: [
      { fields: { name: 1, type: 1 }, unique: true }
    ]
  }
);

const Tag: Model<ITag> = mongoose.models.Tag || mongoose.model<ITag>('Tag', TagSchema);

export default Tag;