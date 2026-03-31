
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

type TenantCoreModelMap = {
  TagType: typeof import('@/models/TagType').default;
  Tag: typeof import('@/models/Tag').default;
  Class: typeof import('@/models/Class').default;
  AcademicSection: typeof import('@/models/AcademicSection').default;
  Subject: typeof import('@/models/Subject').default;
  Question: typeof import('@/models/Question').default;
  QuestionPaper: typeof import('@/models/QuestionPaper').default;
  QuestionPaperResponse: typeof import('@/models/QuestionPaperResponse').default;
  User: typeof import('@/models/User').default;
  AuditLog: typeof import('@/models/AuditLog').default;
  ResponseUploadHistory: typeof import('@/models/ResponseUploadHistory').default;
};

type TenantModelForName<Name extends string> =
  Name extends keyof TenantCoreModelMap
    ? TenantCoreModelMap[Name]
    : mongoose.Model<unknown>;

type TenantModelsForNames<Names extends string> = {
  [Name in Names]: TenantModelForName<Name>;
};

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

  delete (conn.models as Record<string, mongoose.Model<unknown>>)[name];
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
export async function getTenantModels<T extends string>(
  schoolKey: string,
  names: readonly T[],
): Promise<TenantModelsForNames<T>> {
  const conn = await getTenantDb(schoolKey);
  const out: Partial<TenantModelsForNames<T>> = {};
  for (const name of names) {
    const baseModel = mongoose.model(name); // schema must be registered on base
    const schema = baseModel.schema;
    const existingTenantModel = conn.models[name];

    // During local schema edits/HMR, refresh the tenant model if the base schema changed.
    if (existingTenantModel && existingTenantModel.schema !== schema) {
      deleteTenantModel(conn, name);
    }

    out[name] =
      ((conn.models[name] as TenantModelForName<T>) ||
        (conn.model(name, schema) as TenantModelForName<T>)) as TenantModelsForNames<T>[typeof name];
  }
  return out as TenantModelsForNames<T>;
}

export async function getTypedTenantModels<
  const Names extends readonly (keyof TenantCoreModelMap)[],
>(
  schoolKey: string,
  names: Names,
): Promise<Pick<TenantCoreModelMap, Names[number]>> {
  const models = await getTenantModels<Names[number]>(schoolKey, names);
  return models as Pick<TenantCoreModelMap, Names[number]>;
}
