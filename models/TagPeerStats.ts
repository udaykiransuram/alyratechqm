import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./Class.ts";
import "./AcademicSection.ts";
import "./Subject.ts";
import "./Tag.ts";

export interface ITagPeerStats extends Document {
  class: Types.ObjectId;
  academicSection?: Types.ObjectId | null;
  subject?: Types.ObjectId | null;
  tag: Types.ObjectId;
  studentCount: number;
  medianAccuracy: number;
  p25Accuracy: number;
  p75Accuracy: number;
  minAccuracy: number;
  maxAccuracy: number;
  updatedAt: Date;
  createdAt: Date;
}

const TagPeerStatsSchema = new Schema<ITagPeerStats>(
  {
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
    tag: {
      type: Schema.Types.ObjectId,
      ref: "Tag",
      required: true,
      index: true,
    },
    studentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    medianAccuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    p25Accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    p75Accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    minAccuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    maxAccuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true },
);

TagPeerStatsSchema.index(
  { class: 1, academicSection: 1, tag: 1 },
  { unique: true, name: "tag_peer_stats_unique_1" },
);

const modelRegistry = getModelRegistry();

const existingTagPeerStatsModel =
  modelRegistry.TagPeerStats as Model<ITagPeerStats> | undefined;

if (
  existingTagPeerStatsModel &&
  (!existingTagPeerStatsModel.schema.path("studentCount") ||
    !existingTagPeerStatsModel.schema.path("p25Accuracy"))
) {
  delete modelRegistry.TagPeerStats;
}

const TagPeerStats: Model<ITagPeerStats> =
  (modelRegistry.TagPeerStats as Model<ITagPeerStats>) ||
  mongoose.model<ITagPeerStats>("TagPeerStats", TagPeerStatsSchema);

export default TagPeerStats;
