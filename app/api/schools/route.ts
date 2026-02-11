
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { provisionTenant } from '@/lib/tenant-provision';
import School from '@/models/School';

export const runtime = 'nodejs';

export async function GET() {
  await connectDB();
  const schools = await School.find({}).sort({ displayName: 1 }).lean();
  return NextResponse.json({ success: true, schools });
}

export async function POST(req: NextRequest) {
  await connectDB();
  try {
    const body = await req.json();
    let { key, displayName } = body || {} as any;
    if (!key || !displayName) {
      return NextResponse.json({ success: false, message: 'key and displayName are required' }, { status: 400 });
    }
    key = String(key).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const exists = await School.findOne({ key });
    if (exists) return NextResponse.json({ success: false, message: 'School key already exists' }, { status: 409 });
    const school = await School.create({ key, displayName });
    try {
      await provisionTenant(key);

/* INDEX HOOK */
try {
  // Kick off single-tenant indexing without blocking response
  ensureTenantIndexesForKey(key).catch(() => {});
} catch (e) { /* ignore */ }

    } catch (e) { /* ignore provision errors in response, can be retried */ }
    return NextResponse.json({ success: true, school }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to create school' }, { status: 500 });
  }
}


async function ensureTenantIndexesForKey(schoolKey: string) {
  const dbn = `school_db_${String(schoolKey).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`;
  // Reuse minimal set to keep it fast
  const db = (await import('mongoose')).default.connection.useDb(dbn, { useCache: false }).db;
  await db.collection('questions').createIndex({ class: 1, subject: 1, createdAt: -1 }, { name: 'class_subject_createdAt' });
  await db.collection('questionpapers').createIndex({ createdAt: -1 }, { name: 'qp_createdAt_desc' });
  await db.collection('users').createIndex({ class: 1, rollNumber: 1 }, { name: 'user_class_roll_1' });
}
