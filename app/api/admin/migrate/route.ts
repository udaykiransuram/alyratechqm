
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { getTenantDb } from '@/lib/db-tenant';

// Map logical names to actual MongoDB collection names
const COLLECTIONS: Record<string, string> = {
  tagtypes: 'tagtypes',
  tags: 'tags',
  classes: 'classes',
  subjects: 'subjects',
  questions: 'questions',
  questionpapers: 'questionpapers',
  users: 'users',
  questionpaperresponses: 'questionpaperresponses',
};

async function migrateCollection(globalConn: mongoose.Connection, tenantConn: mongoose.Connection, collName: string) {
  const gcol = globalConn.db.collection(collName);
  const tcol = tenantConn.db.collection(collName);
  const total = await gcol.countDocuments();
  let copied = 0;
  const batchSize = 1000;
  const cursor = gcol.find({}).batchSize(batchSize);
  const bulkOps: any[] = [];
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    bulkOps.push({ updateOne: { filter: { _id: doc._id }, update: { $set: doc }, upsert: true } });
    if (bulkOps.length >= batchSize) {
      await tcol.bulkWrite(bulkOps, { ordered: false });
      copied += bulkOps.length;
      bulkOps.length = 0;
    }
  }
  if (bulkOps.length) {
    await tcol.bulkWrite(bulkOps, { ordered: false });
    copied += bulkOps.length;
  }
  return { total, copied };
}

export async function POST(req: NextRequest) {
  await connectDB();
  try {
    const body = await req.json();
    const schoolKey = (body?.schoolKey || '').toString().trim();
    if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
    const copy = body?.copy !== false;
    const collections: string[] = Array.isArray(body?.collections) && body.collections.length
      ? body.collections
      : Object.keys(COLLECTIONS);
    const wipe = !!body?.wipe; // if true, clears tenant collections before copy

    const tenantConn = await getTenantDb(schoolKey);
    const globalConn = mongoose.connection;

    const results: Record<string, any> = {};

    if (wipe) {
      for (const key of collections) {
        const collName = COLLECTIONS[key.toLowerCase()];
        if (!collName) continue;
        try {
          await tenantConn.db.collection(collName).deleteMany({});
          results[key] = { ...(results[key] || {}), wiped: true };
        } catch (e: any) {
          results[key] = { ...(results[key] || {}), wiped: false, error: e?.message };
        }
      }
    }

    if (copy) {
      for (const key of collections) {
        const collName = COLLECTIONS[key.toLowerCase()];
        if (!collName) continue;
        try {
          const r = await migrateCollection(globalConn, tenantConn, collName);
          results[key] = { ...(results[key] || {}), ...r };
        } catch (e: any) {
          results[key] = { ...(results[key] || {}), error: e?.message };
        }
      }
    }

    return NextResponse.json({ success: true, schoolKey, dbName: (tenantConn as any).db?.name, results, copy });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'failed' }, { status: 500 });
  }
}
