
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
import '@/models/QuestionImportDraft';
import '@/models/Course';
import '@/models/CourseProgress';
import '@/models/DiaryEntry';
import '@/models/DiaryStudentState';
import '@/models/LiveSession';
import '@/models/LiveSessionAttendance';
import '@/models/LiveSessionItem';
import '@/models/LiveSessionResponse';
import '@/models/LiveSessionTranscript';
import '@/models/StudentNotification';
import '@/models/ParentContact';
import '@/models/StudentDailyProgress';
import '@/models/StudentTagWeakness';
import '@/models/TagPracticeSet';
import '@/models/StudentTagPerformance';
import '@/models/TagPeerStats';

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
  QuestionImportDraft: typeof import('@/models/QuestionImportDraft').default;
  Course: typeof import('@/models/Course').default;
  CourseProgress: typeof import('@/models/CourseProgress').default;
  DiaryEntry: typeof import('@/models/DiaryEntry').default;
  DiaryStudentState: typeof import('@/models/DiaryStudentState').default;
  LiveSession: typeof import('@/models/LiveSession').default;
  LiveSessionAttendance: typeof import('@/models/LiveSessionAttendance').default;
  LiveSessionItem: typeof import('@/models/LiveSessionItem').default;
  LiveSessionResponse: typeof import('@/models/LiveSessionResponse').default;
  LiveSessionTranscript: typeof import('@/models/LiveSessionTranscript').default;
  StudentNotification: typeof import('@/models/StudentNotification').default;
  ParentContact: typeof import('@/models/ParentContact').default;
  StudentDailyProgress: typeof import('@/models/StudentDailyProgress').default;
  StudentTagWeakness: typeof import('@/models/StudentTagWeakness').default;
  TagPracticeSet: typeof import('@/models/TagPracticeSet').default;
  StudentTagPerformance: typeof import('@/models/StudentTagPerformance').default;
  TagPeerStats: typeof import('@/models/TagPeerStats').default;
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

function collectTenantConnections(
  source: unknown,
  seen: Set<mongoose.Connection>,
  out: mongoose.Connection[],
) {
  if (!source) {
    return;
  }

  const values = Array.isArray(source)
    ? source
    : source instanceof Map
      ? Array.from(source.values())
      : typeof source === "object"
        ? Object.values(source as Record<string, unknown>)
        : [];

  values.forEach((value) => {
    if (!value || typeof value !== "object") {
      return;
    }

    const connection = value as mongoose.Connection;
    if (connection === mongoose.connection || seen.has(connection)) {
      return;
    }

    seen.add(connection);
    out.push(connection);
  });
}

export function getTenantDbCacheStats() {
  const connection = mongoose.connection as mongoose.Connection & {
    relatedDbs?: unknown;
    otherDbs?: unknown;
  };
  const seen = new Set<mongoose.Connection>();
  const cachedTenantConnections: mongoose.Connection[] = [];

  collectTenantConnections(connection.relatedDbs, seen, cachedTenantConnections);
  collectTenantConnections(connection.otherDbs, seen, cachedTenantConnections);

  const tenantDbNames = cachedTenantConnections
    .map((tenantConnection) =>
      String(
        tenantConnection?.name ||
          tenantConnection?.db?.databaseName ||
          "",
      ).trim(),
    )
    .filter(Boolean)
    .sort();

  const compiledModelCount = cachedTenantConnections.reduce((count, tenantConnection) => {
    return count + Object.keys(tenantConnection?.models || {}).length;
  }, 0);

  return {
    activeConnections: cachedTenantConnections.length,
    compiledModelCount,
    sampleTenantDbNames: tenantDbNames.slice(0, 8),
    truncated: tenantDbNames.length > 8,
  };
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
