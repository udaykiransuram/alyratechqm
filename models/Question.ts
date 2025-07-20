import mongoose, { Schema, Document, Model } from 'mongoose';

import './Class'; 
import { ISubject } from './Subject';
import { ITag } from './Tag';
import { IClass } from './Class';
import { IUser } from './User'; // --- 1. IMPORT USER ---

// Interface for a single answer option
export interface IOption {
  content: string;
}

// Interface for a single matrix match pair
export interface IMatrixMatchOption {
  left: string;
  right: string;
}

// Interface for the Question document
export interface IQuestion extends Document {
  subject: ISubject['_id'];
  class: IClass['_id'];
  tags: ITag['_id'][];
  content: string;
  options?: IOption[];
  answerIndexes?: number[];
  matrixOptions?: IMatrixMatchOption[];
  matrixAnswers?: number[][];
  explanation?: string;
  marks: number;
  createdBy?: IUser['_id'];
  type: 'single' | 'multiple' | 'matrix-match' | 'descriptive';
}

// Schema for a single answer option
const OptionSchema: Schema<IOption> = new Schema({
  content: {
    type: String,
    required: [true, 'Option content cannot be empty.'],
    trim: true,
  },
}, { _id: false }); // No separate _id for subdocuments

// Schema for a single matrix match pair
const MatrixMatchOptionSchema: Schema<IMatrixMatchOption> = new Schema({
  left: { type: String, default: '' },   // remove 'required: true'
  right: { type: String, default: '' },  // remove 'required: true'
}, { _id: false });


// Main schema for the Question model
const QuestionSchema: Schema<IQuestion> = new Schema(
  {
    // Reference to the Subject model
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'A subject is required for the question.'],
      index: true,
    },
    // --- ADD THIS NEW FIELD ---
    class: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'A class is required for the question.'],
      index: true,
    },
    // Array of references to the Tag model
    tags: [{
      type: Schema.Types.ObjectId,
      ref: 'Tag',
      index: true,
    }],
    // The main body of the question (can contain HTML from the rich editor)
    content: {
      type: String,
      required: [true, 'Question content is required.'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['single', 'multiple', 'matrix-match', 'descriptive'],
      required: true,
    },
    // --- Conditional validation for options ---
    options: {
      type: [OptionSchema],
      required: function(this: any) {
        return this.type === 'single' || this.type === 'multiple';
      },
      validate: [
        {
          validator: function(val: any[]) {
            if (this.type === 'single' || this.type === 'multiple') {
              return Array.isArray(val) && val.length >= 2;
            }
            return true;
          },
          message: 'At least two answer options are required for single/multiple choice questions.'
        }
      ],
    },
    answerIndexes: {
      type: [Number],
      required: function(this: any) {
        return this.type === 'single' || this.type === 'multiple';
      },
      validate: {
        validator: function(arr: number[]) {
          if (this.type === 'single' || this.type === 'multiple') {
            if (!Array.isArray(this.options)) return false;
            return arr.every(idx => idx >= 0 && this.options && idx < this.options.length);
          }
          return true;
        },
        message: 'One or more answer indexes are out of bounds.'
      }
    },
    // --- Matrix match fields ---
    matrixOptions: {
      type: [MatrixMatchOptionSchema],
      required: function(this: any) {
        return this.type === 'matrix-match';
      },
      validate: [
        {
          validator: function(val: any[]) {
            if (this.type === 'matrix-match') {
              return Array.isArray(val) && val.length >= 1;
            }
            return true;
          },
          message: 'Matrix match questions require at least one pair.'
        }
      ],
    },
    matrixAnswers: {
      type: [[Number]],
      required: false, // can be empty
    },
    // Optional explanation for the answer
    explanation: {
      type: String,
      trim: true,
    },
    // --- 2. ADD MARKS FIELD ---
    marks: {
      type: Number,
      required: [true, 'Marks for the question are required.'],
      min: [1, 'Marks must be at least 1.'],
      default: 1,
    },
    // --- 3. ADD CREATEDBY FIELD ---
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      // not required
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Create and export the Question model
const Question: Model<IQuestion> = mongoose.models.Question || mongoose.model<IQuestion>('Question', QuestionSchema);

export default Question;

// <-- This registers the Class model with Mongoose