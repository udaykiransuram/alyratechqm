export const dynamic = 'force-dynamic';

import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { buildArchiveFilter, buildArchivedUpdate, resolveIncludeArchived } from '@/lib/archive';
import { recordTenantAudit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';

function resolveSchoolKey(req: NextRequest) {
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  return (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }

  const { id } = params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Tag ID' }, { status: 400 });
  }

  try {
    const includeArchived = resolveIncludeArchived(req.nextUrl);
    const { Tag, Subject } = await getTenantModels(schoolKey, ['Tag', 'Subject', 'TagType'] as const);
    const tag = await Tag.findOne({ _id: id, ...buildArchiveFilter(includeArchived) })
      .populate('type')
      .lean();

    if (!tag) {
      return NextResponse.json({ success: false, message: 'Tag not found' }, { status: 404 });
    }

    const subjects = await Subject.find({
      tags: id,
      ...buildArchiveFilter(false),
    }, 'name code').lean();
    const associatedSubjects = subjects.map((subject: any) => ({
      _id: subject._id,
      name: subject.name,
      code: subject.code,
    }));

    return NextResponse.json({ success: true, tag: { ...tag, subjects: associatedSubjects } }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch tag.', error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }

  const { id } = params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Tag ID' }, { status: 400 });
  }

  try {
    const { name, type, selectedSubjectIds = [] } = await req.json();
    const normalizedName = String(name || '').trim();
    const normalizedType = String(type || '').trim();
    const normalizedSubjectIds = Array.isArray(selectedSubjectIds)
      ? Array.from(new Set(selectedSubjectIds.map((item: any) => String(item || '').trim()).filter(Boolean)))
      : [];

    if (!normalizedName || !normalizedType) {
      return NextResponse.json({ success: false, message: 'Tag name and type ID are required.' }, { status: 400 });
    }
    if (!isValidObjectId(normalizedType)) {
      return NextResponse.json({ success: false, message: 'Invalid Tag Type ID.' }, { status: 400 });
    }
    if (normalizedSubjectIds.some((subjectId) => !isValidObjectId(subjectId))) {
      return NextResponse.json({ success: false, message: 'One or more subject IDs are invalid.' }, { status: 400 });
    }

    const { Tag, Subject } = await getTenantModels(schoolKey, ['Tag', 'Subject', 'TagType'] as const);

    const duplicate = await Tag.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${escapeRegex(normalizedName)}$`, 'i') },
      type: normalizedType,
      ...buildArchiveFilter(false),
    }).lean();
    if (duplicate) {
      return NextResponse.json({ success: false, message: 'This tag name already exists for the selected type.' }, { status: 409 });
    }

    const updatedTag = await Tag.findOneAndUpdate(
      { _id: id, ...buildArchiveFilter(false) },
      { name: normalizedName, type: normalizedType },
      { new: true, runValidators: true },
    ).populate('type');

    if (!updatedTag) {
      return NextResponse.json({ success: false, message: 'Tag not found for update.' }, { status: 404 });
    }

    await Subject.updateMany({ tags: id }, { $pull: { tags: id } });
    if (normalizedSubjectIds.length > 0) {
      await Subject.updateMany(
        { _id: { $in: normalizedSubjectIds }, ...buildArchiveFilter(false) },
        { $addToSet: { tags: id } },
      );
    }

    return NextResponse.json(
      { success: true, message: 'Tag and associations updated successfully.', tag: updatedTag },
      { status: 200 },
    );
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ success: false, message: 'This tag name already exists for the selected type.' }, { status: 409 });
    }
    return NextResponse.json(
      { success: false, message: 'Failed to update tag.', error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }

  const { id } = params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Tag ID' }, { status: 400 });
  }

  try {
    const { Tag } = await getTenantModels(schoolKey, ['Tag', 'Subject']);

    const archivedTag = await Tag.findOneAndUpdate(
      { _id: id, ...buildArchiveFilter(false) },
      buildArchivedUpdate(),
      { new: true, runValidators: true },
    );
    if (!archivedTag) {
      return NextResponse.json({ success: false, message: 'Tag not found' }, { status: 404 });
    }

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: 'tag',
      entityId: String(archivedTag._id),
      entityLabel: String(archivedTag.name || ''),
      action: 'archived',
      summary: `Archived tag ${archivedTag.name}.`,
      details: { typeId: String(archivedTag.type || '') },
    });

    return NextResponse.json({ success: true, message: 'Tag archived successfully.' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Server error' },
      { status: 500 },
    );
  }
}
