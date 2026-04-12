import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";
import { hasMeaningfulRichTextContent } from "@/lib/security/html-sanitize";

import "./LiveSession.ts";
import "./LiveSessionItem.ts";
import "./User.ts";

export type LiveSessionResponseItemType = "single" | "multiple" | "short-text";

export interface ILiveSessionResponse extends Document {
  liveSession: Types.ObjectId;
  item: Types.ObjectId;
  student: Types.ObjectId;
  itemType: LiveSessionResponseItemType;
  selectedOptionIndexes: number[];
  answerHtml?: string | null;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LiveSessionResponseSchema = new Schema<ILiveSessionResponse>(
  {
    liveSession: {
      type: Schema.Types.ObjectId,
      ref: "LiveSession",
      required: true,
      index: true,
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: "LiveSessionItem",
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      required: true,
      enum: ["single", "multiple", "short-text"],
      index: true,
    },
    selectedOptionIndexes: {
      type: [Number],
      default: [],
    },
    answerHtml: {
      type: String,
      default: null,
      trim: true,
    },
    submittedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
  },
);

LiveSessionResponseSchema.pre("validate", function (next) {
  const response = this as ILiveSessionResponse & {
    invalidate: (path: string, message: string) => void;
  };

  const selectedOptionIndexes = Array.isArray(response.selectedOptionIndexes)
    ? response.selectedOptionIndexes
    : [];

  if (response.itemType === "single" && selectedOptionIndexes.length !== 1) {
    response.invalidate(
      "selectedOptionIndexes",
      "Single-choice live responses need exactly one selected option.",
    );
  }

  if (response.itemType === "multiple" && selectedOptionIndexes.length === 0) {
    response.invalidate(
      "selectedOptionIndexes",
      "Multiple-choice live responses need at least one selected option.",
    );
  }

  if (response.itemType === "short-text") {
    if (selectedOptionIndexes.length > 0) {
      response.invalidate(
        "selectedOptionIndexes",
        "Short-text live responses cannot store selected options.",
      );
    }

    if (!hasMeaningfulRichTextContent(response.answerHtml || "")) {
      response.invalidate(
        "answerHtml",
        "Short-text live responses cannot be empty.",
      );
    }
  } else if (response.answerHtml) {
    response.invalidate(
      "answerHtml",
      "Objective live responses cannot store answer HTML.",
    );
  }

  next();
});

LiveSessionResponseSchema.index(
  { item: 1, student: 1 },
  { unique: true, name: "live_session_item_student_unique_1" },
);
LiveSessionResponseSchema.index(
  { liveSession: 1, item: 1, updatedAt: -1 },
  { name: "live_session_response_item_updated_1" },
);
LiveSessionResponseSchema.index(
  { student: 1, updatedAt: -1 },
  { name: "live_session_response_student_updated_1" },
);

const modelRegistry = getModelRegistry();

const existingLiveSessionResponseModel = modelRegistry.LiveSessionResponse as
  | Model<ILiveSessionResponse>
  | undefined;

if (
  existingLiveSessionResponseModel &&
  (!existingLiveSessionResponseModel.schema.path("liveSession") ||
    !existingLiveSessionResponseModel.schema.path("itemType") ||
    !existingLiveSessionResponseModel.schema.path("submittedAt"))
) {
  delete modelRegistry.LiveSessionResponse;
}

const LiveSessionResponse: Model<ILiveSessionResponse> =
  (modelRegistry.LiveSessionResponse as Model<ILiveSessionResponse>) ||
  mongoose.model<ILiveSessionResponse>(
    "LiveSessionResponse",
    LiveSessionResponseSchema,
  );

export default LiveSessionResponse;
