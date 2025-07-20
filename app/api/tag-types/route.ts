import { NextResponse } from 'next/server';
import {connectDB} from '@/lib/db';
import TagType from '@/models/TagType';

// GET: Fetch all tag types
export async function GET() {
  await connectDB();
  try {
    const tagTypes = await TagType.find({}).sort({ name: 1 });
    return NextResponse.json({ success: true, tagTypes });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error fetching tag types.' }, { status: 500 });
  }
}

// POST: Create a new tag type
export async function POST(request: Request) {
  await connectDB();
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ success: false, message: 'Tag type name is required.' }, { status: 400 });
    }

    const newTagType = await TagType.create({ name });
    return NextResponse.json({ success: true, tagType: newTagType }, { status: 201 });
  } catch (error: any) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json({ success: false, message: 'This tag type already exists.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message || 'Server error creating tag type.' }, { status: 500 });
  }
}