import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./Course.ts";
import "./QuestionPaper.ts";
import "./User.ts";

export interface ICourseProgress extends Document {
  course: Types.ObjectId;
  student: Types.ObjectId;
  status: "not_started" | "in_progress" | "completed";
  startedAt?: Date | null;
  lastViewedBlockId?: string | null;
  viewedBlockIds: string[];
  completedBlockIds: string[];
  bookmarkedBlockIds: string[];
  notes: Array<{
    blockId: string;
    text: string;
    updatedAt: Date;
  }>;
  completionPercent: number;
  lastActivityAt?: Date | null;
  completedAssessmentPaperIds: Types.ObjectId[];
  completedAt?: Date | null;
}

const CourseProgressSchema = new Schema<ICourseProgress>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    lastViewedBlockId: {
      type: String,
      default: null,
      trim: true,
    },
    viewedBlockIds: [
      {
        type: String,
        trim: true,
      },
    ],
    completedBlockIds: [
      {
        type: String,
        trim: true,
      },
    ],
    bookmarkedBlockIds: [
      {
        type: String,
        trim: true,
      },
    ],
    notes: [
      {
        blockId: {
          type: String,
          required: true,
          trim: true,
        },
        text: {
          type: String,
          required: true,
          trim: true,
        },
        updatedAt: {
          type: Date,
          required: true,
        },
      },
    ],
    completionPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    lastActivityAt: {
      type: Date,
      default: null,
    },
    completedAssessmentPaperIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "QuestionPaper",
      },
    ],
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

CourseProgressSchema.index(
  { course: 1, student: 1 },
  {
    name: "course_progress_unique_course_student_1",
    unique: true,
  },
);
CourseProgressSchema.index(
  { student: 1, status: 1 },
  { name: "course_progress_student_status_1" },
);

const modelRegistry = getModelRegistry();

const existingCourseProgressModel = modelRegistry.CourseProgress as
  | Model<ICourseProgress>
  | undefined;

if (
  existingCourseProgressModel &&
  (!existingCourseProgressModel.schema.path("lastViewedBlockId") ||
    !existingCourseProgressModel.schema.path("completedAssessmentPaperIds") ||
    !existingCourseProgressModel.schema.path("viewedBlockIds") ||
    !existingCourseProgressModel.schema.path("completedBlockIds") ||
    !existingCourseProgressModel.schema.path("bookmarkedBlockIds") ||
    !existingCourseProgressModel.schema.path("notes") ||
    !existingCourseProgressModel.schema.path("completionPercent"))
) {
  delete modelRegistry.CourseProgress;
}

const CourseProgress: Model<ICourseProgress> =
  (modelRegistry.CourseProgress as Model<ICourseProgress>) ||
  mongoose.model<ICourseProgress>("CourseProgress", CourseProgressSchema);

export default CourseProgress;
