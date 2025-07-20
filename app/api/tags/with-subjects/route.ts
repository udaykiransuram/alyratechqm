// app/api/tags/with-subjects/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {connectDB} from '@/lib/db';
import Subject from '@/models/Subject';
import Tag from '@/models/Tag'; // Make sure to import your models
import TagType from '@/models/TagType';

// --- FIX: Define the shape of your data ---

// 1. Define the shape of a populated Tag
interface PopulatedTag {
  _id: { toString(): string }; // Mongoose _id is an object with toString()
  name: string;
  type: {
    _id: string;
    name: string;
  };
  // Add any other properties your Tag model has
}

// 2. Define the shape of a Subject with its tags populated
interface SubjectWithPopulatedTags {
  name: string;
  code: string;
  class: string; // Or a Class interface if it's also populated
  tags: PopulatedTag[];
}

// Define the GET handler for the API route
export async function GET(req: NextRequest) {
  await connectDB();

  try {
    // 1. Get all tags with their type populated
    const tags = await Tag.find({}).populate('type').lean();

    // 2. Get all subjects that reference any tag
    const tagIds = tags.map(tag => tag._id);
    const subjects = await Subject.find({ tags: { $in: tagIds } })
      .select('name code tags class')
      .lean();

    // 3. Map subjects to their tags
    const tagIdToSubjects: Record<string, any[]> = {};
    subjects.forEach(subject => {
      subject.tags.forEach((tagId: any) => {
        const id = tagId.toString();
        if (!tagIdToSubjects[id]) tagIdToSubjects[id] = [];
        tagIdToSubjects[id].push({
          _id: subject._id,
          name: subject.name,
          code: subject.code,
        });
      });
    });

    // 4. Attach subjects to each tag
    const tagsWithSubjects = tags.map(tag => ({
      ...tag,
      subjects: tagIdToSubjects[tag._id.toString()] || [],
    }));

    return NextResponse.json({ success: true, tags: tagsWithSubjects });
  } catch (error: any) {
    console.error('Error fetching tags with subjects:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

// Define the shape of a tag object received in the POST request
interface RequestTag {
  _id: { toString(): string };
  // Add other properties if they exist and are used
}

// ... inside your async route handler function
export async function POST(request: Request) {
  const body = await request.json();

  // --- FIX: Assert the type of the incoming array ---
  // Tell TypeScript that 'body.tags' is an array of 'RequestTag' objects.
  const tags = body.tags as RequestTag[];

  // Now, TypeScript knows the shape of 'tag' inside the loop, and the error is gone.
  const tagIds = tags.map(tag => tag._id.toString());

  // ... rest of your logic
}