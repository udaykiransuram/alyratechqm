import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./User.ts";
import "./Class.ts";
import "./AcademicSection.ts";
import "./Subject.ts";
import "./Tag.ts";

export interface IStudentTagWeakness extends Document {
  student: Types.ObjectId;
  class: Types.ObjectId;
  academicSection?: Types.ObjectId | null;
  subject?: Types.ObjectId | null;
  tag: Types.ObjectId;
  weaknessScore: number;
  accuracyPct: number;
  attemptCount: number;
  status: "active" | "resolved";
  lastDetectedAt?: Date | null;
  lastSentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const StudentTagWeaknessSchema = new Schema<IStudentTagWeakness>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    academicSection: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSection",
      default: null,
      index: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },
    tag: {
      type: Schema.Types.ObjectId,
      ref: "Tag",
      required: true,
      index: true,
    },
    weaknessScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    accuracyPct: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "resolved"],
      default: "active",
      index: true,
    },
    lastDetectedAt: {
      type: Date,
      default: null,
    },
    lastSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

StudentTagWeaknessSchema.index(
  { student: 1, tag: 1 },
  { unique: true, name: "student_tag_weakness_unique_1" },
);
StudentTagWeaknessSchema.index(
  { class: 1, tag: 1, status: 1 },
  { name: "student_tag_weakness_class_tag_status_1" },
);

const modelRegistry = getModelRegistry();

const existingStudentTagWeaknessModel =
  modelRegistry.StudentTagWeakness as Model<IStudentTagWeakness> | undefined;

if (
  existingStudentTagWeaknessModel &&
  (!existingStudentTagWeaknessModel.schema.path("weaknessScore") ||
    !existingStudentTagWeaknessModel.schema.path("lastSentAt"))
) {
  delete modelRegistry.StudentTagWeakness;
}

const StudentTagWeakness: Model<IStudentTagWeakness> =
  (modelRegistry.StudentTagWeakness as Model<IStudentTagWeakness>) ||
  mongoose.model<IStudentTagWeakness>(
    "StudentTagWeakness",
    StudentTagWeaknessSchema,
  );

export default StudentTagWeakness;
