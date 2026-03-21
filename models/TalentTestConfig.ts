import mongoose, { Document, Model, Schema } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

export interface ITalentTestConfig extends Document {
  name: string;
  description: string;
  price: number;
  currency: string;
  duration: string;
  subjects: string[];
  features: string[];
  isActive: boolean;
  registrationsOpen?: Date;
  registrationDeadline?: Date;
  testWindowStart?: Date;
  testWindowEnd?: Date;
  resultsDate?: Date;
}

const TalentTestConfigSchema: Schema<ITalentTestConfig> = new Schema(
  {
    name: {
      type: String,
      required: true,
      default: "Precision Baseline Assessment",
    },
    description: {
      type: String,
      required: true,
      default:
        "Comprehensive diagnostic test to identify student strengths and areas for improvement",
    },
    price: {
      type: Number,
      required: true,
      default: 100,
    },
    currency: {
      type: String,
      default: "INR",
    },
    duration: {
      type: String,
      default: "45 minutes",
    },
    subjects: {
      type: [String],
      default: ["Mathematics", "Science", "English"],
    },
    features: {
      type: [String],
      default: [
        "Detailed diagnostic report",
        "Personalized learning recommendations",
        "Subject-wise performance analysis",
        "Instant results delivery via email",
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    registrationsOpen: {
      type: Date,
      required: false,
    },
    registrationDeadline: {
      type: Date,
      required: false,
    },
    testWindowStart: {
      type: Date,
      required: false,
    },
    testWindowEnd: {
      type: Date,
      required: false,
    },
    resultsDate: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

const modelRegistry = getModelRegistry();

const TalentTestConfig: Model<ITalentTestConfig> =
  (modelRegistry.TalentTestConfig as Model<ITalentTestConfig>) ||
  mongoose.model<ITalentTestConfig>("TalentTestConfig", TalentTestConfigSchema);

export default TalentTestConfig;
