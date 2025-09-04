import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import QuestionPaper from '@/models/QuestionPaper';
import Question from '@/models/Question';
import Subject from '@/models/Subject';
import Tag from '@/models/Tag';
import TagType from '@/models/TagType';
import Class from '@/models/Class';


export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();

  try {
    console.log('Fetching QuestionPaper with ID:', params.id);

    let paper = await QuestionPaper.findById(params.id)
      .populate('class')
      .populate('subject');

    if (!paper) {
      return NextResponse.json({ success: false, message: 'Paper not found.' }, { status: 404 });
    }

    // Deep populate questions and tags
    await paper.populate({
      path: 'sections.questions.question',
      model: 'Question',
      populate: { path: 'tags', model: 'Tag', populate: { path: 'type', model: 'TagType', select: 'name' } }
    });

    return NextResponse.json({ success: true, paper }, { status: 200 });
  } catch (error: any) {
    console.error('Server error while fetching QuestionPaper:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error.' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  await connectDB();
  const id = params.id;
  const data = await request.json();

  try {
    const updated = await QuestionPaper.findByIdAndUpdate(id, data, { new: true });
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Question paper not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, paper: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}