export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireTenantSession } from '@/lib/api-auth';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import mongoose from 'mongoose';
import '@/models/TagType';

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

// GET /api/tag-types/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin', 'teacher'],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: 'Invalid TagType ID' }, { status: 400 });

  try {
    const { TagType } = await getTenantModels(schoolKey, ['TagType']);
    const tagType = await TagType.findById(id).lean();
    if (!tagType) return NextResponse.json({ success: false, message: 'TagType not found' }, { status: 404 });
    try { console.debug('[api/tag-types/[id]] GET', { schoolKey, id }); } catch {}
    return NextResponse.json({ success: true, tagType });
  } catch (error: any) {
    try { console.error('[api/tag-types/[id]] GET error', { schoolKey, id, message: error?.message, stack: error?.stack }); } catch {}
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

// PATCH /api/tag-types/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin', 'teacher'],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: 'Invalid TagType ID' }, { status: 400 });

  try {
    const { TagType } = await getTenantModels(schoolKey, ['TagType']);
    const body = await req.json();
    const { name } = body as { name?: string };
    if (!name || !String(name).trim()) return NextResponse.json({ success: false, message: 'Name is required' }, { status: 400 });

    const updated = await TagType.findByIdAndUpdate(
      id,
      { name: String(name).trim().toLowerCase() },
      { new: true, runValidators: true }
    );
    if (!updated) return NextResponse.json({ success: false, message: 'TagType not found' }, { status: 404 });
    try { console.debug('[api/tag-types/[id]] PATCH', { schoolKey, id, name: updated?.name }); } catch {}
    return NextResponse.json({ success: true, tagType: updated });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ success: false, message: 'This tag type already exists.' }, { status: 409 });
    }
    try { console.error('[api/tag-types/[id]] PATCH error', { schoolKey, id, message: error?.message, code: error?.code, stack: error?.stack }); } catch {}
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

// DELETE /api/tag-types/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin', 'teacher'],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: 'Invalid TagType ID' }, { status: 400 });

  try {
    const { TagType } = await getTenantModels(schoolKey, ['TagType']);
    const deleted = await TagType.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ success: false, message: 'TagType not found' }, { status: 404 });
    try { console.debug('[api/tag-types/[id]] DELETE', { schoolKey, id }); } catch {}
    return NextResponse.json({ success: true, message: 'TagType deleted' });
  } catch (error: any) {
    try { console.error('[api/tag-types/[id]] DELETE error', { schoolKey, id, message: error?.message, stack: error?.stack }); } catch {}
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
