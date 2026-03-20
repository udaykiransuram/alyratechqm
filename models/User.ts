import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { applyArchiveFields, hasArchiveFields } from "@/lib/archive";
import { getModelRegistry } from "@/lib/mongoose-models";

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
    const hasSelectedClasses =
      Array.isArray(this.classIds) && this.classIds.length > 0;
    const hasSelectedSubjects =
      Array.isArray(this.subjectIds) && this.subjectIds.length > 0;

    if (
      !this.hasAllClasses &&
      !this.hasAllSubjects &&
      !hasSelectedClasses &&
      !hasSelectedSubjects
    ) {
      this.hasAllClasses = true;
      this.hasAllSections = true;
      this.hasAllSubjects = true;
      this.classIds = [];
      this.academicSectionIds = [];
      this.subjectIds = [];
    }

    if (typeof this.hasAllSections !== "boolean") {
      this.hasAllSections = true;
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

const modelRegistry = getModelRegistry();

const existingUserModel = modelRegistry.User as Model<IUser> | undefined;

if (
  existingUserModel &&
  (!existingUserModel.schema.path("academicSection") ||
    !existingUserModel.schema.path("academicSectionIds") ||
    !existingUserModel.schema.path("classIds") ||
    !existingUserModel.schema.path("hasAllSections") ||
    !hasArchiveFields(existingUserModel))
) {
  delete modelRegistry.User;
}

const User: Model<IUser> =
  (modelRegistry.User as Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);

export default User;
