
// lib/db-tenant.ts
import mongoose from 'mongoose';
import { connectDB } from './db.ts';

// Ensure base connection has schemas registered
import '@/models/TagType';
import '@/models/Tag';
import '@/models/Class';
import '@/models/Subject';
import '@/models/Question';
import '@/models/QuestionPaper';
import '@/models/QuestionPaperResponse';
import '@/models/User';
import '@/models/Registration';

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
  // Debug: log tenant DB resolution
  try {
    console.debug('[db-tenant] Resolving tenant DB', { schoolKey, dbName });
  } catch {}
  return mongoose.connection.useDb(dbName, { useCache: false });
}

/**
 * Ensure that the given models are compiled on the tenant connection using
 * the schemas from the base connection. Returns a map of models.
 */
export async function getTenantModels<T extends string>(schoolKey: string, names: T[]): Promise<Record<T, any>> {
  const conn = await getTenantDb(schoolKey);
  const out: Record<string, any> = {};
  // Debug: log model compilation intent
  try {
    console.debug('[db-tenant] getTenantModels start', { schoolKey, names });
  } catch {}
  for (const name of names) {
    const baseModel = mongoose.model(name); // schema must be registered on base
    const schema = baseModel.schema;
    out[name] = conn.models[name] || conn.model(name, schema);
    try {
      console.debug('[db-tenant] model ensured on tenant', { model: name, compiled: !!conn.models[name] });
    } catch {}
  }
  try {
    console.debug('[db-tenant] getTenantModels done', { schoolKey, ensured: names });
  } catch {}
  return out as Record<T, any>;
}
