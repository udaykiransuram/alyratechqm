import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string; // Never store plain-text passwords
  role: 'admin' | 'teacher' | 'student';
  // Student-specific fields (optional)
  class?: Types.ObjectId;
  rollNumber?: string;
  enrolledAt?: Date;
}

const UserSchema: Schema<IUser> = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: false, unique: true, sparse: true },
  passwordHash: { type: String, required: false },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'teacher', 'student'],
    default: 'teacher',
  },
  // Student-specific fields
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: function (this: IUser) { return this.role === 'student'; },
  },
  rollNumber: {
    type: String,
    trim: true,
    required: function (this: IUser) { return this.role === 'student'; },
  },
  enrolledAt: {
    type: Date,
    default: function (this: IUser) { return this.role === 'student' ? Date.now() : undefined; },
  },
}, { timestamps: true });

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;