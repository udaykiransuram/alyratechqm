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
  const col = db.collection('questions');
  console.log('Creating indexes on questions...');
  const res1 = await col.createIndex({ content: 'text' }, { name: 'content_text' });
  console.log('Index:', res1);
  const res2 = await col.createIndex({ class: 1, subject: 1, createdAt: -1 }, { name: 'class_subject_createdAt' });
  console.log('Index:', res2);
  const res3 = await col.createIndex({ marks: 1 }, { name: 'marks_1' });
  console.log('Index:', res3);
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
