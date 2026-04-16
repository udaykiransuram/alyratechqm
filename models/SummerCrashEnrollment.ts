import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";
import { SUMMER_CRASH_SCHOOL_KEY } from "@/lib/summer-crash/constants";

export interface ISummerCrashEnrollment extends Document {
  campaignId: Types.ObjectId;
  summerSchoolKey: string;
  summerStudentId?: Types.ObjectId | null;
  summerId: string;
  studentName: string;
  studentNameNormalized: string;
  guardianName: string;
  phone: string;
  phoneDigits: string;
  classBand: string;
  classBandNormalized: string;
  sourceSchoolName?: string;
  status: "registered" | "setup_pending" | "active" | "archived";
  joinedAt?: Date | null;
  firstAccessAt?: Date | null;
}

const SummerCrashEnrollmentSchema = new Schema<ISummerCrashEnrollment>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "SummerCrashCampaign",
      required: true,
      index: true,
    },
    summerSchoolKey: {
      type: String,
      required: true,
      default: SUMMER_CRASH_SCHOOL_KEY,
      trim: true,
      lowercase: true,
      index: true,
    },
    summerStudentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    summerId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentNameNormalized: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    guardianName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    phoneDigits: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    classBand: {
      type: String,
      required: true,
      trim: true,
    },
    classBandNormalized: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    sourceSchoolName: {
      type: String,
      trim: true,
      default: undefined,
    },
    status: {
      type: String,
      enum: ["registered", "setup_pending", "active", "archived"],
      default: "registered",
      index: true,
    },
    joinedAt: {
      type: Date,
      default: () => new Date(),
    },
    firstAccessAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

SummerCrashEnrollmentSchema.index(
  {
    campaignId: 1,
    phoneDigits: 1,
    studentNameNormalized: 1,
    classBandNormalized: 1,
  },
  {
    unique: true,
    name: "summer_crash_enrollment_unique_student_tuple",
  },
);

SummerCrashEnrollmentSchema.index(
  {
    summerSchoolKey: 1,
    phoneDigits: 1,
    status: 1,
  },
  { name: "summer_crash_enrollment_lookup_phone" },
);

const modelRegistry = getModelRegistry();

const SummerCrashEnrollment: Model<ISummerCrashEnrollment> =
  (modelRegistry.SummerCrashEnrollment as Model<ISummerCrashEnrollment>) ||
  mongoose.model<ISummerCrashEnrollment>(
    "SummerCrashEnrollment",
    SummerCrashEnrollmentSchema,
  );

export default SummerCrashEnrollment;
