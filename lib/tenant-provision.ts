
import { connectDB } from '@/lib/db';
import { getTenantDb } from '@/lib/db-tenant';

// Ensure schemas are compiled on the default connection so useDb({ useCache: true }) can reuse them
import '@/models/Subject';
import '@/models/Class';
import '@/models/TagType';
import '@/models/Tag';
import '@/models/User';
import '@/models/Question';

export async function provisionTenant(schoolKey: string) {
  if (!schoolKey) throw new Error('schoolKey is required');
  await connectDB();
  const conn = await getTenantDb(schoolKey);

  // Force DB creation via a metadata upsert
  await conn.collection('tenant_meta').updateOne(
    { key: schoolKey },
    { $set: { key: schoolKey, createdAt: new Date() } },
    { upsert: true }
  );

  // Pre-provision core collections and indexes
  const modelNames = ['Subject','Class','TagType','Tag','User','Question'] as const;
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

  return { ok: true };
}
