import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { buildArchivedUpdate } from '@/lib/archive';
import { recordTenantAudit } from '@/lib/audit';
import { requireTenantSession } from '@/lib/api-auth';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin', 'teacher'],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();
  const { id: classId } = await params;

  try {
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
