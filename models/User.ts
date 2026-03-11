import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { applyArchiveFields, hasArchiveFields } from "@/lib/archive";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string; // Never store plain-text passwords
  role: "admin" | "teacher" | "student";
  mobileNumber: string;
  class?: Types.ObjectId;
  academicSection?: Types.ObjectId;
  classIds?: Types.ObjectId[];
  academicSectionIds?: Types.ObjectId[];
  subjectIds?: Types.ObjectId[];
  hasAllClasses?: boolean;
  hasAllSections?: boolean;
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
    academicSectionIds: [
      { type: Schema.Types.ObjectId, ref: "AcademicSection" },
    ],
    subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
    hasAllClasses: {
      type: Boolean,
      default: false,
    },
    hasAllSections: {
      type: Boolean,
      default: true,
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
    academicSection: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSection",
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
    if (typeof this.hasAllSections !== "boolean") {
      this.hasAllSections = true;
    }
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
    this.academicSectionIds = undefined;
    this.subjectIds = undefined;
    this.hasAllClasses = false;
    this.hasAllSections = false;
    this.hasAllSubjects = false;
  }

  next();
});

UserSchema.index({ role: 1, class: 1, rollNumber: 1 });
UserSchema.index({ role: 1, class: 1, academicSection: 1, rollNumber: 1 });
UserSchema.index({ academicSection: 1 });

applyArchiveFields(UserSchema);

const existingUserModel = mongoose.models.User as Model<IUser> | undefined;

if (
  existingUserModel &&
  (!existingUserModel.schema.path("academicSection") ||
    !existingUserModel.schema.path("academicSectionIds") ||
    !existingUserModel.schema.path("classIds") ||
    !existingUserModel.schema.path("hasAllSections") ||
    !hasArchiveFields(existingUserModel))
) {
  delete mongoose.models.User;
}

const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);

export default User;
