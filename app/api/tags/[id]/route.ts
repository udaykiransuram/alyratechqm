
export const dynamic = 'force-dynamic';
// app/api/tags/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import mongoose from 'mongoose';
import '@/models/Tag';
import '@/models/Subject';
import '@/models/TagType';

// Helper function to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

// GET handler: Fetch a single tag, populating its type, and include associated subjects
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });

  const { id } = params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Tag ID' }, { status: 400 });
  }

  try {
    // Ensure TagType is compiled for populate('type') on tenant connection
    const { Tag, Subject, TagType } = await getTenantModels(schoolKey, ['Tag','Subject','TagType'] as const);
    const tag = await Tag.findById(id).populate('type');

    if (!tag) {
      return NextResponse.json({ success: false, message: 'Tag not found' }, { status: 404 });
    }

    const subjects = await Subject.find({ tags: id }, 'name code');
    const associatedSubjects = subjects.map((subject: any) => ({
      _id: subject._id,
      name: subject.name,
      code: subject.code,
    }));

    try { console.debug('[api/tags/[id]] GET', { id, schoolKey, found: !!tag, subjects: associatedSubjects.length }); } catch {}
    return NextResponse.json({ success: true, tag: { ...tag.toObject(), subjects: associatedSubjects } }, { status: 200 });

  } catch (error: any) {
    try { console.error('[api/tags/[id]] GET error', { id, message: error?.message, stack: error?.stack }); } catch {}
    return NextResponse.json({ success: false, message: 'Failed to fetch tag.', error: error.message }, { status: 500 });
  }
}

// PATCH handler: Update an existing tag (expects TagType ObjectId in `type`), and update subject associations
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });

  const { id } = params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Tag ID' }, { status: 400 });
  }

  try {
    const { name, type, selectedSubjectIds = [] } = await req.json();
    try { console.debug('[api/tags/[id]] PATCH payload', { id, name, type, selectedSubjectIdsCount: Array.isArray(selectedSubjectIds) ? selectedSubjectIds.length : 0, schoolKey }); } catch {}
    if (!name || !type) {
      return NextResponse.json({ success: false, message: 'Tag name and type ID are required.' }, { status: 400 });
    }
    if (!isValidObjectId(type)) {
      return NextResponse.json({ success: false, message: 'Invalid Tag Type ID.' }, { status: 400 });
    }

    // Ensure TagType is compiled for populate('type') on tenant connection
    const { Tag, Subject, TagType } = await getTenantModels(schoolKey, ['Tag','Subject','TagType'] as const);

    const updatedTag = await Tag.findByIdAndUpdate(
      id,
      { name, type },
      { new: true, runValidators: true }
    ).populate('type');

    if (!updatedTag) {
      return NextResponse.json({ success: false, message: 'Tag not found for update.' }, { status: 404 });
    }

    await Subject.updateMany({ tags: id }, { $pull: { tags: id } });
    if (Array.isArray(selectedSubjectIds) && selectedSubjectIds.length > 0) {
      await Subject.updateMany({ _id: { $in: selectedSubjectIds } }, { $addToSet: { tags: id } });
    }

    try { console.debug('[api/tags/[id]] PATCH success', { id, type: updatedTag?.type, subjectsUpdated: Array.isArray(selectedSubjectIds) ? selectedSubjectIds.length : 0 }); } catch {}
    return NextResponse.json({ success: true, message: 'Tag and associations updated successfully.', tag: updatedTag }, { status: 200 });

  } catch (error: any) {
    try { console.error('[api/tags/[id]] PATCH error', { id, message: error?.message, code: error?.code, stack: error?.stack }); } catch {}
    if (error.code === 11000) {
      return NextResponse.json({ success: false, message: 'This tag name already exists for the selected type.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: 'Failed to update tag.', error: error.message }, { status: 500 });
  }
}

// DELETE handler: Delete a tag and remove it from subjects (tenant-aware)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });

  const { id } = params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Tag ID' }, { status: 400 });
  }

  try {
    const { Tag, Subject } = await getTenantModels(schoolKey, ['Tag','Subject']);

    const deletedTag = await Tag.findByIdAndDelete(id);
    if (!deletedTag) {
      return NextResponse.json({ success: false, message: 'Tag not found' }, { status: 404 });
    }

    await Subject.updateMany(
      { tags: id },
      { $pull: { tags: id } }
    );

    try { console.debug('[api/tags/[id]] DELETE success', { id }); } catch {}
    return NextResponse.json({ success: true, message: 'Tag deleted and removed from subjects' });
  } catch (err: any) {
    try { console.error('[api/tags/[id]] DELETE error', { id, message: err?.message, stack: err?.stack }); } catch {}
    return NextResponse.json({ success: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
