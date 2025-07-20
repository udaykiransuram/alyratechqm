import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * @interface ITagType
 * @description Defines the structure for a TagType document in MongoDB.
 * @property {string} name - The unique name of the tag type (e.g., "difficulty", "topic").
 */
export interface ITagType extends Document {
  name: string;
}

const TagTypeSchema: Schema<ITagType> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Tag type name is required.'],
      unique: true,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

const TagType: Model<ITagType> = mongoose.models.TagType || mongoose.model<ITagType>('TagType', TagTypeSchema);

export default TagType;