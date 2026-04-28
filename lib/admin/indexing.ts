// lib/admin/indexing.ts
import mongoose from 'mongoose';

export type TenantIndexDefinition = {
  collection: string;
  spec: Record<string, any>;
  options?: Record<string, any>;
};

const activeStudentRollPartialFilter = {
  role: 'student',
  rollNumber: { $type: 'string', $gt: '' },
  $or: [{ isArchived: false }, { isArchived: { $exists: false } }],
};

export const tenantIndexDefinitions: TenantIndexDefinition[] = [
  // Questions
  { collection: 'questions', spec: { content: 'text' }, options: { name: 'content_text' } },
  { collection: 'questions', spec: { class: 1, subject: 1, createdAt: -1 }, options: { name: 'class_subject_createdAt' } },
  { collection: 'questions', spec: { marks: 1 }, options: { name: 'marks_1' } },
  { collection: 'questions', spec: { tags: 1 }, options: { name: 'question_tags_1' } },
  // Question Papers
  { collection: 'questionpapers', spec: { createdAt: -1 }, options: { name: 'qp_createdAt_desc' } },
  { collection: 'questionpapers', spec: { class: 1, subject: 1, createdAt: -1 }, options: { name: 'qp_class_subject_createdAt' } },
  { collection: 'questionpapers', spec: { class: 1, onlineEnabled: 1, isArchived: 1 }, options: { name: 'class_online_enabled_archived_lookup' } },
  // Responses
  { collection: 'questionpaperresponses', spec: { paper: 1 }, options: { name: 'qpr_paper_1' } },
  { collection: 'questionpaperresponses', spec: { student: 1 }, options: { name: 'qpr_student_1' } },
  { collection: 'questionpaperresponses', spec: { paper: 1, student: 1 }, options: { name: 'qpr_paper_student_1' } },
  { collection: 'questionpaperresponses', spec: { student: 1, paper: 1 }, options: { name: 'qpr_student_paper_1' } },
  { collection: 'examattemptlocks', spec: { paper: 1, student: 1 }, options: { name: 'attempt_lock_paper_student_unique_1', unique: true } },
  { collection: 'examattemptlocks', spec: { expiresAt: 1 }, options: { name: 'attempt_lock_expiresAt_ttl_1', expireAfterSeconds: 0 } },
  // Subjects
  { collection: 'subjects', spec: { name: 1 }, options: { name: 'subject_name_1' } },
  { collection: 'subjects', spec: { code: 1 }, options: { name: 'subject_code_1' } },
  { collection: 'subjects', spec: { tags: 1 }, options: { name: 'subject_tags_1' } },
  // Tags
  { collection: 'tags', spec: { type: 1, name: 1 }, options: { name: 'tag_type_name_1' } },
  { collection: 'tags', spec: { name: 1 }, options: { name: 'tag_name_1' } },
  // Users
  { collection: 'users', spec: { role: 1 }, options: { name: 'user_role_1' } },
  { collection: 'users', spec: { name: 1 }, options: { name: 'user_name_1' } },
  {
    collection: 'users',
    spec: { role: 1, rollNumber: 1 },
    options: {
      name: 'student_roll_unique_active_1',
      unique: true,
      partialFilterExpression: activeStudentRollPartialFilter,
    },
  },
  { collection: 'users', spec: { class: 1, rollNumber: 1 }, options: { name: 'user_class_roll_1' } },
  { collection: 'users', spec: { class: 1, academicSection: 1, rollNumber: 1 }, options: { name: 'user_class_section_roll_1' } },
  { collection: 'users', spec: { role: 1, class: 1 }, options: { name: 'user_role_class_1' } },
  { collection: 'academicsections', spec: { class: 1, name: 1 }, options: { name: 'academic_section_class_name_1' } },
  // Live Sessions
  { collection: 'livesessions', spec: { subject: 1 }, options: { name: 'subject_1' } },
  { collection: 'livesessions', spec: { class: 1 }, options: { name: 'class_1' } },
  { collection: 'livesessions', spec: { hostTeacher: 1 }, options: { name: 'hostTeacher_1' } },
  { collection: 'livesessions', spec: { scheduledStartAt: 1 }, options: { name: 'scheduledStartAt_1' } },
  { collection: 'livesessions', spec: { scheduledEndAt: 1 }, options: { name: 'scheduledEndAt_1' } },
  { collection: 'livesessions', spec: { status: 1 }, options: { name: 'status_1' } },
  { collection: 'livesessions', spec: { activeItemId: 1 }, options: { name: 'activeItemId_1' } },
  { collection: 'livesessions', spec: { class: 1, subject: 1, status: 1, scheduledStartAt: 1 }, options: { name: 'live_session_scope_status_time_1' } },
  { collection: 'livesessions', spec: { hostTeacher: 1, status: 1, scheduledStartAt: 1 }, options: { name: 'live_session_host_status_time_1' } },
  // Live Session Items
  { collection: 'livesessionitems', spec: { liveSession: 1 }, options: { name: 'liveSession_1' } },
  { collection: 'livesessionitems', spec: { type: 1 }, options: { name: 'type_1' } },
  { collection: 'livesessionitems', spec: { status: 1 }, options: { name: 'status_1' } },
  { collection: 'livesessionitems', spec: { order: 1 }, options: { name: 'order_1' } },
  { collection: 'livesessionitems', spec: { liveSession: 1, order: 1, _id: 1 }, options: { name: 'live_session_item_order_1' } },
  { collection: 'livesessionitems', spec: { liveSession: 1, status: 1, order: 1 }, options: { name: 'live_session_item_status_order_1' } },
  { collection: 'livesessionitems', spec: { liveSession: 1, tagIds: 1 }, options: { name: 'live_session_item_tags_1' } },
  // Live Session Attendance
  { collection: 'livesessionattendances', spec: { liveSession: 1 }, options: { name: 'liveSession_1' } },
  { collection: 'livesessionattendances', spec: { student: 1 }, options: { name: 'student_1' } },
  { collection: 'livesessionattendances', spec: { status: 1 }, options: { name: 'status_1' } },
  { collection: 'livesessionattendances', spec: { liveSession: 1, student: 1 }, options: { name: 'live_session_attendance_unique_1', unique: true } },
  { collection: 'livesessionattendances', spec: { student: 1, status: 1, updatedAt: -1 }, options: { name: 'live_session_attendance_student_status_1' } },
  // Live Session Responses
  { collection: 'livesessionresponses', spec: { liveSession: 1 }, options: { name: 'liveSession_1' } },
  { collection: 'livesessionresponses', spec: { item: 1 }, options: { name: 'item_1' } },
  { collection: 'livesessionresponses', spec: { student: 1 }, options: { name: 'student_1' } },
  { collection: 'livesessionresponses', spec: { itemType: 1 }, options: { name: 'itemType_1' } },
  { collection: 'livesessionresponses', spec: { item: 1, student: 1 }, options: { name: 'live_session_item_student_unique_1', unique: true } },
  { collection: 'livesessionresponses', spec: { liveSession: 1, item: 1, updatedAt: -1 }, options: { name: 'live_session_response_item_updated_1' } },
  { collection: 'livesessionresponses', spec: { student: 1, updatedAt: -1 }, options: { name: 'live_session_response_student_updated_1' } },
  // Classes / TagTypes
  { collection: 'classes', spec: { name: 1 }, options: { name: 'class_name_1' } },
  { collection: 'tagtypes', spec: { name: 1 }, options: { name: 'tagtype_name_1' } },
];

export async function ensureIndexesForTenantDbName(dbName: string) {
  const db = mongoose.connection.useDb(dbName, { useCache: false }).db;
  const res: Record<string, any> = {};

  if (!db) throw new Error('Database not available');

  for (const indexDefinition of tenantIndexDefinitions) {
    const { collection, spec, options = {} } = indexDefinition;
    res[collection] = res[collection] || [];
    res[collection].push(await db.collection(collection).createIndex(spec, options));
  }

  return res;
}

export function dbNameForSchool(key: string) {
  return `school_db_${String(key).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`;
}
