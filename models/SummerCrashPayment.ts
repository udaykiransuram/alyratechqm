import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";
import { SUMMER_CRASH_SCHOOL_KEY } from "@/lib/summer-crash/constants";

export interface ISummerCrashPayment extends Document {
  campaignId: Types.ObjectId;
  summerSchoolKey: string;
  orderId: string;
  studentName: string;
  studentNameNormalized?: string;
  guardianName: string;
  phone: string;
  phoneDigits: string;
  classBand: string;
  classBandNormalized: string;
  sourceSchoolName?: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  cashfreePaymentId?: string;
  successLookupTokenHash: string;
  processedWebhookEventIds?: string[];
  paidAt?: Date | null;
  enrollmentId?: Types.ObjectId | null;
  summerId?: string;
}

const SummerCrashPaymentSchema = new Schema<ISummerCrashPayment>(
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
    orderId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentNameNormalized: {
      type: String,
      trim: true,
      lowercase: true,
      default: undefined,
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
      index: true,
    },
    sourceSchoolName: {
      type: String,
      trim: true,
      default: undefined,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      index: true,
    },
    cashfreePaymentId: {
      type: String,
      trim: true,
      default: undefined,
    },
    successLookupTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    processedWebhookEventIds: {
      type: [String],
      default: [],
    },
    paidAt: {
      type: Date,
      default: null,
    },
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: "SummerCrashEnrollment",
      default: null,
    },
    summerId: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
    },
  },
  { timestamps: true },
);

SummerCrashPaymentSchema.index(
  {
    campaignId: 1,
    phoneDigits: 1,
    status: 1,
  },
  { name: "summer_crash_payment_lookup_phone" },
);

SummerCrashPaymentSchema.index(
  {
    campaignId: 1,
    phoneDigits: 1,
    classBandNormalized: 1,
    studentNameNormalized: 1,
    createdAt: -1,
  },
  { name: "summer_crash_payment_lookup_student" },
);

const modelRegistry = getModelRegistry();

const SummerCrashPayment: Model<ISummerCrashPayment> =
  (modelRegistry.SummerCrashPayment as Model<ISummerCrashPayment>) ||
  mongoose.model<ISummerCrashPayment>(
    "SummerCrashPayment",
    SummerCrashPaymentSchema,
  );

export default SummerCrashPayment;
