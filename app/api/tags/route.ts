export const dynamic = 'force-dynamic';
// app/api/tags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import { getTenantModels } from '@/lib/db-tenant';
import '@/models/Tag';
import '@/models/Subject';

// POST: create a tag (optionally assign to subjects)
export async function POST(req: NextRequest) {
  await connectDB();

  // Resolve tenant
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }

  // Ensure TagType is compiled on the tenant connection so populate('type') works reliably
  const { Tag: TagModel, Subject: SubjectModel, TagType: TagTypeModel } = await getTenantModels(schoolKey, ['Tag', 'Subject', 'TagType'] as const);

  const { name, type, subjectIds } = await req.json();
  try { console.debug('[api/tags] POST payload', { name, type, subjectIdsCount: Array.isArray(subjectIds) ? subjectIds.length : 0, schoolKey }); } catch {}
  if (!name || !type) {
    return NextResponse.json({ success: false, message: 'Tag name and type ID are required.' }, { status: 400 });
  }

  // First try with a transaction (Atlas / replica set). If not supported, fall back to non-transactional flow.
  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const newTag = new TagModel({ name, type });
    await newTag.save({ session });

    if (Array.isArray(subjectIds) && subjectIds.length > 0) {
      await SubjectModel.updateMany(
        { _id: { $in: subjectIds } },
        { $addToSet: { tags: newTag._id } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    const populatedTag = await TagModel.findById(newTag._id).populate('type');
    try { console.debug('[api/tags] POST created tag (txn)', { id: populatedTag?._id?.toString(), type: populatedTag?.type }); } catch {}
    return NextResponse.json({ success: true, tag: populatedTag }, { status: 201 });
  } catch (err: any) {
    if (session) {
      try { await session.abortTransaction(); } catch {}
      session.endSession();
    }

    // Fallback without transaction (useful for local dev / standalone mongod)
    try {
      const newTag = await TagModel.create({ name, type });
      if (Array.isArray(subjectIds) && subjectIds.length > 0) {
        await SubjectModel.updateMany(
          { _id: { $in: subjectIds } },
          { $addToSet: { tags: newTag._id } }
        );
      }
      const populatedTag = await TagModel.findById(newTag._id).populate('type');
      try { console.debug('[api/tags] POST created tag (fallback)', { id: populatedTag?._id?.toString(), type: populatedTag?.type }); } catch {}
      return NextResponse.json({ success: true, tag: populatedTag }, { status: 201 });
    } catch (e: any) {
      try { console.error('[api/tags] POST failed in fallback', { message: e?.message, code: e?.code, name: e?.name, stack: e?.stack }); } catch {}
      if (e?.code === 11000) {
        return NextResponse.json({ success: false, message: 'This tag name already exists for the given type.' }, { status: 409 });
      }
      return NextResponse.json({ success: false, message: e?.message || 'Server error creating tag.' }, { status: 500 });
    }
  }
}

// GET: list tags (optionally by subject)
export async function GET(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }

  // Ensure TagType is compiled for populate('type')
  const { Tag: TagModel, Subject: SubjectModel, TagType: TagTypeModel } = await getTenantModels(schoolKey, ['Tag', 'Subject', 'TagType'] as const);

  const subjectId = url.searchParams.get('subjectId');
  try {
    if (subjectId) {
      const subject = await SubjectModel.findById(subjectId).populate({
        path: 'tags',
        populate: { path: 'type' }
      }).lean();

      if (!subject) {
        return NextResponse.json({ success: false, message: 'Subject not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, tags: subject.tags });
    } else {
      const tags = await TagModel.find({}).populate('type').lean();
      try { console.debug('[api/tags] GET list', { count: Array.isArray(tags) ? tags.length : 0 }); } catch {}
      return NextResponse.json({ success: true, tags });
    }
  } catch (error: any) {
    try { console.error('[api/tags] GET error', { message: error?.message, stack: error?.stack }); } catch {}
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
