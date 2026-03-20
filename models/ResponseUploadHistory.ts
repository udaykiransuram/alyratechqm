import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { getModelRegistry } from "@/lib/mongoose-models";

import "./QuestionPaper.ts";
import "./AcademicSection.ts";
import "./User.ts";

interface IResponseUploadHistoryResult {
  row: number;
  candidateId?: string;
  candidateName?: string;
  status: "created" | "updated" | "skipped" | "failed";
  message?: string;
  responseId?: Types.ObjectId | null;
}

export interface IResponseUploadHistory extends Document {
  paper: Types.ObjectId;
  academicSection?: Types.ObjectId | null;
  fileName?: string;
  uploadMode: "skip_existing" | "overwrite_existing";
  status: "completed" | "partial" | "failed";
  totalRows: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  createdCount: number;
  updatedCount: number;
  validationIssueCount: number;
  duplicateRowCount: number;
  resultsTruncated?: boolean;
  results: IResponseUploadHistoryResult[];
  summary?: string;
  initiatedBy?: Types.ObjectId | null;
  initiatedByName?: string;
  initiatedByRole?: string;
  startedAt?: Date;
  completedAt?: Date;
}

const ResponseUploadHistoryResultSchema = new Schema<IResponseUploadHistoryResult>(
  {
    row: { type: Number, required: true },
    candidateId: { type: String, trim: true },
    candidateName: { type: String, trim: true },
    status: {
      type: String,
      enum: ["created", "updated", "skipped", "failed"],
      required: true,
    },
    message: { type: String, trim: true },
    responseId: { type: Schema.Types.ObjectId, ref: "QuestionPaperResponse", default: null },
  },
  { _id: false },
);

const ResponseUploadHistorySchema = new Schema<IResponseUploadHistory>(
  {
    paper: { type: Schema.Types.ObjectId, ref: "QuestionPaper", required: true, index: true },
    academicSection: { type: Schema.Types.ObjectId, ref: "AcademicSection", default: null, index: true },
    fileName: { type: String, trim: true },
    uploadMode: {
      type: String,
      enum: ["skip_existing", "overwrite_existing"],
      default: "skip_existing",
    },
    status: {
      type: String,
      enum: ["completed", "partial", "failed"],
      required: true,
      index: true,
    },
    totalRows: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    createdCount: { type: Number, default: 0 },
    updatedCount: { type: Number, default: 0 },
    validationIssueCount: { type: Number, default: 0 },
    duplicateRowCount: { type: Number, default: 0 },
    resultsTruncated: { type: Boolean, default: false },
    results: { type: [ResponseUploadHistoryResultSchema], default: [] },
    summary: { type: String, trim: true },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    initiatedByName: { type: String, trim: true },
    initiatedByRole: { type: String, trim: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

ResponseUploadHistorySchema.index({ paper: 1, createdAt: -1 });
ResponseUploadHistorySchema.index({ academicSection: 1, createdAt: -1 });

const modelRegistry = getModelRegistry();

const ResponseUploadHistory: Model<IResponseUploadHistory> =
  (modelRegistry.ResponseUploadHistory as Model<IResponseUploadHistory>) ||
  mongoose.model<IResponseUploadHistory>("ResponseUploadHistory", ResponseUploadHistorySchema);

export default ResponseUploadHistory;
