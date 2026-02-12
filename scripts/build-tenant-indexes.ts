
/*
  Build indexes for all tenant databases.
  Run: npx ts-node scripts/build-tenant-indexes.ts
*/
import mongoose from 'mongoose';
import { connectDB } from '../lib/db';
import { getTenantDb } from '../lib/db-tenant';
import School from '../models/School';

async function ensureIndexesForTenant(dbName: string) {
  const db = mongoose.connection.useDb(dbName, { useCache: false }).db;
  if (!db) throw new Error('Tenant database not available');
  const res: Record<string, any> = {};
  async function ix(col: string, spec: any, opts: any = {}) {
    if (!db) throw new Error('Tenant database not available');
    try { res[col] = res[col] || []; res[col].push(await db.collection(col).createIndex(spec, opts)); }
    catch (e: any) { res[col] = res[col] || []; res[col].push(`ERR: ${e.message}`); }
  }

  // Questions
  await ix('questions', { content: 'text' }, { name: 'content_text' });
  await ix('questions', { class: 1, subject: 1, createdAt: -1 }, { name: 'class_subject_createdAt' });
  await ix('questions', { marks: 1 }, { name: 'marks_1' });

  // Question Papers
  await ix('questionpapers', { createdAt: -1 }, { name: 'qp_createdAt_desc' });
  await ix('questionpapers', { class: 1, subject: 1, createdAt: -1 }, { name: 'qp_class_subject_createdAt' });

  // Question Paper Responses
  await ix('questionpaperresponses', { paper: 1 }, { name: 'qpr_paper_1' });
  await ix('questionpaperresponses', { student: 1 }, { name: 'qpr_student_1' });
  await ix('questionpaperresponses', { paper: 1, student: 1 }, { name: 'qpr_paper_student_1' });

  // Subjects
  await ix('subjects', { name: 1 }, { name: 'subject_name_1' });
  await ix('subjects', { code: 1 }, { name: 'subject_code_1' });

  // Tags
  await ix('tags', { type: 1, name: 1 }, { name: 'tag_type_name_1' });
  await ix('tags', { name: 1 }, { name: 'tag_name_1' });

  // Users
  await ix('users', { role: 1 }, { name: 'user_role_1' });
  await ix('users', { class: 1, rollNumber: 1 }, { name: 'user_class_roll_1' });
  await ix('users', { email: 1 }, { name: 'user_email_1' });

  // Classes / TagTypes (lightweight lookups)
  await ix('classes', { name: 1 }, { name: 'class_name_1' });
  await ix('tagtypes', { name: 1 }, { name: 'tagtype_name_1' });

  return res;
}

async function main() {
  await connectDB();
  const schools = await School.find({}).lean();
  const results: Record<string, any> = {};
  for (const s of schools) {
    const key: string = s.key || s._id?.toString();
    const dbName = `school_db_${String(key).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`;
    results[key] = await ensureIndexesForTenant(dbName);
    console.log(`[indexes] ensured for tenant`, key);
  }
  await mongoose.disconnect();
  console.log('Done building tenant indexes');
}

main().catch(err => { console.error(err); process.exit(1); });
