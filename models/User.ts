import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string; // Never store plain-text passwords
  role: "admin" | "teacher" | "student";
  mobileNumber: string;
  class?: Types.ObjectId;
  classIds?: Types.ObjectId[];
  subjectIds?: Types.ObjectId[];
  hasAllClasses?: boolean;
  hasAllSubjects?: boolean;
  // Student-specific fields (optional)
  rollNumber?: string;
  enrolledAt?: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: false, unique: true, sparse: true },
    passwordHash: { type: String, required: false },
    mobileNumber: { type: String, required: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ["admin", "teacher", "student"],
      default: "teacher",
    },
    classIds: [{ type: Schema.Types.ObjectId, ref: "Class" }],
    subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
    hasAllClasses: {
      type: Boolean,
      default: false,
    },
    hasAllSubjects: {
      type: Boolean,
      default: false,
    },
    // Student-specific fields
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: function (this: IUser) {
        return this.role === "student";
      },
    },
    rollNumber: {
      type: String,
      trim: true,
      required: function (this: IUser) {
        return this.role === "student";
      },
    },
    enrolledAt: {
      type: Date,
      default: function (this: IUser) {
        return this.role === "student" ? Date.now() : undefined;
      },
    },
  },
  { timestamps: true },
);

UserSchema.pre("validate", function (next) {
  if (!this.mobileNumber || !String(this.mobileNumber).trim()) {
    this.invalidate("mobileNumber", "Phone number is required.");
  }

  if (this.role === "teacher") {
    if (!Array.isArray(this.classIds) || this.classIds.length === 0) {
      this.invalidate(
        "classIds",
        "At least one class is required for teachers.",
      );
    }
    if (!Array.isArray(this.subjectIds) || this.subjectIds.length === 0) {
      this.invalidate(
        "subjectIds",
        "At least one subject is required for teachers.",
      );
    }
    this.hasAllClasses = false;
    this.hasAllSubjects = false;
  }

  if (this.role === "admin") {
    const hasClasses =
      this.hasAllClasses ||
      (Array.isArray(this.classIds) && this.classIds.length > 0);
    const hasSubjects =
      this.hasAllSubjects ||
      (Array.isArray(this.subjectIds) && this.subjectIds.length > 0);

    if (!hasClasses) {
      this.invalidate(
        "classIds",
        "Admins must have all classes or at least one selected class.",
      );
    }
    if (!hasSubjects) {
      this.invalidate(
        "subjectIds",
        "Admins must have all subjects or at least one selected subject.",
      );
    }
  }

  if (this.role === "student") {
    this.classIds = undefined;
    this.subjectIds = undefined;
    this.hasAllClasses = false;
    this.hasAllSubjects = false;
  }

  next();
});

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
