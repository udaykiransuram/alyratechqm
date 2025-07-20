// app/api/subjects/route.ts
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Subject from '@/models/Subject';
import Tag from '@/models/Tag'; // Import Tag model to validate tag IDs if provided
import mongoose from 'mongoose';

export async function GET() {
  try {
    await connectDB();
    // Populate the 'tags' field to get the actual tag documents
    const subjects = await Subject.find({}).populate('tags');
    return NextResponse.json({ success: true, subjects });
  } catch (err: any) {
    console.error('Error fetching subjects:', err);
    return NextResponse.json({ success: false, message: err.message || 'Failed to fetch subjects.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    // ADDED 'code' to destructuring
    const { name, code, description, tags } = body;

    if (!name || name.trim() === '') { // Added trim check for name
      return NextResponse.json({ success: false, message: 'Subject name is required.' }, { status: 400 });
    }

    // Check if subject name already exists (case-insensitive)
    const existingSubjectByName = await Subject.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existingSubjectByName) {
      return NextResponse.json({ success: false, message: 'A subject with this name already exists.' }, { status: 409 });
    }

    // ADDED: Check if subject code exists and is unique (if provided)
    let subjectCodeToSave = null;
    if (code !== undefined && code !== null && code.trim() !== '') {
      subjectCodeToSave = code.trim();
      const existingSubjectByCode = await Subject.findOne({ code: { $regex: new RegExp(`^${subjectCodeToSave}$`, 'i') } });
      if (existingSubjectByCode) {
        return NextResponse.json({ success: false, message: 'A subject with this code already exists.' }, { status: 409 });
      }
    }

    let validTagIds: mongoose.Types.ObjectId[] = [];
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Validate if the provided tag IDs actually exist in the Tag collection
      const foundTags = await Tag.find({ _id: { $in: tags } }) as { _id: mongoose.Types.ObjectId }[];
      if (foundTags.length !== tags.length) {
        return NextResponse.json({ success: false, message: 'One or more provided tag IDs are invalid.' }, { status: 400 });
      }
      validTagIds = foundTags.map((tag: { _id: mongoose.Types.ObjectId }) => tag._id);
    }

    const newSubject = new Subject({
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