import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// --- FORCE MODEL REGISTRATION ---
// By importing all models here, we ensure they are registered with Mongoose
// before any of them are used in a query. This is the most robust way
// to prevent "MissingSchemaError" in a Next.js development environment.
import Question from '@/models/Question';
import Class from '@/models/Class';
import Subject from '@/models/Subject';
import Tag from '@/models/Tag';
import User from '@/models/User';
import QuestionPaper from '@/models/QuestionPaper';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();

  try {
    console.log('Fetching QuestionPaper with ID:', params.id);

    const paper = await QuestionPaper.findById(params.id)
      .populate({
        path: 'sections.questions.question',
        // Also populate the nested 'tags' within each question
        populate: { path: 'tags' }
      })
      .populate('class')
      .populate('subject');

    if (!paper) {
      console.warn('No QuestionPaper found for ID:', params.id);
      return NextResponse.json({ success: false, message: 'Paper not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, paper }, { status: 200 });
  } catch (error: any) {
    console.error('Server error while fetching QuestionPaper:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error.' }, { status: 500 });
  }
}