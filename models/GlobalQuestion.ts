import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

export interface IGlobalQuestionTag {
  name: string;
  typeName: string;
}

export interface IGlobalQuestion extends Document {
  sourceSchoolKey: string;
  sourceQuestionId: string;
  subjectName: string;
  className: string;
  tags: IGlobalQuestionTag[];
  content: string;
  options?: Array<{ content: string }>;
  answerIndexes?: number[];
  matrixOptions?: Array<{ left: string; right: string }>;
  matrixAnswers?: number[][];
  explanation?: string;
  marks: number;
  type: "single" | "multiple" | "matrix-match" | "descriptive";
  createdBy?: Types.ObjectId;
}

const GlobalQuestionTagSchema = new Schema<IGlobalQuestionTag>(
  {
    name: { type: String, required: true, trim: true },
    typeName: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false },
);

const GlobalQuestionSchema = new Schema<IGlobalQuestion>(
  {
    sourceSchoolKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    sourceQuestionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    className: {
      type: String,
      required: true,
      trim: true,
    },
    tags: {
      type: [GlobalQuestionTagSchema],
      default: [],
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [{ content: { type: String, required: true, trim: true } }],
      default: undefined,
    },
    answerIndexes: {
      type: [Number],
      default: undefined,
    },
    matrixOptions: {
      type: [{ left: String, right: String }],
      default: undefined,
    },
    matrixAnswers: {
      type: [[Number]],
      default: undefined,
    },
    explanation: {
      type: String,
      trim: true,
      default: undefined,
    },
    marks: {
      type: Number,
      required: true,
      min: 1,
    },
    type: {
      type: String,
      enum: ["single", "multiple", "matrix-match", "descriptive"],
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

GlobalQuestionSchema.index(
  { sourceSchoolKey: 1, sourceQuestionId: 1 },
  { unique: true, name: "global_question_source_unique" },
);
GlobalQuestionSchema.index({ className: 1, subjectName: 1, createdAt: -1 });
GlobalQuestionSchema.index({ "tags.name": 1, "tags.typeName": 1 });

const modelRegistry = getModelRegistry();

const GlobalQuestion: Model<IGlobalQuestion> =
  (modelRegistry.GlobalQuestion as Model<IGlobalQuestion>) ||
  mongoose.model<IGlobalQuestion>("GlobalQuestion", GlobalQuestionSchema);

export default GlobalQuestion;
