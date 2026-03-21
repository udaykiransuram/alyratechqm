import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { getModelRegistry } from "@/lib/mongoose-models";

export type ReportDispatchAttemptState =
  | "pending_ack"
  | "accepted"
  | "expired";

export type ReportDispatchDeliveryStatus =
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface IReportDispatchAttempt {
  key: string;
  attemptNumber: number;
  state: ReportDispatchAttemptState;
  createdAt: Date;
  acknowledgedAt?: Date;
  lastWebhookAt?: Date;
  providerMessageId?: string;
  deliveryStatus?: ReportDispatchDeliveryStatus;
  note?: string;
}

export interface IReportDispatchJob extends Document {
  schoolKey: string;
  type: "student" | "exam" | "teacher" | "admin";
  student?: Types.ObjectId;
  studentName?: string;
  responseId?: Types.ObjectId;
  paperId?: Types.ObjectId;
  paperTitle?: string;
  classId?: Types.ObjectId;
  className?: string;
  academicSection?: Types.ObjectId;
  academicSectionName?: string;
  status: "queued" | "processing" | "sent" | "failed";
  mobileNumber?: string;
  error?: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  lastAttemptAt?: Date;
  processingStartedAt?: Date;
  activeAttemptKey?: string;
  activeAttemptCreatedAt?: Date;
  providerAcceptedAt?: Date;
  deliveryAttempts?: IReportDispatchAttempt[];
  reportUrl?: string;
  providerMessageId?: string;
  deliveryStatus?: ReportDispatchDeliveryStatus;
  deliveryError?: string;
  deliveredAt?: Date;
  readAt?: Date;
  lastWebhookAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReportDispatchAttemptSchema = new Schema<IReportDispatchAttempt>(
  {
    key: { type: String, required: true, trim: true },
    attemptNumber: { type: Number, required: true },
    state: {
      type: String,
      enum: ["pending_ack", "accepted", "expired"],
      required: true,
      default: "pending_ack",
    },
    createdAt: { type: Date, required: true },
    acknowledgedAt: { type: Date },
    lastWebhookAt: { type: Date },
    providerMessageId: { type: String, trim: true },
    deliveryStatus: {
      type: String,
      enum: ["accepted", "sent", "delivered", "read", "failed"],
    },
    note: { type: String },
  },
  { _id: false },
);

const ReportDispatchJobSchema = new Schema<IReportDispatchJob>(
  {
    schoolKey: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      enum: ["student", "exam", "teacher", "admin"],
      required: true,
    },
    student: { type: Schema.Types.ObjectId, ref: "User" },
    studentName: { type: String, trim: true },
    responseId: { type: Schema.Types.ObjectId, ref: "QuestionPaperResponse" },
    paperId: { type: Schema.Types.ObjectId, ref: "QuestionPaper" },
    paperTitle: { type: String, trim: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", index: true },
    className: { type: String, trim: true },
    academicSection: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSection",
      index: true,
    },
    academicSectionName: { type: String, trim: true },
    status: {
      type: String,
      enum: ["queued", "processing", "sent", "failed"],
      default: "queued",
      index: true,
    },
    mobileNumber: { type: String, trim: true },
    error: { type: String },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    nextRetryAt: { type: Date, index: true },
    lastAttemptAt: { type: Date },
    processingStartedAt: { type: Date },
    activeAttemptKey: { type: String, trim: true, index: true },
    activeAttemptCreatedAt: { type: Date },
    providerAcceptedAt: { type: Date },
    deliveryAttempts: {
      type: [ReportDispatchAttemptSchema],
      default: [],
    },
    reportUrl: { type: String },
    providerMessageId: { type: String },
    deliveryStatus: {
      type: String,
      enum: ["accepted", "sent", "delivered", "read", "failed"],
      index: true,
    },
    deliveryError: { type: String },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    lastWebhookAt: { type: Date },
  },
  { timestamps: true },
);

ReportDispatchJobSchema.index({
  schoolKey: 1,
  academicSection: 1,
  status: 1,
  updatedAt: -1,
});
ReportDispatchJobSchema.index({
  schoolKey: 1,
  status: 1,
  nextRetryAt: 1,
  createdAt: 1,
});
ReportDispatchJobSchema.index({
  schoolKey: 1,
  status: 1,
  processingStartedAt: 1,
  lastAttemptAt: 1,
});
ReportDispatchJobSchema.index(
  { providerMessageId: 1 },
  {
    sparse: true,
  },
);
ReportDispatchJobSchema.index({
  "deliveryAttempts.key": 1,
});

const modelRegistry = getModelRegistry();

const existingReportDispatchJobModel =
  modelRegistry.ReportDispatchJob as Model<IReportDispatchJob> | undefined;

const existingTypeValues = existingReportDispatchJobModel
  ? ((existingReportDispatchJobModel.schema.path("type") as any)?.enumValues || [])
  : [];

if (
  existingReportDispatchJobModel &&
  (!existingReportDispatchJobModel.schema.path("studentName") ||
    !existingReportDispatchJobModel.schema.path("processingStartedAt") ||
    !existingReportDispatchJobModel.schema.path("activeAttemptKey") ||
    !existingReportDispatchJobModel.schema.path("deliveryAttempts") ||
    !existingTypeValues.includes("teacher") ||
    !existingTypeValues.includes("admin"))
) {
  delete modelRegistry.ReportDispatchJob;
}

const ReportDispatchJob: Model<IReportDispatchJob> =
  (modelRegistry.ReportDispatchJob as Model<IReportDispatchJob>) ||
  mongoose.model<IReportDispatchJob>(
    "ReportDispatchJob",
    ReportDispatchJobSchema,
  );

export default ReportDispatchJob;
