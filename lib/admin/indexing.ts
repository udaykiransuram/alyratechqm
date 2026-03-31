// lib/admin/indexing.ts
import mongoose from 'mongoose';

export async function ensureIndexesForTenantDbName(dbName: string) {
  const db = mongoose.connection.useDb(dbName, { useCache: false }).db;
  const res: Record<string, any> = {};
  async function ix(col: string, spec: any, opts: any = {}) {
    if (!db) throw new Error('Database not available');
    try { res[col] = res[col] || []; res[col].push(await db.collection(col).createIndex(spec, opts)); }
    catch (e: any) { res[col] = res[col] || []; res[col].push(`ERR: ${e.message}`); }
  }
  const activeStudentRollPartialFilter = {
    role: 'student',
    rollNumber: { $type: 'string', $gt: '' },
    $or: [{ isArchived: false }, { isArchived: { $exists: false } }],
  };
  // Questions
  await ix('questions', { content: 'text' }, { name: 'content_text' });
  await ix('questions', { class: 1, subject: 1, createdAt: -1 }, { name: 'class_subject_createdAt' });
  await ix('questions', { marks: 1 }, { name: 'marks_1' });
  await ix('questions', { tags: 1 }, { name: 'question_tags_1' });
  // Question Papers
  await ix('questionpapers', { createdAt: -1 }, { name: 'qp_createdAt_desc' });
  await ix('questionpapers', { class: 1, subject: 1, createdAt: -1 }, { name: 'qp_class_subject_createdAt' });
  await ix('questionpapers', { class: 1, onlineEnabled: 1, isArchived: 1 }, { name: 'class_online_enabled_archived_lookup' });
  // Responses
  await ix('questionpaperresponses', { paper: 1 }, { name: 'qpr_paper_1' });
  await ix('questionpaperresponses', { student: 1 }, { name: 'qpr_student_1' });
  await ix('questionpaperresponses', { paper: 1, student: 1 }, { name: 'qpr_paper_student_1' });
  await ix('questionpaperresponses', { student: 1, paper: 1 }, { name: 'qpr_student_paper_1' });
  await ix('examattemptlocks', { paper: 1, student: 1 }, {
    name: 'attempt_lock_paper_student_unique_1',
    unique: true,
  });
  await ix('examattemptlocks', { expiresAt: 1 }, {
    name: 'attempt_lock_expiresAt_ttl_1',
    expireAfterSeconds: 0,
  });
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
  await ix('users', { role: 1, rollNumber: 1 }, {
    name: 'student_roll_unique_active_1',
    unique: true,
    partialFilterExpression: activeStudentRollPartialFilter,
  });
  await ix('users', { class: 1, rollNumber: 1 }, { name: 'user_class_roll_1' });
  await ix('users', { class: 1, academicSection: 1, rollNumber: 1 }, { name: 'user_class_section_roll_1' });
  await ix('users', { role: 1, class: 1 }, { name: 'user_role_class_1' });
  await ix('academicsections', { class: 1, name: 1 }, { name: 'academic_section_class_name_1' });
  // Classes / TagTypes
  await ix('classes', { name: 1 }, { name: 'class_name_1' });
  await ix('tagtypes', { name: 1 }, { name: 'tagtype_name_1' });
  return res;
}

export function dbNameForSchool(key: string) {
  return `school_db_${String(key).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`;
}
