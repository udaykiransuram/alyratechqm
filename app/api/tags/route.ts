// app/api/tags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {connectDB} from '@/lib/db';
import Tag from '@/models/Tag';
import Subject from '@/models/Subject'; // --- 1. IMPORT Subject ---
import mongoose from 'mongoose';

// ... (The GET function can remain for now, but it's less useful.
// You will likely fetch tags via the subject they belong to.)

export async function POST(request: Request) {
  await connectDB();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, type, subjectIds } = await request.json();
    if (!name || !type || !Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json({ success: false, message: 'Tag name, type ID, and at least one subject ID are required.' }, { status: 400 });
    }

    const newTag = new Tag({ name, type });
    await newTag.save({ session });

    // Add the tag to all selected subjects
    await Subject.updateMany(
      { _id: { $in: subjectIds } },
      { $addToSet: { tags: newTag._id } },
      { session }
    );

    await session.commitTransaction();

    const populatedTag = await Tag.findById(newTag._id).populate('type');
    return NextResponse.json({ success: true, tag: populatedTag }, { status: 201 });
  } catch (error: any) {
    await session.abortTransaction();
    if (error.code === 11000) {
      return NextResponse.json({ success: false, message: 'This tag name already exists for the given type.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message || 'Server error creating tag.' }, { status: 500 });
  } finally {
    session.endSession();
  }
}

export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subjectId');

  try {
    if (subjectId) {
      // Fetch tags for a specific subject
      const subject = await Subject.findById(subjectId).populate({
        path: 'tags',
        populate: { path: 'type' }
      }).lean();

      if (!subject) {
        return NextResponse.json({ success: false, message: 'Subject not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, tags: subject.tags });
    } else {
      // Fetch all tags
      const tags = await Tag.find({}).populate('type').lean();
      return NextResponse.json({ success: true, tags });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

