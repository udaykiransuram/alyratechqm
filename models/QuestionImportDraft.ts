import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { applyArchiveFields, hasArchiveFields } from "@/lib/archive";
import { getModelRegistry } from "@/lib/mongoose-models";
import type {
  QuestionImportDraftPayload,
  QuestionImportDraftStatus,
  QuestionImportSourceFile,
} from "@/lib/question-import/types";

import "./User.ts";

export interface IQuestionImportDraft extends Document {
  status: QuestionImportDraftStatus;
  sourceFile: QuestionImportSourceFile;
  payload: QuestionImportDraftPayload;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  publishedQuestionIds?: Types.ObjectId[];
  publishedPaperId?: Types.ObjectId | null;
  isArchived?: boolean;
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
}

const QuestionImportDraftSchema = new Schema<IQuestionImportDraft>(
  {
    status: {
      type: String,
      required: true,
      enum: [
        "uploaded",
        "parsed",
        "needs_review",
        "ready_to_publish",
        "published",
        "failed",
      ],
      default: "uploaded",
      index: true,
    },
    sourceFile: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    publishedQuestionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    publishedPaperId: {
      type: Schema.Types.ObjectId,
      ref: "QuestionPaper",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

QuestionImportDraftSchema.index(
  { status: 1, createdAt: -1 },
  { name: "question_import_draft_status_created_at" },
);

applyArchiveFields(QuestionImportDraftSchema);

const modelRegistry = getModelRegistry();

const existingQuestionImportDraftModel = modelRegistry.QuestionImportDraft as
  | Model<IQuestionImportDraft>
  | undefined;

if (
  existingQuestionImportDraftModel &&
  (!existingQuestionImportDraftModel.schema.path("payload") ||
    !existingQuestionImportDraftModel.schema.path("sourceFile") ||
    !hasArchiveFields(existingQuestionImportDraftModel))
) {
  delete modelRegistry.QuestionImportDraft;
}

const QuestionImportDraft: Model<IQuestionImportDraft> =
  (modelRegistry.QuestionImportDraft as Model<IQuestionImportDraft>) ||
  mongoose.model<IQuestionImportDraft>(
    "QuestionImportDraft",
    QuestionImportDraftSchema,
  );

export default QuestionImportDraft;
