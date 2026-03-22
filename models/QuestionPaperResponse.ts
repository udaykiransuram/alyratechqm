import mongoose, { Schema, Document, Types } from 'mongoose';
import { getModelRegistry } from "@/lib/mongoose-models";


import './Question.ts'; // Ensure Question model is imported
import './Subject.ts'; // Ensure Subject model is imported
import './Tag.ts';     // Ensure Tag model is imported
import './TagType.ts'; // Ensure TagType model is imported
import './Class.ts'; 
// Interface for a single answer to a question
interface IQuestionAnswer {
  question: Types.ObjectId; // Reference to Question
  selectedOptions?: number[]; // For MCQ: indexes of selected options
  matrixSelections?: number[][]; // For matrix match: selected column indexes per row
  answerText?: string;       // For subjective/text answers
  marksAwarded?: number;     // Marks given for this question
}

// Interface for a section's answers
interface ISectionAnswer {
  sectionName: string;
  answers: IQuestionAnswer[];
}

// Main response interface
export interface IQuestionPaperResponse extends Document {
  paper: Types.ObjectId;      // Reference to QuestionPaper
  student: Types.ObjectId;    // Reference to User (role: student)
  startedAt: Date;
  submittedAt?: Date;
  status: 'in_progress' | 'submitted' | 'auto_submitted';
  lastSavedAt?: Date;
  totalMarksAwarded?: number;
  sectionAnswers: ISectionAnswer[];
}

// Schemas
const QuestionAnswerSchema = new Schema<IQuestionAnswer>({
  question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
  selectedOptions: [{ type: Number }], // For MCQ
  matrixSelections: [[{ type: Number }]], // For matrix match
  answerText: { type: String },        // For subjective
  marksAwarded: { type: Number },
}, { _id: false });

const SectionAnswerSchema = new Schema<ISectionAnswer>({
  sectionName: { type: String, required: true },
  answers: [QuestionAnswerSchema],
}, { _id: false });

const QuestionPaperResponseSchema = new Schema<IQuestionPaperResponse>({
  paper: { type: Schema.Types.ObjectId, ref: 'QuestionPaper', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date },
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'auto_submitted'],
    default: 'in_progress',
  },
  lastSavedAt: { type: Date, default: Date.now },
  totalMarksAwarded: { type: Number, default: 0 },
  sectionAnswers: [SectionAnswerSchema],
}, { timestamps: true });

QuestionPaperResponseSchema.index({ paper: 1, student: 1 }, { unique: true, name: 'paper_student_unique_1' });
QuestionPaperResponseSchema.index({ student: 1, paper: 1 }, { name: 'student_paper_lookup_1' });

const modelRegistry = getModelRegistry();

const existingQuestionPaperResponseModel =
  modelRegistry.QuestionPaperResponse as mongoose.Model<IQuestionPaperResponse> | undefined;
const existingStatusPath = existingQuestionPaperResponseModel?.schema.path('status') as
  | (mongoose.SchemaType & { defaultValue?: unknown })
  | undefined;
const existingMarksAwardedPath = existingQuestionPaperResponseModel?.schema.path(
  'sectionAnswers.answers.marksAwarded',
) as (mongoose.SchemaType & { defaultValue?: unknown }) | undefined;
const hasLegacyStatusDefault =
  typeof existingStatusPath?.defaultValue === 'function';
const hasLegacyMarksAwardedDefault =
  existingMarksAwardedPath?.defaultValue === 0;

if (
  existingQuestionPaperResponseModel &&
  (!existingQuestionPaperResponseModel.schema.path('status') ||
    !existingQuestionPaperResponseModel.schema.path('lastSavedAt') ||
    !existingQuestionPaperResponseModel.schema.path('sectionAnswers.answers.matrixSelections') ||
    hasLegacyStatusDefault ||
    hasLegacyMarksAwardedDefault)
) {
  delete modelRegistry.QuestionPaperResponse;
}

export default modelRegistry.QuestionPaperResponse ||
  mongoose.model<IQuestionPaperResponse>('QuestionPaperResponse', QuestionPaperResponseSchema);
