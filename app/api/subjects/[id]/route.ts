// app/api/subjects/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'; // Use NextRequest/NextResponse for App Router
import { connectDB } from '@/lib/db';
import Subject, { ISubject } from '@/models/Subject'; // Import ISubject for typing
import Tag from '@/models/Tag';
import mongoose, { UpdateQuery } from 'mongoose'; // Import mongoose and UpdateQuery

// Helper function to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

// GET handler: Fetch a single subject by ID
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const { id } = params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Subject ID' }, { status: 400 });
  }

  try {
    // Fetch the subject by ID. Populate the 'tags' field to get full tag objects.
    // Explicitly type the populated 'tags' to be an array of ITag documents (or plain objects if .lean() was used)
    const subject = await Subject.findById(id).populate<{ tags: ISubject['tags'] }>('tags');

    if (!subject) {
      return NextResponse.json({ success: false, message: 'Subject not found.' }, { status: 404 });
    }

    // Convert to plain object for the response, ensuring populated tags are included
    return NextResponse.json({ success: true, subject: subject.toObject() }, { status: 200 });
  } catch (err: any) {
    console.error(`Error fetching subject with ID ${params.id}:`, err);
    return NextResponse.json({ success: false, message: err.message || 'Failed to fetch subject.' }, { status: 500 });
  }
}

// PATCH handler: Update a single subject by ID
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const { id } = params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Subject ID' }, { status: 400 });
  }

  try {
    const body = await req.json();
    // Destructure all potential update fields, including 'code'
    const { name, code, description, tags } = body;

    // Use UpdateQuery to build the update object safely
    const updateFields: UpdateQuery<ISubject> = {};

    // Handle 'name' update and duplicate check
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json({ success: false, message: 'Subject name cannot be empty.' }, { status: 400 });
      }
      const existingSubject = await Subject.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, _id: { $ne: id } });
      if (existingSubject) {
        return NextResponse.json({ success: false, message: 'A subject with this name already exists.' }, { status: 409 });
      }
      updateFields.name = name.trim();
    }

    // Handle 'code' update
    // If 'code' is explicitly provided in the body (even as null or empty string)
    if (code !== undefined) {
      if (typeof code === 'string' && code.trim() !== '') {
        // Check for duplicate code if code is being updated
        const existingSubjectWithCode = await Subject.findOne({ code: { $regex: new RegExp(`^${code.trim()}$`, 'i') }, _id: { $ne: id } });
        if (existingSubjectWithCode) {
          return NextResponse.json({ success: false, message: 'A subject with this code already exists.' }, { status: 409 });
        }
        updateFields.code = code.trim();
      } else if (code === null || (typeof code === 'string' && code.trim() === '')) {
        // If code is explicitly null or an empty string, unset it
        updateFields.$unset = { code: 1 };
      }
      // If code is undefined in the payload, it's simply not updated.
    }

    // Handle 'description' update
    if (description !== undefined) {
      updateFields.description = description; // Allows setting to null/empty string
    }

    // Handle 'tags' update
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return NextResponse.json({ success: false, message: 'Tags must be an array of tag IDs.' }, { status: 400 });
      }
      const validTagObjectIds: mongoose.Types.ObjectId[] = [];
      if (tags.length > 0) {
        for (const tagId of tags) {
          if (!isValidObjectId(tagId)) {
            return NextResponse.json({ success: false, message: `Invalid Tag ID found: ${tagId}` }, { status: 400 });
          }
          validTagObjectIds.push(new mongoose.Types.ObjectId(tagId));
        }
      }
      updateFields.tags = validTagObjectIds; // Store only the validated ObjectIds
    }

    // Perform the update
    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      updateFields, // Pass the constructed UpdateQuery object
      { new: true, runValidators: true } // Return the updated document and run schema validators
    ).populate<{ tags: ISubject['tags'] }>('tags'); // Re-populate tags for the response

    if (!updatedSubject) {
      return NextResponse.json({ success: false, message: 'Subject not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, subject: updatedSubject.toObject(), message: 'Subject updated successfully.' });
  } catch (err: any) {
    console.error(`Error updating subject with ID ${params.id}:`, err);
    // Handle potential duplicate key errors (e.g., if new name or code already exists)
    if (err.code === 11000) {
        const field = err.message.includes('name_1') ? 'name' : err.message.includes('code_1') ? 'code' : 'field';
        return NextResponse.json(
            { success: false, message: `Duplicate ${field}: A subject with this ${field} already exists.` },
            { status: 409 } // Conflict
        );
    }
    return NextResponse.json({ success: false, message: err.message || 'Failed to update subject.' }, { status: 500 });
  }
}

// DELETE handler: Delete a single subject by ID
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const { id } = params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid Subject ID' }, { status: 400 });
  }

  try {
    const deletedSubject = await Subject.findByIdAndDelete(id);

    if (!deletedSubject) {
      return NextResponse.json({ success: false, message: 'Subject not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Subject deleted successfully.' }, { status: 200 });
  } catch (err: any) {
    console.error(`Error deleting subject with ID ${params.id}:`, err);
    return NextResponse.json({ success: false, message: err.message || 'Failed to delete subject.' }, { status: 500 });
  }
}