// In a file like /models/QuestionPaper.ts

import mongoose, { Schema, Document, Types } from "mongoose";
import { applyArchiveFields, hasArchiveFields } from "@/lib/archive";

// --- FORCE MODEL REGISTRATION ---
// Import the actual models (default export) to ensure they are registered
// with Mongoose before this model is defined. This is the key.
import "./Question.ts"; // Ensure Question model is imported
import "./Subject.ts"; // Ensure Subject model is imported
import "./Tag.ts"; // Ensure Tag model is imported
import "./TagType.ts"; // Ensure TagType model is imported
import "./Class.ts";
import "./AcademicSection.ts";
import Question from "./Question.ts";
import Subject from "./Subject.ts";
import Class from "./Class.ts";
import User from "./User.ts"; // Corrected this line
import Tag from "./Tag.ts"; // Also ensure Tag is imported if referenced by Question

// You can still import interfaces if you need them for type-checking, like this:
// import { IUser } from './User';

// Interface for a single question within the paper's section
interface IQuestionInPaper {
  question: Types.ObjectId; // Reference to the Question document
  marks: number;
  negativeMarks: number;
}

// Interface for a single section
interface ISection {
  name: string;
  description?: string;
  marks: number;
  questions: IQuestionInPaper[];
}

// Interface for the main QuestionPaper document
export interface IQuestionPaper extends Document {
  title: string;
  instructions?: string;
  class: Types.ObjectId;
  subject: Types.ObjectId;
  duration: number;
  passingMarks: number;
  examDate: Date;
  totalMarks: number;
  sections: ISection[];
  assignedAcademicSections?: Types.ObjectId[];
  createdBy: Types.ObjectId; // Reference to the User who created it
}

// --- Schemas ---

// Schema for a question entry inside a section
const QuestionInPaperSchema = new Schema<IQuestionInPaper>(
  {
    question: {
      type: Schema.Types.ObjectId,
      ref: "Question", // This creates the reference to your Question model
      required: true,
    },
    marks: {
      type: Number,
      required: true,
      min: 0,
    },
    negativeMarks: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
); // No need for separate _id for this sub-document

// Schema for a section
const SectionSchema = new Schema<ISection>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    marks: {
      type: Number,
      required: true,
      min: 0,
    },
    questions: [QuestionInPaperSchema], // Embed the array of questions
  },
  { _id: false },
); // No need for separate _id for this sub-document

// Main Question Paper Schema
const QuestionPaperSchema = new Schema<IQuestionPaper>(
  {
    title: {
      type: String,
      required: [true, "Question paper title is required."],
      trim: true,
    },
    instructions: {
      type: String,
      default: "",
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
      default: 60,
    },
    passingMarks: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    examDate: {
      type: Date,
      required: true,
    },
    totalMarks: {
      type: Number,
      required: true,
    },
    sections: [SectionSchema], // Embed the array of sections
    assignedAcademicSections: [
      { type: Schema.Types.ObjectId, ref: "AcademicSection" },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Assuming you have a 'User' model
      required: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  },
);

applyArchiveFields(QuestionPaperSchema);

const existingQuestionPaperModel = mongoose.models.QuestionPaper as
  | mongoose.Model<IQuestionPaper>
  | undefined;

if (
  existingQuestionPaperModel &&
  (!existingQuestionPaperModel.schema.path("duration") ||
    !existingQuestionPaperModel.schema.path("passingMarks") ||
    !existingQuestionPaperModel.schema.path("examDate") ||
    !existingQuestionPaperModel.schema.path("assignedAcademicSections") ||
    !hasArchiveFields(existingQuestionPaperModel))
) {
  delete mongoose.models.QuestionPaper;
}

export default (mongoose.models
  .QuestionPaper as mongoose.Model<IQuestionPaper>) ||
  mongoose.model<IQuestionPaper>("QuestionPaper", QuestionPaperSchema);
