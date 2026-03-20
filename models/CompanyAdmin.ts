import mongoose, { Document, Model, Schema } from "mongoose";
import { getModelRegistry } from "@/lib/mongoose-models";

export interface ICompanyAdmin extends Document {
  name: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyAdminSchema = new Schema<ICompanyAdmin>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const modelRegistry = getModelRegistry();

const CompanyAdmin: Model<ICompanyAdmin> =
  (modelRegistry.CompanyAdmin as Model<ICompanyAdmin>) ||
  mongoose.model<ICompanyAdmin>("CompanyAdmin", CompanyAdminSchema);

export default CompanyAdmin;
