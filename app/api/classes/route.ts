export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import { buildArchiveFilter, buildRestoreUpdate, resolveIncludeArchived } from '@/lib/archive';
import { recordTenantAudit } from '@/lib/audit';
import { requireTenantSession } from '@/lib/api-auth';
import '@/models/Class';

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin', 'teacher'],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();
  const url = new URL(req.url);

  const { Class: ClassModel } = await getTenantModels(schoolKey, ['Class']);

  try {
    const classes = await ClassModel.find(buildArchiveFilter(resolveIncludeArchived(url)))
      .sort({ name: 1 })
      .lean();
    return NextResponse.json({ success: true, classes });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin'],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();

  const { Class: ClassModel } = await getTenantModels(schoolKey, ['Class']);

  try {
    const { name, description } = await req.json();
    const normalizedName = String(name || '').trim();
    if (!normalizedName) {
      return NextResponse.json({ success: false, message: 'Class name is required.' }, { status: 400 });
    }

    let existing = await ClassModel.findOne({ name: normalizedName });
    if (existing) {
      if (existing.isArchived) {
        existing = await ClassModel.findByIdAndUpdate(
          existing._id,
          { ...buildRestoreUpdate(), description },
          { new: true, runValidators: true },
        );
        await recordTenantAudit({
          schoolKey,
          req,
          entityType: 'class',
          entityId: String(existing?._id || ''),
          entityLabel: normalizedName,
          action: 'restored',
          summary: `Restored class ${normalizedName}.`,
          details: { description },
        });
      }
      return NextResponse.json({ success: true, class: existing, classId: existing._id }, { status: 200 });
    }

    const newClass = new ClassModel({ name: normalizedName, description });
    await newClass.save();

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: 'class',
      entityId: String(newClass._id),
      entityLabel: normalizedName,
      action: 'created',
      summary: `Created class ${normalizedName}.`,
      details: { description },
    });

    return NextResponse.json({ success: true, class: newClass, classId: newClass._id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
