export const dynamic = 'force-dynamic';

import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { buildArchiveFilter, buildRestoreUpdate, resolveIncludeArchived } from '@/lib/archive';
import { recordTenantAudit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import '@/models/Tag';
import '@/models/Subject';

function resolveSchoolKey(req: NextRequest) {
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  return (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST(req: NextRequest) {
  await connectDB();

  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }

  try {
    const { Tag: TagModel, Subject: SubjectModel } = await getTenantModels(schoolKey, ['Tag', 'Subject', 'TagType'] as const);

    const { name, type, subjectIds } = await req.json();
    const normalizedName = String(name || '').trim();
    const normalizedType = String(type || '').trim();
    const normalizedSubjectIds = normalizeIds(subjectIds);

    if (!normalizedName || !normalizedType) {
      return NextResponse.json({ success: false, message: 'Tag name and type ID are required.' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(normalizedType)) {
      return NextResponse.json({ success: false, message: 'Invalid tag type ID.' }, { status: 400 });
    }

    if (normalizedSubjectIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return NextResponse.json({ success: false, message: 'One or more subject IDs are invalid.' }, { status: 400 });
    }

    if (normalizedSubjectIds.length > 0) {
      const foundSubjects = await SubjectModel.find({
        _id: { $in: normalizedSubjectIds },
        ...buildArchiveFilter(false),
      })
        .select('_id')
        .lean();
      if (foundSubjects.length !== normalizedSubjectIds.length) {
        return NextResponse.json({ success: false, message: 'One or more subject IDs are invalid.' }, { status: 400 });
      }
    }

    const nameRegex = new RegExp(`^${escapeRegex(normalizedName)}$`, 'i');
    const existingTag = await TagModel.findOne({
      name: { $regex: nameRegex },
      type: normalizedType,
    });

    if (existingTag) {
      if (existingTag.isArchived) {
        const restored = await TagModel.findByIdAndUpdate(
          existingTag._id,
          { ...buildRestoreUpdate(), name: normalizedName, type: normalizedType },
          { new: true, runValidators: true },
        ).populate('type');

        if (normalizedSubjectIds.length > 0) {
          await SubjectModel.updateMany(
            { _id: { $in: normalizedSubjectIds } },
            { $addToSet: { tags: existingTag._id } },
          );
        }

        await recordTenantAudit({
          schoolKey,
          req,
          entityType: 'tag',
          entityId: String(existingTag._id),
          entityLabel: normalizedName,
          action: 'restored',
          summary: `Restored tag ${normalizedName}.`,
          details: {
            typeId: normalizedType,
            subjectIds: normalizedSubjectIds,
          },
        });

        return NextResponse.json({ success: true, tag: restored, existed: true }, { status: 200 });
      }

      return NextResponse.json(
        { success: false, message: 'This tag name already exists for the given type.' },
        { status: 409 },
      );
    }

    const newTag = await TagModel.create({ name: normalizedName, type: normalizedType });

    if (normalizedSubjectIds.length > 0) {
      await SubjectModel.updateMany(
        { _id: { $in: normalizedSubjectIds } },
        { $addToSet: { tags: newTag._id } },
      );
    }

    const populatedTag = await TagModel.findById(newTag._id).populate('type');

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: 'tag',
      entityId: String(newTag._id),
      entityLabel: normalizedName,
      action: 'created',
      summary: `Created tag ${normalizedName}.`,
      details: {
        typeId: normalizedType,
        subjectIds: normalizedSubjectIds,
      },
    });

    return NextResponse.json({ success: true, tag: populatedTag }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'This tag name already exists for the given type.' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, message: error?.message || 'Server error creating tag.' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }

  try {
    const includeArchived = resolveIncludeArchived(url);
    const { Tag: TagModel, Subject: SubjectModel } = await getTenantModels(schoolKey, ['Tag', 'Subject', 'TagType'] as const);

    const subjectId = url.searchParams.get('subjectId');
    if (subjectId) {
      if (!mongoose.Types.ObjectId.isValid(subjectId)) {
        return NextResponse.json({ success: false, message: 'Invalid subject ID' }, { status: 400 });
      }

      const subject = await SubjectModel.findOne({
        _id: subjectId,
        ...buildArchiveFilter(false),
      })
        .populate({
          path: 'tags',
          match: buildArchiveFilter(includeArchived),
          populate: { path: 'type' },
        })
        .lean();

      if (!subject) {
        return NextResponse.json({ success: false, message: 'Subject not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, tags: subject.tags || [] });
    }

    const tags = await TagModel.find(buildArchiveFilter(includeArchived))
      .populate('type')
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ success: true, tags });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Server error' },
      { status: 500 },
    );
  }
}
