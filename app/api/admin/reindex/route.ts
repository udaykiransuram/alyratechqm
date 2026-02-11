
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import School from '@/models/School';
import { getTenantDb } from '@/lib/db-tenant';

async function ensureIndexesForTenantDbName(dbName: string) {
  const db = mongoose.connection.useDb(dbName, { useCache: false }).db;
  const res: Record<string, any> = {};
  async function ix(col: string, spec: any, opts: any = {}) {
    try { res[col] = res[col] || []; res[col].push(await db.collection(col).createIndex(spec, opts)); }
    catch (e: any) { res[col] = res[col] || []; res[col].push(`ERR: ${e.message}`); }
  }
  // Questions
  await ix('questions', { content: 'text' }, { name: 'content_text' });
  await ix('questions', { class: 1, subject: 1, createdAt: -1 }, { name: 'class_subject_createdAt' });
  await ix('questions', { marks: 1 }, { name: 'marks_1' });
  await ix('questions', { tags: 1 }, { name: 'question_tags_1' });
  // Question Papers
  await ix('questionpapers', { createdAt: -1 }, { name: 'qp_createdAt_desc' });
  await ix('questionpapers', { class: 1, subject: 1, createdAt: -1 }, { name: 'qp_class_subject_createdAt' });
  // Responses
  await ix('questionpaperresponses', { paper: 1 }, { name: 'qpr_paper_1' });
  await ix('questionpaperresponses', { student: 1 }, { name: 'qpr_student_1' });
  await ix('questionpaperresponses', { paper: 1, student: 1 }, { name: 'qpr_paper_student_1' });
  // Subjects
  await ix('subjects', { name: 1 }, { name: 'subject_name_1' });
  await ix('subjects', { code: 1 }, { name: 'subject_code_1' });
  await ix('subjects', { tags: 1 }, { name: 'subject_tags_1' });
  // Tags
  await ix('tags', { type: 1, name: 1 }, { name: 'tag_type_name_1' });
  await ix('tags', { name: 1 }, { name: 'tag_name_1' });
  // Users
  await ix('users', { role: 1 }, { name: 'user_role_1' });
  await ix('users', { name: 1 }, { name: 'user_name_1' });
  await ix('users', { class: 1, rollNumber: 1 }, { name: 'user_class_roll_1' });
  await ix('users', { role: 1, class: 1 }, { name: 'user_role_class_1' });
  // Classes / TagTypes
  await ix('classes', { name: 1 }, { name: 'class_name_1' });
  await ix('tagtypes', { name: 1 }, { name: 'tagtype_name_1' });
  return res;
}

function dbNameForSchool(key: string) {
  return `school_db_${String(key).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`;
}

export async function POST(req: NextRequest) {
  await connectDB();
  const adminSecret = process.env.ADMIN_INDEX_SECRET || process.env.ADMIN_SECRET || '';
  const hdr = req.headers.get('x-admin-secret') || '';
  if (!adminSecret || hdr !== adminSecret) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const schoolKey = body?.schoolKey ? String(body.schoolKey) : '';
    const all = !!body?.all;
    const out: Record<string, any> = {};
    if (all) {
      const schools = await School.find({}).lean();
      for (const s of schools) {
        const key = (s as any).key || String((s as any)._id);
        const dbn = dbNameForSchool(key);
        out[key] = await ensureIndexesForTenantDbName(dbn);
      }
    } else if (schoolKey) {
      const dbn = dbNameForSchool(schoolKey);
      out[schoolKey] = await ensureIndexesForTenantDbName(dbn);
    } else {
      return NextResponse.json({ success: false, message: 'Provide schoolKey or set all=true' }, { status: 400 });
    }
    return NextResponse.json({ success: true, results: out });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'failed' }, { status: 500 });
  }
}
