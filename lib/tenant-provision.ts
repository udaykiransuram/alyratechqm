
import { connectDB } from '@/lib/db';
import { getTenantDb } from '@/lib/db-tenant';

// Ensure schemas are compiled on the default connection so useDb({ useCache: true }) can reuse them
import '@/models/Subject';
import '@/models/Class';
import '@/models/AcademicSection';
import '@/models/TagType';
import '@/models/Tag';
import '@/models/User';
import '@/models/Question';
import '@/models/QuestionPaper';
import '@/models/QuestionPaperResponse';
import '@/models/Course';
import '@/models/CourseProgress';
import '@/models/StudentNotification';

const tenantProvisionState = globalThis as typeof globalThis & {
  __tenantProvisionDone__?: Set<string>;
  __tenantProvisionInflight__?: Map<string, Promise<{ ok: true }>>;
};

const provisionedTenants =
  tenantProvisionState.__tenantProvisionDone__ ??
  (tenantProvisionState.__tenantProvisionDone__ = new Set<string>());
const inflightTenantProvision =
  tenantProvisionState.__tenantProvisionInflight__ ??
  (tenantProvisionState.__tenantProvisionInflight__ = new Map<
    string,
    Promise<{ ok: true }>
  >());

export async function provisionTenant(schoolKey: string) {
  if (!schoolKey) throw new Error('schoolKey is required');
  if (provisionedTenants.has(schoolKey)) {
    return { ok: true } as const;
  }

  const existingProvision = inflightTenantProvision.get(schoolKey);
  if (existingProvision) {
    return existingProvision;
  }

  const provisionPromise = (async () => {
    await connectDB();
    const conn = await getTenantDb(schoolKey);

    // Force DB creation via a metadata upsert
    await conn.collection('tenant_meta').updateOne(
      { key: schoolKey },
      { $set: { key: schoolKey, createdAt: new Date() } },
      { upsert: true }
    );

    // Pre-provision core collections and indexes
    const modelNames = [
      'Subject',
      'Class',
      'AcademicSection',
      'TagType',
      'Tag',
      'User',
      'Question',
      'QuestionPaper',
      'QuestionPaperResponse',
      'Course',
      'CourseProgress',
      'StudentNotification',
    ] as const;
    for (const name of modelNames) {
      try {
        const M = conn.model(name);
        // Create collection if not exists
        await M.createCollection().catch(() => {});
        // Ensure indexes
        if (typeof (M as any).syncIndexes === 'function') {
          await (M as any).syncIndexes().catch(() => {});
        }
      } catch (e) {
        // Ignore missing models; but we imported all above so this should be fine
      }
    }

    try {
      const attemptLockCollection = conn.collection('examattemptlocks');
      await attemptLockCollection.createIndex(
        { paper: 1, student: 1 },
        {
          name: 'attempt_lock_paper_student_unique_1',
          unique: true,
        },
      );
      await attemptLockCollection.createIndex(
        { expiresAt: 1 },
        {
          name: 'attempt_lock_expiresAt_ttl_1',
          expireAfterSeconds: 0,
        },
      );
    } catch (e) {
      // Ignore provisioning-time failures; the app also lazily ensures these indexes.
    }

    provisionedTenants.add(schoolKey);
    return { ok: true } as const;
  })();

  inflightTenantProvision.set(schoolKey, provisionPromise);

  try {
    return await provisionPromise;
  } finally {
    inflightTenantProvision.delete(schoolKey);
  }
}
