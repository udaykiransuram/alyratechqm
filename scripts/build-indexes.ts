/*
  One-time admin script to create indexes explicitly in Atlas/local.
  Run: npx ts-node scripts/build-indexes.ts
*/
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('No DB connection');
  const globalDb = db;

  async function ix(col: string, spec: any, opts: any = {}) {
    const name = await globalDb.collection(col).createIndex(spec, opts);
    console.log(`[indexes] ${col}: ${name}`);
  }

  console.log('Creating global indexes...');

  // Questions
  await ix('questions', { content: 'text' }, { name: 'content_text' });
  await ix('questions', { class: 1, subject: 1, createdAt: -1 }, { name: 'class_subject_createdAt' });
  await ix('questions', { marks: 1 }, { name: 'marks_1' });

  // Summer Crash Campaigns
  await ix('summercrashcampaigns', { summerSchoolKey: 1 }, {
    name: 'summer_crash_campaign_school_key_unique',
    unique: true,
  });

  // Summer Crash Enrollments
  await ix('summercrashenrollments', { campaignId: 1 }, { name: 'campaignId_1' });
  await ix('summercrashenrollments', { summerSchoolKey: 1 }, { name: 'summerSchoolKey_1' });
  await ix('summercrashenrollments', { summerStudentId: 1 }, { name: 'summerStudentId_1' });
  await ix('summercrashenrollments', { summerId: 1 }, { name: 'summerId_1' });
  await ix('summercrashenrollments', { phoneDigits: 1 }, { name: 'phoneDigits_1' });
  await ix('summercrashenrollments', { entrySource: 1 }, { name: 'entrySource_1' });
  await ix('summercrashenrollments', { diagnosticQuestionPaperId: 1 }, { name: 'diagnosticQuestionPaperId_1' });
  await ix('summercrashenrollments', { diagnosticStatus: 1 }, { name: 'diagnosticStatus_1' });
  await ix('summercrashenrollments', { status: 1 }, { name: 'status_1' });
  await ix('summercrashenrollments', {
    campaignId: 1,
    phoneDigits: 1,
    studentNameNormalized: 1,
    classBandNormalized: 1,
  }, {
    name: 'summer_crash_enrollment_unique_student_tuple',
    unique: true,
  });
  await ix('summercrashenrollments', {
    summerSchoolKey: 1,
    phoneDigits: 1,
    status: 1,
  }, { name: 'summer_crash_enrollment_lookup_phone' });
  await ix('summercrashenrollments', {
    campaignId: 1,
    classBandNormalized: 1,
    diagnosticStatus: 1,
    updatedAt: -1,
  }, { name: 'summer_crash_enrollment_diagnostic_results' });

  // Summer Crash Payments
  await ix('summercrashpayments', { campaignId: 1 }, { name: 'campaignId_1' });
  await ix('summercrashpayments', { summerSchoolKey: 1 }, { name: 'summerSchoolKey_1' });
  await ix('summercrashpayments', { orderId: 1 }, {
    name: 'orderId_1',
    unique: true,
  });
  await ix('summercrashpayments', { phoneDigits: 1 }, { name: 'phoneDigits_1' });
  await ix('summercrashpayments', { classBandNormalized: 1 }, { name: 'classBandNormalized_1' });
  await ix('summercrashpayments', { status: 1 }, { name: 'status_1' });
  await ix('summercrashpayments', { successLookupTokenHash: 1 }, { name: 'successLookupTokenHash_1' });
  await ix('summercrashpayments', {
    campaignId: 1,
    phoneDigits: 1,
    status: 1,
  }, { name: 'summer_crash_payment_lookup_phone' });
  await ix('summercrashpayments', {
    campaignId: 1,
    phoneDigits: 1,
    classBandNormalized: 1,
    studentNameNormalized: 1,
    createdAt: -1,
  }, { name: 'summer_crash_payment_lookup_student' });
  await ix('summercrashpayments', {
    orderId: 1,
    successLookupTokenHash: 1,
  }, { name: 'summer_crash_payment_success_lookup_1' });
  await ix('summercrashpayments', {
    campaignId: 1,
    phoneDigits: 1,
    status: 1,
    createdAt: -1,
  }, { name: 'summer_crash_payment_pending_window_1' });
  await ix('summercrashpayments', {
    campaignId: 1,
    summerSchoolKey: 1,
    enrollmentId: 1,
    updatedAt: -1,
    createdAt: -1,
  }, { name: 'summer_crash_payment_enrollment_latest_1' });
  await ix('summercrashpayments', {
    campaignId: 1,
    summerSchoolKey: 1,
    summerId: 1,
    updatedAt: -1,
    createdAt: -1,
  }, { name: 'summer_crash_payment_summer_id_latest_1' });

  // Cashfree registration return and webhook lookups
  await ix('registrations', { orderId: 1 }, { name: 'orderId_1' });
  await ix('registrations', {
    orderId: 1,
    successLookupTokenHash: 1,
  }, { name: 'registration_success_lookup_1' });

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
