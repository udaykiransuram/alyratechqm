export const dynamic = 'force-dynamic';

import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { buildArchiveFilter, buildRestoreUpdate, resolveIncludeArchived } from '@/lib/archive';
import { recordTenantAudit } from '@/lib/audit';
import { requireTenantSession } from '@/lib/api-auth';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import '@/models/Subject';
import '@/models/Tag';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantSession(req, {
      allowRoles: ['admin', 'teacher'],
    });
    if (!auth.ok) {
      return auth.response;
    }
    const schoolKey = auth.schoolKey;

    await connectDB();

    const includeArchived = resolveIncludeArchived(req.nextUrl);
    const rawClassId = req.nextUrl.searchParams.get('classId')?.trim() || '';
    const classId = rawClassId === 'all' ? '' : rawClassId;

    if (classId && !mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid class ID.' },
        { status: 400 },
      );
    }

    const {
      Subject: SubjectModel,
      Question: QuestionModel,
    } = await getTenantModels(schoolKey, ['Subject', 'Tag', 'Question']);

    const subjectFilter: Record<string, any> = {
      ...buildArchiveFilter(includeArchived),
    };

    if (classId) {
      const subjectIds = await QuestionModel.distinct('subject', {
        class: classId,
        ...buildArchiveFilter(false),
      });

      if (subjectIds.length === 0) {
        return NextResponse.json({ success: true, subjects: [] });
      }

      subjectFilter._id = { $in: subjectIds };
    }

    const subjects = await SubjectModel.find(subjectFilter)
      .populate({ path: 'tags', match: buildArchiveFilter(false) })
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ success: true, subjects });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to fetch subjects.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantSession(req, {
      allowRoles: ['admin', 'teacher'],
    });
    if (!auth.ok) {
      return auth.response;
    }
    const schoolKey = auth.schoolKey;

    await connectDB();

    const { Subject: SubjectModel, Tag: TagModel } = await getTenantModels(schoolKey, ['Subject', 'Tag']);

    const body = await req.json();
    const { name, code, description, tags } = body || {};

    const nameTrimmed = typeof name === 'string' ? name.trim() : '';
    if (!nameTrimmed) {
      return NextResponse.json({ success: false, message: 'Subject name is required.' }, { status: 400 });
    }

    const codeTrimmed = typeof code === 'string' ? code.trim() : '';
    const descriptionTrimmed = typeof description === 'string' && description.trim() ? description.trim() : undefined;

    let validTagIds: mongoose.Types.ObjectId[] = [];
    if (Array.isArray(tags) && tags.length > 0) {
      const invalidTag = tags.find((tagId: any) => !mongoose.Types.ObjectId.isValid(String(tagId)));
      if (invalidTag) {
        return NextResponse.json({ success: false, message: `Invalid tag ID: ${invalidTag}` }, { status: 400 });
      }
      const foundTags = await TagModel.find({
        _id: { $in: tags },
        ...buildArchiveFilter(false),
      })
        .select('_id')
        .lean();
      if (foundTags.length !== tags.length) {
        return NextResponse.json({ success: false, message: 'One or more provided tag IDs are invalid.' }, { status: 400 });
      }
      validTagIds = foundTags.map((tag: any) => tag._id);
    }

    const nameRegex = new RegExp(`^${escapeRegex(nameTrimmed)}$`, 'i');
    const existingByName = await SubjectModel.findOne({ name: { $regex: nameRegex } });
    if (existingByName) {
      if (existingByName.isArchived) {
        const restored = await SubjectModel.findByIdAndUpdate(
          existingByName._id,
          {
            ...buildRestoreUpdate(),
            name: nameTrimmed,
            code: codeTrimmed || undefined,
            description: descriptionTrimmed,
            tags: validTagIds,
          },
          { new: true, runValidators: true },
        )
          .populate({ path: 'tags', match: buildArchiveFilter(false) })
          .lean();

        await recordTenantAudit({
          schoolKey,
          req,
          entityType: 'subject',
          entityId: String(existingByName._id),
          entityLabel: nameTrimmed,
          action: 'restored',
          summary: `Restored subject ${nameTrimmed}.`,
          details: { code: codeTrimmed || null },
        });

        return NextResponse.json({ success: true, subject: restored, existed: true }, { status: 200 });
      }
      return NextResponse.json({ success: false, message: 'A subject with this name already exists.' }, { status: 409 });
    }

    if (codeTrimmed) {
      const codeRegex = new RegExp(`^${escapeRegex(codeTrimmed)}$`, 'i');
      const existingByCode = await SubjectModel.findOne({
        code: { $regex: codeRegex },
        ...buildArchiveFilter(false),
      }).lean();
      if (existingByCode) {
        return NextResponse.json({ success: false, message: 'A subject with this code already exists.' }, { status: 409 });
      }
    }

    const newSubject = await SubjectModel.create({
      name: nameTrimmed,
      code: codeTrimmed || undefined,
      description: descriptionTrimmed,
      tags: validTagIds,
    });

    const populatedSubject = await SubjectModel.findById(newSubject._id)
      .populate({ path: 'tags', match: buildArchiveFilter(false) })
      .lean();

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: 'subject',
      entityId: String(newSubject._id),
      entityLabel: nameTrimmed,
      action: 'created',
      summary: `Created subject ${nameTrimmed}.`,
      details: { code: codeTrimmed || null },
    });

    return NextResponse.json(
      { success: true, subject: populatedSubject, message: 'Subject created successfully.' },
      { status: 201 },
    );
  } catch (err: any) {
    if (err.code === 11000) {
      const field = err.message.includes('name_1') ? 'name' : err.message.includes('code_1') ? 'code' : 'field';
      return NextResponse.json({ success: false, message: `A subject with this ${field} already exists.` }, { status: 409 });
    }
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to create subject.' },
      { status: 500 },
    );
  }
}
