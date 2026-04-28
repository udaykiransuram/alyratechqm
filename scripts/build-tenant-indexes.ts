/*
  Build indexes for all tenant databases.
  Run: npm run build-tenant-indexes
*/
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { dbNameForSchool, ensureIndexesForTenantDbName } from '@/lib/admin/indexing';
import School from '@/models/School';

function formatReachabilityMessage(err: unknown) {
  const error = err as {
    name?: string;
    message?: string;
    reason?: { type?: string };
    cause?: { type?: string };
  };

  const selectionError =
    error?.name === 'MongooseServerSelectionError' ||
    error?.name === 'MongoServerSelectionError';

  if (!selectionError) {
    return null;
  }

  const topologyType = error.reason?.type || error.cause?.type;
  if (topologyType === 'ReplicaSetNoPrimary') {
    return 'Skipping tenant index build because MongoDB Atlas did not expose a primary. This is usually a transient network, VPN, or Atlas IP allowlist issue.';
  }

  return `Skipping tenant index build because MongoDB was unreachable during optional startup${topologyType ? ` (${topologyType})` : ''}.`;
}

async function main() {
  await connectDB();
  const schools = await School.find({}).lean();

  for (const school of schools) {
    const key = String((school as any).key || (school as any)._id);
    const dbName = dbNameForSchool(key);
    await ensureIndexesForTenantDbName(dbName);
    console.log(`[indexes] ensured for tenant ${key}`);
  }

  await mongoose.disconnect();
  console.log('Done building tenant indexes');
}

main().catch(async (err) => {
  await mongoose.disconnect().catch(() => undefined);

  if (process.env.INDEX_BUILD_OPTIONAL_DB === '1') {
    const reachabilityMessage = formatReachabilityMessage(err);
    if (reachabilityMessage) {
      console.warn(`[predev] ${reachabilityMessage}`);
      process.exit(0);
    }
  }

  console.error(err);
  process.exit(1);
});
