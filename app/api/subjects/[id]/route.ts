
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import mongoose from 'mongoose';

const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

async function resolveTenant(req: NextRequest) {
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) throw new Error('schoolKey required');
  return schoolKey;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  try {
    const schoolKey = await resolveTenant(req);
    const { id } = params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: 'Invalid Subject ID' }, { status: 400 });
    const { Subject } = await getTenantModels(schoolKey, ['Subject','Tag']);
    const subject = await Subject.findById(id).populate('tags');
    if (!subject) return NextResponse.json({ success: false, message: 'Subject not found.' }, { status: 404 });
    return NextResponse.json({ success: true, subject: subject.toObject() }, { status: 200 });
  } catch (err: any) {
    if (err.message === 'schoolKey required') return NextResponse.json({ success: false, message: err.message }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message || 'Failed to fetch subject.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  try {
    const schoolKey = await resolveTenant(req);
    const { id } = params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: 'Invalid Subject ID' }, { status: 400 });
    const { Subject } = await getTenantModels(schoolKey, ['Subject','Tag']);

    const body = await req.json();
    const { name, code, description, tags } = body;

    // Build update object with basic validations
    const update: any = {};
    if (typeof name !== 'undefined') {
      if (!name || !String(name).trim()) return NextResponse.json({ success: false, message: 'Subject name cannot be empty.' }, { status: 400 });
      // Uniqueness check
      const dup = await Subject.findOne({ name: { $regex: new RegExp(`^${String(name).trim()}$`, 'i') }, _id: { $ne: id } });
      if (dup) return NextResponse.json({ success: false, message: 'A subject with this name already exists.' }, { status: 409 });
      update.name = String(name).trim();
    }
    if (typeof code !== 'undefined') {
      if (code && String(code).trim()) {
        const dup = await Subject.findOne({ code: { $regex: new RegExp(`^${String(code).trim()}$`, 'i') }, _id: { $ne: id } });
        if (dup) return NextResponse.json({ success: false, message: 'A subject with this code already exists.' }, { status: 409 });
        update.code = String(code).trim();
      } else {
        update.$unset = { ...(update.$unset || {}), code: 1 };
      }
    }
    if (typeof description !== 'undefined') update.description = description;
    if (typeof tags !== 'undefined') {
      if (!Array.isArray(tags)) return NextResponse.json({ success: false, message: 'Tags must be an array of tag IDs.' }, { status: 400 });
      const validIds: mongoose.Types.ObjectId[] = [];
      for (const t of tags) {
        if (!isValidObjectId(String(t))) return NextResponse.json({ success: false, message: `Invalid Tag ID: ${t}` }, { status: 400 });
        validIds.push(new mongoose.Types.ObjectId(String(t)));
      }
      update.tags = validIds;
    }

    const updated = await Subject.findByIdAndUpdate(id, update, { new: true, runValidators: true }).populate('tags');
    if (!updated) return NextResponse.json({ success: false, message: 'Subject not found.' }, { status: 404 });
    return NextResponse.json({ success: true, subject: updated.toObject(), message: 'Subject updated successfully.' });
  } catch (err: any) {
    if (err.message === 'schoolKey required') return NextResponse.json({ success: false, message: err.message }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message || 'Failed to update subject.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  try {
    const schoolKey = await resolveTenant(req);
    const { id } = params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: 'Invalid Subject ID' }, { status: 400 });
    const { Subject } = await getTenantModels(schoolKey, ['Subject','Tag']);

    const deleted = await Subject.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ success: false, message: 'Subject not found.' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Subject deleted successfully.' }, { status: 200 });
  } catch (err: any) {
    if (err.message === 'schoolKey required') return NextResponse.json({ success: false, message: err.message }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message || 'Failed to delete subject.' }, { status: 500 });
  }
}
