import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./User.ts";
import "./Tag.ts";
import "./QuestionPaper.ts";

export interface ITagPracticeSet extends Document {
  student: Types.ObjectId;
  tag: Types.ObjectId;
  questionPaper: Types.ObjectId;
  status: "assigned" | "started" | "completed";
  assignedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  accuracyPct?: number | null;
  attemptCount?: number | null;
  linkToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TagPracticeSetSchema = new Schema<ITagPracticeSet>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tag: {
      type: Schema.Types.ObjectId,
      ref: "Tag",
      required: true,
      index: true,
    },
    questionPaper: {
      type: Schema.Types.ObjectId,
      ref: "QuestionPaper",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["assigned", "started", "completed"],
      default: "assigned",
      index: true,
    },
    assignedAt: {
      type: Date,
      default: () => new Date(),
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    accuracyPct: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    attemptCount: {
      type: Number,
      default: null,
      min: 0,
    },
    linkToken: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

TagPracticeSetSchema.index(
  { student: 1, tag: 1, status: 1 },
  { name: "tag_practice_set_student_tag_status_1" },
);

const modelRegistry = getModelRegistry();

const existingTagPracticeSetModel =
  modelRegistry.TagPracticeSet as Model<ITagPracticeSet> | undefined;

if (
  existingTagPracticeSetModel &&
  (!existingTagPracticeSetModel.schema.path("questionPaper") ||
    !existingTagPracticeSetModel.schema.path("status"))
) {
  delete modelRegistry.TagPracticeSet;
}

const TagPracticeSet: Model<ITagPracticeSet> =
  (modelRegistry.TagPracticeSet as Model<ITagPracticeSet>) ||
  mongoose.model<ITagPracticeSet>("TagPracticeSet", TagPracticeSetSchema);

export default TagPracticeSet;
