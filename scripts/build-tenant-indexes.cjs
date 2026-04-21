const mongoose = require('mongoose');
const dotenv = require('dotenv');
const CONNECT_OPTIONS = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 20000,
  family: 4,
};

// Load .env.local if present, else fallback to .env
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

function sanitizeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

async function ensureIndexesForTenant(dbName) {
  const db = mongoose.connection.useDb(dbName, { useCache: false }).db;
  const res = {};
  async function ix(col, spec, opts = {}) {
    try {
      res[col] = res[col] || [];
      const name = await db.collection(col).createIndex(spec, opts);
      res[col].push(name);
    } catch (e) {
      res[col] = res[col] || [];
      res[col].push('ERR: ' + e.message);
    }
  }
  const activeStudentRollPartialFilter = {
    role: 'student',
    rollNumber: { $type: 'string', $gt: '' },
    $or: [{ isArchived: false }, { isArchived: { $exists: false } }],
  };

  // Questions
  await ix('questions', { content: 'text' }, { name: 'content_text' });
  await ix('questions', { tags: 1 }, { name: 'question_tags_1' });
  await ix('questions', { class: 1, subject: 1, createdAt: -1 }, { name: 'class_subject_createdAt' });
  await ix('questions', { marks: 1 }, { name: 'marks_1' });

  // Question Papers
  await ix('questionpapers', { createdAt: -1 }, { name: 'qp_createdAt_desc' });
  await ix('questionpapers', { class: 1, subject: 1, createdAt: -1 }, { name: 'qp_class_subject_createdAt' });

  // Question Paper Responses
  await ix('questionpaperresponses', { paper: 1 }, { name: 'qpr_paper_1' });
  await ix('questionpaperresponses', { student: 1 }, { name: 'qpr_student_1' });
  await ix('questionpaperresponses', { paper: 1, student: 1 }, { name: 'qpr_paper_student_1' });
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
  await ix('subjects', { tags: 1 }, { name: 'subject_tags_1' });
  await ix('subjects', { code: 1 }, { name: 'subject_code_1' });

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
  await ix('users', { role: 1, class: 1 }, { name: 'user_role_class_1' });
  await ix('users', { class: 1, rollNumber: 1 }, { name: 'user_class_roll_1' });
  await ix('users', { class: 1, academicSection: 1, rollNumber: 1 }, { name: 'user_class_section_roll_1' });
  await ix('users', { email: 1 }, { name: 'user_email_1' });

  // Classes / TagTypes
  await ix('classes', { name: 1 }, { name: 'class_name_1' });
  await ix('tagtypes', { name: 1 }, { name: 'tagtype_name_1' });

  return res;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI env var is required');
  await mongoose.connect(uri, CONNECT_OPTIONS);
  const globalDb = mongoose.connection.db;
  if (!globalDb) throw new Error('No DB connection');

  const schools = await globalDb.collection('schools').find({}).toArray();
  const results = {};
  for (const s of schools) {
    const key = s.key || String(s._id || '');
    const dbName = 'school_db_' + sanitizeKey(key);
    results[key] = await ensureIndexesForTenant(dbName);
    console.log('[indexes] ensured for tenant', key);
  }
  await mongoose.disconnect();
  console.log('Done building tenant indexes');
}

function formatReachabilityMessage(err) {
  const selectionError =
    err?.name === 'MongooseServerSelectionError' ||
    err?.name === 'MongoServerSelectionError';

  if (!selectionError) {
    return null;
  }

  const topologyType = err?.reason?.type || err?.cause?.type;
  if (topologyType === 'ReplicaSetNoPrimary') {
    return 'Skipping tenant index build because MongoDB Atlas did not expose a primary. This is usually a transient network, VPN, or Atlas IP allowlist issue.';
  }

  return `Skipping tenant index build because MongoDB was unreachable during predev startup${topologyType ? ` (${topologyType})` : ''}.`;
}

main().catch((err) => {
  const reachabilityMessage = formatReachabilityMessage(err);
  if (reachabilityMessage) {
    console.warn(`[predev] ${reachabilityMessage}`);
    process.exit(0);
  }

  console.error(err);
  process.exit(1);
});
