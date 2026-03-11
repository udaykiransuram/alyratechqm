import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { buildArchivedUpdate } from '@/lib/archive';
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });

  try {
    const classId = params.id;
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ success: false, message: 'Invalid class ID' }, { status: 400 });
    }

    const { Class: ClassModel } = await getTenantModels(schoolKey, ['Class']);
    const archivedClass = await ClassModel.findByIdAndUpdate(
      classId,
      buildArchivedUpdate(),
      { new: true, runValidators: true },
    );

    if (!archivedClass) {
      return NextResponse.json({ success: false, message: 'Class not found' }, { status: 404 });
    }

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: 'class',
      entityId: String(archivedClass._id),
      entityLabel: String(archivedClass.name || ''),
      action: 'archived',
      summary: `Archived class ${archivedClass.name}.`,
    });

    return NextResponse.json({ success: true, message: 'Class archived successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
