
// lib/db-tenant.ts
import mongoose from 'mongoose';
import { connectDB } from './db.ts';

// Ensure base connection has schemas registered
import '@/models/TagType';
import '@/models/Tag';
import '@/models/Class';
import '@/models/AcademicSection';
import '@/models/Subject';
import '@/models/Question';
import '@/models/QuestionPaper';
import '@/models/QuestionPaperResponse';
import '@/models/User';
import '@/models/Registration';
import '@/models/AuditLog';
import '@/models/ResponseUploadHistory';

// Sanitize school key for db name
function sanitizeKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

/**
 * Return a per-school DB connection on the same cluster.
 * IMPORTANT: useCache=false so models are not reused from the global connection.
 */
export async function getTenantDb(schoolKey: string) {
  if (!schoolKey) throw new Error('schoolKey is required');
  await connectDB();
  const dbName = `school_db_${sanitizeKey(schoolKey)}`;
  return mongoose.connection.useDb(dbName, { useCache: false });
}

/**
 * Ensure that the given models are compiled on the tenant connection using
 * the schemas from the base connection. Returns a map of models.
 */
export async function getTenantModels<T extends string>(schoolKey: string, names: T[]): Promise<Record<T, any>> {
  const conn = await getTenantDb(schoolKey);
  const out: Record<string, any> = {};
  for (const name of names) {
    const baseModel = mongoose.model(name); // schema must be registered on base
    const schema = baseModel.schema;
    out[name] = conn.models[name] || conn.model(name, schema);
  }
  return out as Record<T, any>;
}
