import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./User.ts";
import "./Class.ts";
import "./AcademicSection.ts";
import "./Subject.ts";
import "./Tag.ts";

export interface IStudentTagPerformance extends Document {
  student: Types.ObjectId;
  class: Types.ObjectId;
  academicSection?: Types.ObjectId | null;
  subject?: Types.ObjectId | null;
  tag: Types.ObjectId;
  attemptCount: number;
  questionCount: number;
  accuracyPct: number;
  trendDelta: number;
  percentile?: number | null;
  peerMedianAccuracy?: number | null;
  lastAttemptAt?: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

const StudentTagPerformanceSchema = new Schema<IStudentTagPerformance>(
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
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    questionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    accuracyPct: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    trendDelta: {
      type: Number,
      default: 0,
    },
    percentile: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    peerMedianAccuracy: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

StudentTagPerformanceSchema.index(
  { student: 1, tag: 1 },
  { unique: true, name: "student_tag_performance_unique_1" },
);
StudentTagPerformanceSchema.index(
  { class: 1, academicSection: 1, tag: 1 },
  { name: "student_tag_performance_group_1" },
);

const modelRegistry = getModelRegistry();

const existingStudentTagPerformanceModel =
  modelRegistry.StudentTagPerformance as Model<IStudentTagPerformance> | undefined;

if (
  existingStudentTagPerformanceModel &&
  (!existingStudentTagPerformanceModel.schema.path("trendDelta") ||
    !existingStudentTagPerformanceModel.schema.path("peerMedianAccuracy"))
) {
  delete modelRegistry.StudentTagPerformance;
}

const StudentTagPerformance: Model<IStudentTagPerformance> =
  (modelRegistry.StudentTagPerformance as Model<IStudentTagPerformance>) ||
  mongoose.model<IStudentTagPerformance>(
    "StudentTagPerformance",
    StudentTagPerformanceSchema,
  );

export default StudentTagPerformance;
