
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import mongoose from 'mongoose';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  try {
    const classId = params.id;
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ success: false, message: 'Invalid class ID' }, { status: 400 });
    }

    const { Class: ClassModel, Question: QuestionModel } = await getTenantModels(schoolKey, ['Class','Question']);

    const questionCount = await QuestionModel.countDocuments({ class: classId });
    if (questionCount > 0) {
      return NextResponse.json({ 
        success: false, 
        message: `Cannot delete class. It is currently associated with ${questionCount} question(s).` 
      }, { status: 409 });
    }

    const deletedClass = await ClassModel.findByIdAndDelete(classId);
    if (!deletedClass) {
      return NextResponse.json({ success: false, message: 'Class not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Class deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
