
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import mongoose from 'mongoose';

function resolveSchoolKey(req: NextRequest){
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  return schoolKey;
}

// UPDATE a question by ID (supports all types)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });

  const { Question: QuestionModel } = await getTenantModels(schoolKey, ['Question','Tag','TagType','Class','Subject']);

  try {
    const body = await req.json();
    const {
      subject,
      class: classId,
      tags,
      content,
      options,
      answerIndexes,
      explanation,
      marks,
      type,
      matrixOptions,
      matrixAnswers
    } = body;

    if (!subject || !classId || !content || !marks || !type) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: subject, class, content, type, and marks are required.' },
        { status: 400 }
      );
    }

    if (type === 'single' || type === 'multiple') {
      if (!options || options.length < 2 || !Array.isArray(answerIndexes) || answerIndexes.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Options and at least one correct answer are required for single/multiple choice questions.' },
          { status: 400 }
        );
      }
      if (answerIndexes.some((idx: number) => idx < 0 || idx >= options.length)) {
        return NextResponse.json(
          { success: false, message: 'One or more selected answer indexes are invalid.' },
          { status: 400 }
        );
      }
    }

    const question = await QuestionModel.findById(params.id);
    if (!question) {
      return NextResponse.json({ success: false, message: 'Question not found.' }, { status: 404 });
    }

    question.subject = subject;
    question.class = classId;
    question.tags = tags;
    question.content = content;
    question.explanation = explanation;
    question.marks = marks;
    question.type = type;

    if (type === 'single' || type === 'multiple') {
      question.options = options;
      question.answerIndexes = answerIndexes;
      question.matrixOptions = undefined;
      question.matrixAnswers = undefined;
    } else if (type === 'matrix-match') {
      question.matrixOptions = matrixOptions;
      question.matrixAnswers = matrixAnswers;
      question.options = undefined;
      question.answerIndexes = undefined;
    } else {
      question.options = undefined;
      question.answerIndexes = undefined;
      question.matrixOptions = undefined;
      question.matrixAnswers = undefined;
    }

    await question.save();

    const updatedQuestion = await QuestionModel.findById(params.id)
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate({ path: 'tags', populate: { path: 'type', select: 'name' } });

    return NextResponse.json({ success: true, question: updatedQuestion });
  } catch (error: any) {
    if (error?.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => (err as any).message);
      return NextResponse.json({ success: false, message: messages.join(', ') }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, message: 'An unexpected server error occurred.', error: (error as any)?.message },
      { status: 500 }
    );
  }
}

// DELETE a question by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  const { Question: QuestionModel } = await getTenantModels(schoolKey, ['Question']);

  try {
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ success: false, message: 'Invalid question ID' }, { status: 400 });
    }

    const deletedQuestion = await QuestionModel.findByIdAndDelete(params.id);
    if (!deletedQuestion) {
      return NextResponse.json({ success: false, message: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Question deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

// PATCH - Update a question (supports all types)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  const { Question: QuestionModel } = await getTenantModels(schoolKey, ['Question']);

  try {
    const body = await req.json();
    const {
      subject,
      class: classId,
      tags,
      content,
      options,
      answerIndexes,
      explanation,
      marks,
      type,
      matrixOptions,
      matrixAnswers
    } = body;

    if (!subject || !classId || !content || !marks || !type) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: subject, class, content, and marks are required.' },
        { status: 400 }
      );
    }

    let update: any = {
      subject, class: classId, tags, content, explanation, marks, type
    };

    if (type === 'single' || type === 'multiple') {
      if (!options || options.length < 2 || !Array.isArray(answerIndexes) || answerIndexes.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Options and at least one correct answer are required for single/multiple choice questions.' },
          { status: 400 }
        );
      }
      if (answerIndexes.some((idx: number) => idx < 0 || idx >= options.length)) {
        return NextResponse.json(
          { success: false, message: 'One or more selected answer indexes are invalid.' },
          { status: 400 }
        );
      }
      update.options = options;
      update.answerIndexes = answerIndexes;
      update.matrixOptions = undefined;
      update.matrixAnswers = undefined;
    } else if (type === 'matrix-match') {
      if (!matrixOptions || !Array.isArray(matrixOptions) || matrixOptions.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Matrix match questions require at least one pair.' },
          { status: 400 }
        );
      }
      update.matrixOptions = matrixOptions;
      update.matrixAnswers = matrixAnswers;
      update.options = undefined;
      update.answerIndexes = undefined;
    } else {
      update.options = undefined;
      update.answerIndexes = undefined;
      update.matrixOptions = undefined;
      update.matrixAnswers = undefined;
    }

    const updatedQuestion = await QuestionModel.findByIdAndUpdate(
      params.id,
      update,
      { new: true, runValidators: true }
    )
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate({ path: 'tags', populate: { path: 'type', select: 'name' } });

    if (!updatedQuestion) {
      return NextResponse.json({ success: false, message: 'Question not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, question: updatedQuestion });
  } catch (error: any) {
    if (error?.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => (err as any).message);
      return NextResponse.json({ success: false, message: messages.join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  const { Question: QuestionModel } = await getTenantModels(schoolKey, ['Question']);
  try {
    const question = await QuestionModel.findById(params.id)
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate({ path: 'tags', populate: { path: 'type', select: 'name' } });

    if (!question) {
      return NextResponse.json({ success: false, message: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, question });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
