
import mongoose, { Schema, Document, Model } from 'mongoose';
import { getModelRegistry } from '@/lib/mongoose-models';

export interface ISchoolWorkspaceAppearance {
  textStyle?: string;
  navMode?: string;
  navTone?: string;
  palette?: string;
  customAccentHex?: string;
}

export interface ISchool extends Document {
  key: string;
  displayName: string;
  bootstrapAdminUserId?: string;
  workspaceAppearance?: ISchoolWorkspaceAppearance;
  createdAt: Date;
  updatedAt: Date;
}

const SchoolWorkspaceAppearanceSchema = new Schema<ISchoolWorkspaceAppearance>(
  {
    textStyle: { type: String, trim: true },
    navMode: { type: String, trim: true },
    navTone: { type: String, trim: true },
    palette: { type: String, trim: true },
    customAccentHex: { type: String, trim: true },
  },
  { _id: false },
);

const SchoolSchema: Schema<ISchool> = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true },
    bootstrapAdminUserId: { type: String, trim: true },
    workspaceAppearance: {
      type: SchoolWorkspaceAppearanceSchema,
      default: undefined,
    },
  },
  { timestamps: true }
);

const modelRegistry = getModelRegistry();

const School: Model<ISchool> =
  (modelRegistry.School as Model<ISchool>) ||
  mongoose.model<ISchool>('School', SchoolSchema);
export default School;
