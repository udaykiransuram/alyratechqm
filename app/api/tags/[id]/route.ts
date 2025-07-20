// app/api/tags/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db';
import Tag from '../../../../models/Tag';
import Subject, { ISubject } from '../../../../models/Subject'; // Import ISubject for typing
import mongoose, { UpdateQuery } from 'mongoose'; // Import mongoose and UpdateQuery
import TagType from '../../../../models/TagType'; // Import the TagType model

// Helper function to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

// GET handler: Fetch a single tag, now populating its type
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const { id } = params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Tag ID' }, { status: 400 });
  }

  try {
    // Populate the 'type' field to get the full TagType object
    const tag = await Tag.findById(id).populate('type');

    if (!tag) {
      return NextResponse.json({ success: false, message: 'Tag not found' }, { status: 404 });
    }

    // This logic for finding associated subjects is correct and can remain
    const subjects = await Subject.find({ tags: id }, 'name code');
    const associatedSubjects = subjects.map(subject => ({
      _id: subject._id,
      name: subject.name,
      code: (subject as any).code,
    }));

    return NextResponse.json({ success: true, tag: { ...tag.toObject(), subjects: associatedSubjects } }, { status: 200 });

  } catch (error: any) {
    console.error(`Error fetching tag ${id}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to fetch tag.', error: error.message }, { status: 500 });
  }
}

// PATCH handler: Update an existing tag, expecting a type ID
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const { id } = params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Tag ID' }, { status: 400 });
  }

  try {
    // 'type' is now expected to be the ObjectId of the TagType
    const { name, type, selectedSubjectIds = [] } = await req.json();

    if (!name || !type) {
      return NextResponse.json({ success: false, message: 'Tag name and type ID are required.' }, { status: 400 });
    }
    if (!isValidObjectId(type)) {
      return NextResponse.json({ success: false, message: 'Invalid Tag Type ID.' }, { status: 400 });
    }

    // 1. Update the Tag document itself
    const updatedTag = await Tag.findByIdAndUpdate(
      id,
      { name, type }, // The 'type' field is updated with the new ObjectId
      { new: true, runValidators: true }
    ).populate('type'); // Populate the type for the response

    if (!updatedTag) {
      return NextResponse.json({ success: false, message: 'Tag not found for update.' }, { status: 404 });
    }

    // 2. Update Subject associations (this logic is correct and can remain)
    await Subject.updateMany({ tags: id }, { $pull: { tags: id } });
    if (selectedSubjectIds.length > 0) {
      await Subject.updateMany({ _id: { $in: selectedSubjectIds } }, { $addToSet: { tags: id } });
    }

    return NextResponse.json({ success: true, message: 'Tag and associations updated successfully.', tag: updatedTag }, { status: 200 });

  } catch (error: any) {
    console.error(`Error updating tag ${id}:`, error);
    if (error.code === 11000) {
        return NextResponse.json({ success: false, message: 'This tag name already exists for the selected type.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: 'Failed to update tag.', error: error.message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();

    const deletedTag = await Tag.findByIdAndDelete(params.id);
    if (!deletedTag) {
      return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
    }

    // Remove tag from all subjects that reference it
    await Subject.updateMany(
      { tags: params.id },
      { $pull: { tags: params.id } }
    );

    return NextResponse.json({ success: true, message: 'Tag deleted and removed from subjects' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}