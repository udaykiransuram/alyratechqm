import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";
import { hasMeaningfulRichTextContent } from "@/lib/security/html-sanitize";

import "./LiveSession.ts";
import "./User.ts";

export type LiveSessionItemType = "single" | "multiple" | "short-text";
export type LiveSessionItemStatus = "draft" | "active" | "closed" | "archived";

export interface ILiveSessionItemOption {
  contentHtml: string;
}

export interface ILiveSessionItem extends Document {
  liveSession: Types.ObjectId;
  type: LiveSessionItemType;
  promptHtml: string;
  options: ILiveSessionItemOption[];
  answerIndexes: number[];
  explanationHtml?: string;
  status: LiveSessionItemStatus;
  order: number;
  openedAt?: Date | null;
  closedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LiveSessionItemOptionSchema = new Schema<ILiveSessionItemOption>(
  {
    contentHtml: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value: string) => hasMeaningfulRichTextContent(value),
        message:
          "Each live-item option must include visible text, math, or an image.",
      },
    },
  },
  { _id: false },
);

const LiveSessionItemSchema = new Schema<ILiveSessionItem>(
  {
    liveSession: {
      type: Schema.Types.ObjectId,
      ref: "LiveSession",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["single", "multiple", "short-text"],
      index: true,
    },
    promptHtml: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value: string) => hasMeaningfulRichTextContent(value),
        message: "Live-item prompts cannot be empty.",
      },
    },
    options: {
      type: [LiveSessionItemOptionSchema],
      default: [],
    },
    answerIndexes: {
      type: [Number],
      default: [],
    },
    explanationHtml: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["draft", "active", "closed", "archived"],
      default: "draft",
      index: true,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    openedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

LiveSessionItemSchema.pre("validate", function (next) {
  const item = this as ILiveSessionItem & {
    invalidate: (path: string, message: string) => void;
  };

  const optionCount = Array.isArray(item.options) ? item.options.length : 0;
  const answerIndexes = Array.isArray(item.answerIndexes) ? item.answerIndexes : [];

  if (item.type === "single" || item.type === "multiple") {
    if (optionCount < 2) {
      item.invalidate(
        "options",
        "Single and multiple live items need at least two answer options.",
      );
    }

    if (item.type === "single" && answerIndexes.length !== 1) {
      item.invalidate(
        "answerIndexes",
        "Single-choice live items need exactly one correct answer.",
      );
    }

    if (item.type === "multiple" && answerIndexes.length === 0) {
      item.invalidate(
        "answerIndexes",
        "Multiple-choice live items need at least one correct answer.",
      );
    }

    answerIndexes.forEach((answerIndex) => {
      if (
        !Number.isInteger(answerIndex) ||
        answerIndex < 0 ||
        answerIndex >= optionCount
      ) {
        item.invalidate(
          "answerIndexes",
          "Live-item answer indexes must point to existing options.",
        );
      }
    });
  }

  if (item.type === "short-text") {
    if (optionCount > 0) {
      item.invalidate(
        "options",
        "Short-text live items cannot include answer options.",
      );
    }

    if (answerIndexes.length > 0) {
      item.invalidate(
        "answerIndexes",
        "Short-text live items cannot include correct answer indexes.",
      );
    }
  }

  next();
});

LiveSessionItemSchema.index(
  { liveSession: 1, order: 1, _id: 1 },
  { name: "live_session_item_order_1" },
);
LiveSessionItemSchema.index(
  { liveSession: 1, status: 1, order: 1 },
  { name: "live_session_item_status_order_1" },
);

const modelRegistry = getModelRegistry();

const existingLiveSessionItemModel = modelRegistry.LiveSessionItem as
  | Model<ILiveSessionItem>
  | undefined;

if (
  existingLiveSessionItemModel &&
  (!existingLiveSessionItemModel.schema.path("promptHtml") ||
    !existingLiveSessionItemModel.schema.path("answerIndexes") ||
    !existingLiveSessionItemModel.schema.path("status") ||
    !existingLiveSessionItemModel.schema.path("order"))
) {
  delete modelRegistry.LiveSessionItem;
}

const LiveSessionItem: Model<ILiveSessionItem> =
  (modelRegistry.LiveSessionItem as Model<ILiveSessionItem>) ||
  mongoose.model<ILiveSessionItem>("LiveSessionItem", LiveSessionItemSchema);

export default LiveSessionItem;
