import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./LiveSession.ts";
import "./User.ts";

export interface ILiveSessionTranscript extends Document {
  liveSession: Types.ObjectId;
  rawText?: string | null;
  summaryHtml?: string | null;
  isPublished: boolean;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LiveSessionTranscriptSchema = new Schema<ILiveSessionTranscript>(
  {
    liveSession: {
      type: Schema.Types.ObjectId,
      ref: "LiveSession",
      required: true,
      unique: true,
      index: true,
    },
    rawText: {
      type: String,
      default: null,
    },
    summaryHtml: {
      type: String,
      default: null,
      trim: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
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

const modelRegistry = getModelRegistry();

const existingLiveSessionTranscriptModel = modelRegistry.LiveSessionTranscript as
  | Model<ILiveSessionTranscript>
  | undefined;

if (
  existingLiveSessionTranscriptModel &&
  (!existingLiveSessionTranscriptModel.schema.path("rawText") ||
    !existingLiveSessionTranscriptModel.schema.path("summaryHtml") ||
    !existingLiveSessionTranscriptModel.schema.path("isPublished"))
) {
  delete modelRegistry.LiveSessionTranscript;
}

const LiveSessionTranscript: Model<ILiveSessionTranscript> =
  (modelRegistry.LiveSessionTranscript as Model<ILiveSessionTranscript>) ||
  mongoose.model<ILiveSessionTranscript>(
    "LiveSessionTranscript",
    LiveSessionTranscriptSchema,
  );

export default LiveSessionTranscript;
