import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IReportDispatchJob extends Document {
  schoolKey: string;
  type: "student" | "exam";
  student?: Types.ObjectId;
  responseId?: Types.ObjectId;
  paperId?: Types.ObjectId;
  status: "queued" | "processing" | "sent" | "failed";
  mobileNumber?: string;
  error?: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  lastAttemptAt?: Date;
  reportUrl?: string;
  providerMessageId?: string;
  deliveryStatus?: "accepted" | "sent" | "delivered" | "read" | "failed";
  deliveryError?: string;
  deliveredAt?: Date;
  readAt?: Date;
  lastWebhookAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReportDispatchJobSchema = new Schema<IReportDispatchJob>(
  {
    schoolKey: { type: String, required: true, trim: true, index: true },
    type: { type: String, enum: ["student", "exam"], required: true },
    student: { type: Schema.Types.ObjectId, ref: "User" },
    responseId: { type: Schema.Types.ObjectId, ref: "QuestionPaperResponse" },
    paperId: { type: Schema.Types.ObjectId, ref: "QuestionPaper" },
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

const ReportDispatchJob: Model<IReportDispatchJob> =
  mongoose.models.ReportDispatchJob ||
  mongoose.model<IReportDispatchJob>(
    "ReportDispatchJob",
    ReportDispatchJobSchema,
  );

export default ReportDispatchJob;
