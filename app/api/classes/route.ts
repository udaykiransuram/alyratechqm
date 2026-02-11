export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {connectDB} from '@/lib/db';
import Class from '@/models/Class';
import { getTenantDb } from '@/lib/db-tenant'
import { getTenantModels } from '@/lib/db-tenant';
import '@/models/Class';

export async function GET(req: NextRequest) {
  await connectDB();
  // Tenant resolution: header -> query -> cookie
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey || !schoolKey.toString().trim()) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }


  const { Class: ClassModel } = await getTenantModels(schoolKey, ['Class']);

  try {
    const classes = await ClassModel.find({}).sort({ name: 1 }).lean();
    return NextResponse.json({ success: true, classes });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await connectDB();
  // Tenant resolution: header -> query -> cookie
  const urlPost = new URL(req.url);
  const schoolFromHeaderPost = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQueryPost = urlPost.searchParams.get('school');
  const schoolFromCookiePost = req.cookies?.get?.('schoolKey')?.value;
  const schoolKeyPost = (schoolFromHeaderPost || schoolFromQueryPost || schoolFromCookiePost || '').toString().trim();
  if (!schoolKeyPost || !schoolKeyPost.toString().trim()) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }


  const { Class: ClassModel } = await getTenantModels(schoolKeyPost, ['Class']);

  try {
    const { name, description } = await req.json();
    if (!name) {
      return NextResponse.json({ success: false, message: 'Class name is required.' }, { status: 400 });
    }
    // Check if class already exists
    let existing = await ClassModel.findOne({ name });
    if (existing) {
      return NextResponse.json({ success: true, class: existing, classId: existing._id }, { status: 200 });
    }
    // Create new class
    const newClass = new ClassModel({ name, description });
    await newClass.save();
    return NextResponse.json({ success: true, class: newClass, classId: newClass._id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}