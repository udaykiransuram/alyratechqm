import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./User.ts";
import "./Class.ts";
import "./AcademicSection.ts";
import "./Subject.ts";
import "./Tag.ts";

export interface IStudentDailyProgress extends Document {
  student: Types.ObjectId;
  class: Types.ObjectId;
  academicSection?: Types.ObjectId | null;
  subject?: Types.ObjectId | null;
  date: string; // YYYY-MM-DD
  topicsCovered: string[];
  assessmentsAttempted: number;
  assessmentAccuracyPct: number | null;
  assessmentQuestionCount: number;
  homeworkAssigned: number;
  homeworkCompleted: number;
  homeworkAccuracyPct: number | null;
  timeSpentMinutes: number;
  liveSessionsAssigned: number;
  liveSessionsAttended: number;
  liveSessionsMissed: number;
  livePollsTotal: number;
  livePollsAnswered: number;
  livePollsCorrect: number;
  liveAttentionPct: number | null;
  liveRecoveryTag?: Types.ObjectId | null;
  primaryWeakTag?: Types.ObjectId | null;
  nextFocusText?: string;
  digestMessage?: string;
  digestStatus?: "pending" | "sent" | "skipped" | "failed";
  digestSentAt?: Date | null;
  digestError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const StudentDailyProgressSchema = new Schema<IStudentDailyProgress>(
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
    date: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    topicsCovered: {
      type: [String],
      default: [],
    },
    assessmentsAttempted: {
      type: Number,
      default: 0,
      min: 0,
    },
    assessmentAccuracyPct: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    assessmentQuestionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    homeworkAssigned: {
      type: Number,
      default: 0,
      min: 0,
    },
    homeworkCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    homeworkAccuracyPct: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    timeSpentMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    liveSessionsAssigned: {
      type: Number,
      default: 0,
      min: 0,
    },
    liveSessionsAttended: {
      type: Number,
      default: 0,
      min: 0,
    },
    liveSessionsMissed: {
      type: Number,
      default: 0,
      min: 0,
    },
    livePollsTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    livePollsAnswered: {
      type: Number,
      default: 0,
      min: 0,
    },
    livePollsCorrect: {
      type: Number,
      default: 0,
      min: 0,
    },
    liveAttentionPct: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    liveRecoveryTag: {
      type: Schema.Types.ObjectId,
      ref: "Tag",
      default: null,
    },
    primaryWeakTag: {
      type: Schema.Types.ObjectId,
      ref: "Tag",
      default: null,
    },
    nextFocusText: {
      type: String,
      trim: true,
      default: "",
    },
    digestMessage: {
      type: String,
      trim: true,
      default: "",
    },
    digestStatus: {
      type: String,
      enum: ["pending", "sent", "skipped", "failed"],
      default: "pending",
    },
    digestSentAt: {
      type: Date,
      default: null,
    },
    digestError: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true },
);

StudentDailyProgressSchema.index(
  { student: 1, date: 1 },
  { unique: true, name: "student_daily_progress_unique_1" },
);
StudentDailyProgressSchema.index(
  { class: 1, date: 1 },
  { name: "student_daily_progress_class_date_1" },
);

const modelRegistry = getModelRegistry();

const existingStudentDailyProgressModel =
  modelRegistry.StudentDailyProgress as Model<IStudentDailyProgress> | undefined;

if (
  existingStudentDailyProgressModel &&
  (!existingStudentDailyProgressModel.schema.path("digestStatus") ||
    !existingStudentDailyProgressModel.schema.path("primaryWeakTag"))
) {
  delete modelRegistry.StudentDailyProgress;
}

const StudentDailyProgress: Model<IStudentDailyProgress> =
  (modelRegistry.StudentDailyProgress as Model<IStudentDailyProgress>) ||
  mongoose.model<IStudentDailyProgress>(
    "StudentDailyProgress",
    StudentDailyProgressSchema,
  );

export default StudentDailyProgress;
