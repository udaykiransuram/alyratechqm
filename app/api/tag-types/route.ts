export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import '@/models/TagType';

// GET: Fetch all tag types
export async function GET(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });

  try {
    const { TagType: TagTypeModel } = await getTenantModels(schoolKey, ['TagType']);
    const tagTypes = await TagTypeModel.find({}).sort({ name: 1 }).lean();
    try { console.debug('[api/tag-types] GET list', { schoolKey, count: Array.isArray(tagTypes) ? tagTypes.length : 0 }); } catch {}
    return NextResponse.json({ success: true, tagTypes });
  } catch (error: any) {
    try { console.error('[api/tag-types] GET error', { schoolKey, message: error?.message, stack: error?.stack }); } catch {}
    return NextResponse.json({ success: false, message: error?.message || 'Server error fetching tag types.' }, { status: 500 });
  }
}

// POST: Create a new tag type
export async function POST(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });

  try {
    const { TagType: TagTypeModel } = await getTenantModels(schoolKey, ['TagType']);
    const { name } = await req.json();
    try { console.debug('[api/tag-types] POST payload', { schoolKey, name }); } catch {}
    if (!name) return NextResponse.json({ success: false, message: 'Tag type name is required.' }, { status: 400 });
    const newTagType = await TagTypeModel.create({ name });
    try { console.debug('[api/tag-types] POST created', { schoolKey, id: newTagType?._id?.toString(), name: newTagType?.name }); } catch {}
    return NextResponse.json({ success: true, tagType: newTagType }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ success: false, message: 'This tag type already exists.' }, { status: 409 });
    }
    try { console.error('[api/tag-types] POST error', { schoolKey, message: error?.message, code: error?.code, stack: error?.stack }); } catch {}
    return NextResponse.json({ success: false, message: error.message || 'Server error creating tag type.' }, { status: 500 });
  }
}
