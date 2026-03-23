import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { buildArchiveFilter, buildArchivedUpdate, resolveIncludeArchived } from '@/lib/archive';
import { recordTenantAudit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';

export const dynamic = 'force-dynamic';

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  try {
    const schoolKey = resolveSchoolKey(req);
    if (!schoolKey) {
      return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
    }
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, message: 'Invalid Subject ID' }, { status: 400 });
    }

    const includeArchived = resolveIncludeArchived(req.nextUrl);
    const { Subject } = await getTenantModels(schoolKey, ['Subject', 'Tag']);
    const subject = await Subject.findOne({ _id: id, ...buildArchiveFilter(includeArchived) })
      .populate({ path: 'tags', match: buildArchiveFilter(false) })
      .lean();

    if (!subject) {
      return NextResponse.json({ success: false, message: 'Subject not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, subject }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to fetch subject.' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  try {
    const schoolKey = resolveSchoolKey(req);
    if (!schoolKey) {
      return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
    }
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, message: 'Invalid Subject ID' }, { status: 400 });
    }

    const { Subject, Tag } = await getTenantModels(schoolKey, ['Subject', 'Tag']);
    const body = await req.json();
    const { name, code, description, tags } = body || {};

    const update: any = {};
    if (typeof name !== 'undefined') {
      const normalizedName = String(name || '').trim();
      if (!normalizedName) {
        return NextResponse.json({ success: false, message: 'Subject name cannot be empty.' }, { status: 400 });
      }
      const duplicate = await Subject.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${escapeRegex(normalizedName)}$`, 'i') },
        ...buildArchiveFilter(false),
      }).lean();
      if (duplicate) {
        return NextResponse.json({ success: false, message: 'A subject with this name already exists.' }, { status: 409 });
      }
      update.name = normalizedName;
    }

    if (typeof code !== 'undefined') {
      const normalizedCode = String(code || '').trim();
      if (normalizedCode) {
        const duplicate = await Subject.findOne({
          _id: { $ne: id },
          code: { $regex: new RegExp(`^${escapeRegex(normalizedCode)}$`, 'i') },
          ...buildArchiveFilter(false),
        }).lean();
        if (duplicate) {
          return NextResponse.json({ success: false, message: 'A subject with this code already exists.' }, { status: 409 });
        }
        update.code = normalizedCode;
      } else {
        update.$unset = { ...(update.$unset || {}), code: 1 };
      }
    }

    if (typeof description !== 'undefined') {
      update.description = description;
    }

    if (typeof tags !== 'undefined') {
      if (!Array.isArray(tags)) {
        return NextResponse.json({ success: false, message: 'Tags must be an array of tag IDs.' }, { status: 400 });
      }
      const invalidTag = tags.find((tagId: any) => !isValidObjectId(String(tagId)));
      if (invalidTag) {
        return NextResponse.json({ success: false, message: `Invalid Tag ID: ${invalidTag}` }, { status: 400 });
      }
      const foundTags = await Tag.find({
        _id: { $in: tags },
        ...buildArchiveFilter(false),
      })
        .select('_id')
        .lean();
      if (foundTags.length !== tags.length) {
        return NextResponse.json({ success: false, message: 'One or more provided tag IDs are invalid.' }, { status: 400 });
      }
      update.tags = foundTags.map((tag: any) => tag._id);
    }

    const updated = await Subject.findOneAndUpdate(
      { _id: id, ...buildArchiveFilter(false) },
      update,
      { new: true, runValidators: true },
    )
      .populate({ path: 'tags', match: buildArchiveFilter(false) })
      .lean();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Subject not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, subject: updated, message: 'Subject updated successfully.' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to update subject.' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  try {
    const schoolKey = resolveSchoolKey(req);
    if (!schoolKey) {
      return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
    }
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, message: 'Invalid Subject ID' }, { status: 400 });
    }

    const { Subject } = await getTenantModels(schoolKey, ['Subject', 'Tag']);
    const archived = await Subject.findOneAndUpdate(
      { _id: id, ...buildArchiveFilter(false) },
      buildArchivedUpdate(),
      { new: true, runValidators: true },
    );

    if (!archived) {
      return NextResponse.json({ success: false, message: 'Subject not found.' }, { status: 404 });
    }

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: 'subject',
      entityId: String(archived._id),
      entityLabel: String(archived.name || ''),
      action: 'archived',
      summary: `Archived subject ${archived.name}.`,
      details: { code: archived.code || null },
    });

    return NextResponse.json({ success: true, message: 'Subject archived successfully.' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to archive subject.' },
      { status: 500 },
    );
  }
}
