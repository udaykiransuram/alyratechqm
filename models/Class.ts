import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClass extends Document {
  name: string; // e.g., "Grade 10", "Class XII"
  description?: string;
}

const ClassSchema: Schema<IClass> = new Schema({
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
}, { timestamps: true });

const Class: Model<IClass> = mongoose.models.Class || mongoose.model<IClass>('Class', ClassSchema);

export default Class;