import mongoose, { Schema, Document, Types } from 'mongoose';


import './Question'; // Ensure Question model is imported
import './Subject'; // Ensure Subject model is imported
import './Tag';     // Ensure Tag model is imported
import './TagType'; // Ensure TagType model is imported
import './Class'; 
// Interface for a single answer to a question
interface IQuestionAnswer {
  question: Types.ObjectId; // Reference to Question
  selectedOptions: number[]; // For MCQ: indexes of selected options
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
  totalMarksAwarded?: number;
  sectionAnswers: ISectionAnswer[];
}

// Schemas
const QuestionAnswerSchema = new Schema<IQuestionAnswer>({
  question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
  selectedOptions: [{ type: Number }], // For MCQ
  answerText: { type: String },        // For subjective
  marksAwarded: { type: Number, default: 0 },
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
  totalMarksAwarded: { type: Number, default: 0 },
  sectionAnswers: [SectionAnswerSchema],
}, { timestamps: true });

export default mongoose.models.QuestionPaperResponse ||
  mongoose.model<IQuestionPaperResponse>('QuestionPaperResponse', QuestionPaperResponseSchema);