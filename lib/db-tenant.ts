
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
import '@/models/AuditLog';
import '@/models/ResponseUploadHistory';

// Sanitize school key for db name
function sanitizeKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

function resolveTenantDbName(schoolKey: string) {
  return `school_db_${sanitizeKey(schoolKey)}`;
}

function deleteTenantModel(conn: mongoose.Connection, name: string) {
  if (typeof conn.deleteModel === 'function') {
    try {
      conn.deleteModel(name);
      return;
    } catch {}
  }

  delete (conn.models as Record<string, any>)[name];
}

/**
 * Return a cached per-school DB connection on the same cluster.
 * We keep a stable tenant connection per db name so repeated API calls
 * do not pay the cost of recreating connection wrappers and recompiling models.
 */
export async function getTenantDb(schoolKey: string) {
  if (!schoolKey) throw new Error('schoolKey is required');
  await connectDB();
  const dbName = resolveTenantDbName(schoolKey);
  return mongoose.connection.useDb(dbName, { useCache: true });
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
    const existingTenantModel = conn.models[name];

    // During local schema edits/HMR, refresh the tenant model if the base schema changed.
    if (existingTenantModel && existingTenantModel.schema !== schema) {
      deleteTenantModel(conn, name);
    }

    out[name] = conn.models[name] || conn.model(name, schema);
  }
  return out as Record<T, any>;
}
