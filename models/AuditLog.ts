import mongoose, { Document, Model, Schema } from "mongoose";
import { getModelRegistry } from "@/lib/mongoose-models";

export interface IAuditLog extends Document {
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
  ipAddress?: string;
  userAgent?: string;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
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
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { timestamps: true },
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

const modelRegistry = getModelRegistry();

const AuditLog: Model<IAuditLog> =
  (modelRegistry.AuditLog as Model<IAuditLog>) ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
