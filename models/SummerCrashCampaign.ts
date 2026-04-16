import mongoose, { Document, Model, Schema } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";
import {
  SUMMER_CRASH_DEFAULT_CLASS_BANDS,
  SUMMER_CRASH_DISPLAY_NAME,
  SUMMER_CRASH_SCHOOL_KEY,
  SUMMER_CRASH_SUPPORT_CONTACT,
} from "@/lib/summer-crash/constants";

export interface ISummerCrashCampaignClassMapping {
  classBand: string;
  className: string;
  courseIds: string[];
  sortOrder: number;
}

export interface ISummerCrashCampaign extends Document {
  isActive: boolean;
  title: string;
  summerSchoolKey: string;
  supportContact?: string;
  classMappings: ISummerCrashCampaignClassMapping[];
}

const SummerCrashCampaignClassMappingSchema =
  new Schema<ISummerCrashCampaignClassMapping>(
    {
      classBand: {
        type: String,
        required: true,
        trim: true,
      },
      className: {
        type: String,
        required: true,
        trim: true,
      },
      courseIds: {
        type: [String],
        default: [],
      },
      sortOrder: {
        type: Number,
        default: 0,
      },
    },
    { _id: false },
  );

const SummerCrashCampaignSchema = new Schema<ISummerCrashCampaign>(
  {
    isActive: {
      type: Boolean,
      default: true,
    },
    title: {
      type: String,
      required: true,
      default: SUMMER_CRASH_DISPLAY_NAME,
      trim: true,
    },
    summerSchoolKey: {
      type: String,
      required: true,
      default: SUMMER_CRASH_SCHOOL_KEY,
      trim: true,
      lowercase: true,
      unique: true,
    },
    supportContact: {
      type: String,
      default: SUMMER_CRASH_SUPPORT_CONTACT || undefined,
      trim: true,
    },
    classMappings: {
      type: [SummerCrashCampaignClassMappingSchema],
      default: () =>
        SUMMER_CRASH_DEFAULT_CLASS_BANDS.map((classBand, index) => ({
          classBand,
          className: classBand,
          courseIds: [],
          sortOrder: index,
        })),
    },
  },
  { timestamps: true },
);

SummerCrashCampaignSchema.index(
  { summerSchoolKey: 1 },
  { unique: true, name: "summer_crash_campaign_school_key_unique" },
);

const modelRegistry = getModelRegistry();

const SummerCrashCampaign: Model<ISummerCrashCampaign> =
  (modelRegistry.SummerCrashCampaign as Model<ISummerCrashCampaign>) ||
  mongoose.model<ISummerCrashCampaign>(
    "SummerCrashCampaign",
    SummerCrashCampaignSchema,
  );

export default SummerCrashCampaign;

