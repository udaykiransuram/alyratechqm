import { NextResponse } from 'next/server';
import {connectDB} from '@/lib/db';
import Class from '@/models/Class';
import Question from '@/models/Question';
import mongoose from 'mongoose';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  await connectDB();
  try {
    const classId = params.id;
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ success: false, message: 'Invalid class ID' }, { status: 400 });
    }

    // Professional check: Prevent deletion if the class is in use
    const questionCount = await Question.countDocuments({ class: classId });
    if (questionCount > 0) {
      return NextResponse.json({ 
        success: false, 
        message: `Cannot delete class. It is currently associated with ${questionCount} question(s).` 
      }, { status: 409 });
    }

    const deletedClass = await Class.findByIdAndDelete(classId);
    if (!deletedClass) {
      return NextResponse.json({ success: false, message: 'Class not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Class deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}