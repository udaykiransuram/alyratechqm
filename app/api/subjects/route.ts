export const dynamic = 'force-dynamic';
// app/api/subjects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Subject from '@/models/Subject';
import Tag from '@/models/Tag'; // Import Tag model to validate tag IDs if provided
import mongoose from 'mongoose';
import { getTenantDb } from '@/lib/db-tenant'
import { getTenantModels } from '@/lib/db-tenant';
import '@/models/Subject';
import '@/models/Tag';

export async function GET(req: NextRequest) {
  try {
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


  const { Subject: SubjectModel } = await getTenantModels(schoolKey, ['Subject','Tag']);

    // Populate the 'tags' field to get the actual tag documents
    const subjects = await SubjectModel.find({}).populate('tags').lean();
    return NextResponse.json({ success: true, subjects });
  } catch (err: any) {
    console.error('Error fetching subjects:', err);
    return NextResponse.json({ success: false, message: err.message || 'Failed to fetch subjects.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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


    const { Subject: SubjectModel, Tag: TagModel } = await getTenantModels(schoolKeyPost, ['Subject','Tag']);

    const body = await req.json();
    const { name, code, description, tags } = body;

    // Check if subject name already exists (case-insensitive)
    const existingSubjectByName = await SubjectModel.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existingSubjectByName) {
      return NextResponse.json({ success: false, message: 'A subject with this name already exists.' }, { status: 409 });
    }

    // ADDED: Check if subject code exists and is unique (if provided)
    let subjectCodeToSave = null;
    if (code !== undefined && code !== null && code.trim() !== '') {
      subjectCodeToSave = code.trim();
      const existingSubjectByCode = await SubjectModel.findOne({ code: { $regex: new RegExp(`^${subjectCodeToSave}$`, 'i') } });
      if (existingSubjectByCode) {
        return NextResponse.json({ success: false, message: 'A subject with this code already exists.' }, { status: 409 });
      }
    }

    let validTagIds: mongoose.Types.ObjectId[] = [];
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Validate if the provided tag IDs actually exist in the Tag collection
      const foundTags = await TagModel.find({ _id: { $in: tags } }) as { _id: mongoose.Types.ObjectId }[];
      if (foundTags.length !== tags.length) {
        return NextResponse.json({ success: false, message: 'One or more provided tag IDs are invalid.' }, { status: 400 });
      }
      validTagIds = foundTags.map((tag: { _id: mongoose.Types.ObjectId }) => tag._id);
    }

    const newSubject = new SubjectModel({
      name: name.trim(), // Ensure name is trimmed
      code: subjectCodeToSave, // Use the validated/trimmed code
      description: description ? description.trim() : undefined, // Trim description, or set to undefined if empty
      tags: validTagIds,
    });

    await newSubject.save();
    // Populate tags after saving to return the full subject object
    await newSubject.populate('tags');

    return NextResponse.json({ success: true, subject: newSubject, message: 'Subject created successfully.' }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating subject:', err);
    if (err.code === 11000) {
      // Check which field caused the duplicate key error
      const field = err.message.includes('name_1') ? 'name' : err.message.includes('code_1') ? 'code' : 'field';
      return NextResponse.json({ success: false, message: `A subject with this ${field} already exists.` }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: err.message || 'Failed to create subject.' }, { status: 500 });
  }
}