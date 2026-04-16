import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./User.ts";

export interface IParentContact extends Document {
  student: Types.ObjectId;
  parentName?: string;
  phoneCountryCode?: string;
  phoneNumber: string;
  whatsappOptIn: boolean;
  consentAt?: Date | null;
  preferredLanguage?: string;
  relationship?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ParentContactSchema = new Schema<IParentContact>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentName: {
      type: String,
      trim: true,
      default: "",
    },
    phoneCountryCode: {
      type: String,
      trim: true,
      default: "+91",
    },
    phoneNumber: {
      type: String,
      trim: true,
      required: true,
    },
    whatsappOptIn: {
      type: Boolean,
      default: true,
      index: true,
    },
    consentAt: {
      type: Date,
      default: null,
    },
    preferredLanguage: {
      type: String,
      trim: true,
      default: "en",
    },
    relationship: {
      type: String,
      trim: true,
      default: "parent",
    },
  },
  { timestamps: true },
);

ParentContactSchema.index(
  { student: 1 },
  { unique: true, name: "parent_contact_unique_student_1" },
);
ParentContactSchema.index(
  { whatsappOptIn: 1, updatedAt: -1 },
  { name: "parent_contact_opt_in_lookup_1" },
);

const modelRegistry = getModelRegistry();

const existingParentContactModel = modelRegistry.ParentContact as
  | Model<IParentContact>
  | undefined;

if (
  existingParentContactModel &&
  (!existingParentContactModel.schema.path("whatsappOptIn") ||
    !existingParentContactModel.schema.path("preferredLanguage") ||
    !existingParentContactModel.schema.path("relationship"))
) {
  delete modelRegistry.ParentContact;
}

const ParentContact: Model<IParentContact> =
  (modelRegistry.ParentContact as Model<IParentContact>) ||
  mongoose.model<IParentContact>("ParentContact", ParentContactSchema);

export default ParentContact;
