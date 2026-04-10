import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

export interface IStudentNotificationJob extends Document {
  schoolKey: string;
  type:
    | "course_assigned"
    | "course_due_soon"
    | "test_assigned"
    | "diary_update"
    | "live_session_scheduled"
    | "live_session_reminder"
    | "live_session_cancelled";
  title: string;
  message: string;
  linkUrl?: string;
  entityId: string;
  dedupeKey?: string;
  entityType: "course" | "test" | "diary" | "live_session";
  targetClassId?: Types.ObjectId;
  targetAcademicSectionIds?: Types.ObjectId[];
  targetStudentIds?: Types.ObjectId[];
  status: "queued" | "processing" | "completed" | "failed" | "superseded";
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  lastAttemptAt?: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
  supersededAt?: Date;
  resolvedStudentCount: number;
  upsertedCount: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentNotificationJobSchema = new Schema<IStudentNotificationJob>(
  {
    schoolKey: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        "course_assigned",
        "course_due_soon",
        "test_assigned",
        "diary_update",
        "live_session_scheduled",
        "live_session_reminder",
        "live_session_cancelled",
      ],
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    linkUrl: { type: String, default: "", trim: true },
    entityId: { type: String, required: true, trim: true, index: true },
    dedupeKey: { type: String, default: "", trim: true, index: true },
    entityType: {
      type: String,
      required: true,
      enum: ["course", "test", "diary", "live_session"],
      index: true,
    },
    targetClassId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      index: true,
    },
    targetAcademicSectionIds: {
      type: [Schema.Types.ObjectId],
      ref: "AcademicSection",
      default: [],
    },
    targetStudentIds: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: ["queued", "processing", "completed", "failed", "superseded"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 4 },
    nextRetryAt: { type: Date, index: true },
    lastAttemptAt: { type: Date },
    processingStartedAt: { type: Date },
    completedAt: { type: Date },
    supersededAt: { type: Date },
    resolvedStudentCount: { type: Number, default: 0 },
    upsertedCount: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true },
);

StudentNotificationJobSchema.index({
  schoolKey: 1,
  status: 1,
  nextRetryAt: 1,
  createdAt: 1,
});
StudentNotificationJobSchema.index({
  schoolKey: 1,
  status: 1,
  processingStartedAt: 1,
  lastAttemptAt: 1,
});
StudentNotificationJobSchema.index({
  schoolKey: 1,
  type: 1,
  entityId: 1,
  createdAt: -1,
});

const modelRegistry = getModelRegistry();

const existingStudentNotificationJobModel =
  modelRegistry.StudentNotificationJob as
    | Model<IStudentNotificationJob>
    | undefined;

if (
  existingStudentNotificationJobModel &&
  (!existingStudentNotificationJobModel.schema.path("targetStudentIds") ||
    !existingStudentNotificationJobModel.schema.path("completedAt") ||
    !existingStudentNotificationJobModel.schema.path("resolvedStudentCount") ||
    !existingStudentNotificationJobModel.schema.path("upsertedCount") ||
    !existingStudentNotificationJobModel.schema.path("dedupeKey") ||
    !existingStudentNotificationJobModel.schema.path("supersededAt"))
) {
  delete modelRegistry.StudentNotificationJob;
}

const StudentNotificationJob: Model<IStudentNotificationJob> =
  (modelRegistry.StudentNotificationJob as Model<IStudentNotificationJob>) ||
  mongoose.model<IStudentNotificationJob>(
    "StudentNotificationJob",
    StudentNotificationJobSchema,
  );

export default StudentNotificationJob;
