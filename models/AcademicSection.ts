import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { applyArchiveFields, hasArchiveFields } from "@/lib/archive";
import { getModelRegistry } from "@/lib/mongoose-models";

import "./Class.ts";

export interface IAcademicSection extends Document {
  name: string;
  class: Types.ObjectId;
  description?: string;
  isActive?: boolean;
}

const AcademicSectionSchema: Schema<IAcademicSection> = new Schema(
  {
    name: {
      type: String,
      required: [true, "Section name is required."],
      trim: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required for a section."],
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

AcademicSectionSchema.index(
  { class: 1, name: 1 },
  { unique: true, name: "academic_section_class_name_1" },
);

applyArchiveFields(AcademicSectionSchema);

const modelRegistry = getModelRegistry();

const existingAcademicSectionModel = modelRegistry.AcademicSection as
  | Model<IAcademicSection>
  | undefined;

if (existingAcademicSectionModel && !hasArchiveFields(existingAcademicSectionModel)) {
  delete modelRegistry.AcademicSection;
}

const AcademicSection: Model<IAcademicSection> =
  (modelRegistry.AcademicSection as Model<IAcademicSection>) ||
  mongoose.model<IAcademicSection>("AcademicSection", AcademicSectionSchema);

export default AcademicSection;
