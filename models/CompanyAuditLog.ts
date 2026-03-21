import mongoose, { Document, Model, Schema } from "mongoose";
import { getModelRegistry } from "@/lib/mongoose-models";

export interface ICompanyAuditLog extends Document {
  schoolKey?: string;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  action: string;
  summary: string;
  details?: Record<string, any>;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  source?: string;
  requestMethod?: string;
  requestPath?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyAuditLogSchema = new Schema<ICompanyAuditLog>(
  {
    schoolKey: { type: String, trim: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: { type: String, trim: true },
    entityLabel: { type: String, trim: true },
    action: { type: String, required: true, trim: true, index: true },
    summary: { type: String, required: true, trim: true },
    details: { type: Schema.Types.Mixed },
    actorId: { type: String, trim: true },
    actorName: { type: String, trim: true },
    actorEmail: { type: String, trim: true },
    actorRole: { type: String, trim: true },
    source: { type: String, trim: true, default: "api" },
    requestMethod: { type: String, trim: true },
    requestPath: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { timestamps: true },
);

CompanyAuditLogSchema.index({ createdAt: -1 });
CompanyAuditLogSchema.index({ schoolKey: 1, createdAt: -1 });
CompanyAuditLogSchema.index({ action: 1, createdAt: -1 });
CompanyAuditLogSchema.index({ entityType: 1, createdAt: -1 });
CompanyAuditLogSchema.index({ source: 1, createdAt: -1 });

const modelRegistry = getModelRegistry();

const existingCompanyAuditLogModel =
  modelRegistry.CompanyAuditLog as Model<ICompanyAuditLog> | undefined;

if (
  existingCompanyAuditLogModel &&
  (!existingCompanyAuditLogModel.schema.path("schoolKey") ||
    !existingCompanyAuditLogModel.schema.path("requestPath"))
) {
  delete modelRegistry.CompanyAuditLog;
}

const CompanyAuditLog: Model<ICompanyAuditLog> =
  (modelRegistry.CompanyAuditLog as Model<ICompanyAuditLog>) ||
  mongoose.model<ICompanyAuditLog>("CompanyAuditLog", CompanyAuditLogSchema);

export default CompanyAuditLog;
