import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Question from '@/models/Question';
import Class from '@/models/Class';
import Subject from '@/models/Subject';
import Tag from '@/models/Tag';
import TagType from '@/models/TagType';

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);

  const query: any = {};

  // Filter by class
  const classId = searchParams.get('class');
  if (classId) query.class = classId;

  // Filter by subject
  const subjectId = searchParams.get('subject');
  if (subjectId) query.subject = subjectId;

  // Filter by tags (comma-separated)
  const tags = searchParams.get('tags');
  if (tags) query.tags = { $in: tags.split(',') };

  // Filter by marks
  const marks = searchParams.get('marks');
  if (marks) query.marks = Number(marks);

  // Search by content
  const search = searchParams.get('search');
  if (search) query.content = { $regex: search, $options: 'i' };

  const questions = await Question.find(query)
    .populate('subject', 'name')
    .populate('class', 'name')
    .populate({
      path: 'tags',
      populate: { path: 'type', select: 'name' }
    });

  return NextResponse.json({ success: true, questions });
}

// POST a new question (multiple correct answers)
export async function POST(request: Request) {
  await connectDB();

  try {
    const body = await request.json();
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

    console.log('POST /api/questions: request body =', body);

    // --- Server-Side Validation ---
    if (!subject || !classId || !content || !marks) {
      console.warn('POST /api/questions: Missing required fields');
      return NextResponse.json(
        { success: false, message: 'Missing required fields: subject, class, content, and marks are required.' },
        { status: 400 }
      );
    }

    if (type === 'matrix-match') {
      if (!matrixOptions || !Array.isArray(matrixOptions) || matrixOptions.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Matrix match questions require at least one option.' },
          { status: 400 }
        );
      }

      // New validation: at least one of left/right must be present in each option
      const hasValidOption = matrixOptions.some(opt => (opt.left && opt.left.trim()) || (opt.right && opt.right.trim()));
      if (!hasValidOption) {
        return NextResponse.json(
          { success: false, message: 'Matrix match options must have at least one non-empty left or right value.' },
          { status: 400 }
        );
      }

      // Optionally, filter out completely empty options before saving
      const filteredMatrixOptions = matrixOptions.filter(opt => (opt.left && opt.left.trim()) || (opt.right && opt.right.trim()));

      const newQuestion = new Question({
        subject,
        class: classId,
        tags,
        content,
        matrixOptions: filteredMatrixOptions,
        matrixAnswers,
        explanation,
        marks,
        type,
      });

      await newQuestion.save();

      const createdQuestion = await Question.findById(newQuestion._id)
        .populate('subject', 'name')
        .populate('class', 'name')
        .populate({
          path: 'tags',
          model: 'Tag',
          populate: {
            path: 'type',
            model: 'TagType',
            select: 'name'
          }
        });

      return NextResponse.json({ success: true, question: createdQuestion }, { status: 201 });
    } else {
      const newQuestion = new Question({
        subject,
        class: classId,
        tags,
        content,
        options,
        answerIndexes,
        explanation,
        marks,
        type,
      });

      await newQuestion.save();

      const createdQuestion = await Question.findById(newQuestion._id)
        .populate('subject', 'name')
        .populate('class', 'name')
        .populate({
          path: 'tags',
          model: 'Tag',
          populate: {
            path: 'type',
            model: 'TagType',
            select: 'name'
          }
        });

      return NextResponse.json({ success: true, question: createdQuestion }, { status: 201 });
    }
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      console.error('POST /api/questions: ValidationError', messages);
      return NextResponse.json({ success: false, message: messages.join(', ') }, { status: 400 });
    }
    console.error('POST /api/questions: Error creating question:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected server error occurred.', error: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update an existing question (multiple correct answers and matrix match)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await connectDB();

  try {
    const body = await request.json();
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

    // --- Server-Side Validation ---
    if (!subject || !content || !marks) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: subject, content, and marks are required.' },
        { status: 400 }
      );
    }

    if (type === 'matrix-match') {
      if (!matrixOptions || !Array.isArray(matrixOptions) || matrixOptions.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Matrix match questions require at least one option.' },
          { status: 400 }
        );
      }

      // New validation: at least one of left/right must be present in each option
      const hasValidOption = matrixOptions.some(opt => (opt.left && opt.left.trim()) || (opt.right && opt.right.trim()));
      if (!hasValidOption) {
        return NextResponse.json(
          { success: false, message: 'Matrix match options must have at least one non-empty left or right value.' },
          { status: 400 }
        );
      }

      // Optionally, filter out completely empty options before saving
      const filteredMatrixOptions = matrixOptions.filter(opt => (opt.left && opt.left.trim()) || (opt.right && opt.right.trim()));

      const updatedQuestion = await Question.findByIdAndUpdate(
        params.id,
        { subject, class: classId, tags, content, matrixOptions: filteredMatrixOptions, matrixAnswers, explanation, marks, type },
        { new: true, runValidators: true }
      )
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate({
        path: 'tags',
        model: 'Tag',
        populate: {
          path: 'type',
          model: 'TagType',
          select: 'name'
        }
      });

      if (!updatedQuestion) {
        return NextResponse.json({ success: false, message: 'Question not found.' }, { status: 404 });
      }

      return NextResponse.json({ success: true, question: updatedQuestion });
    } else {
      const updatedQuestion = await Question.findByIdAndUpdate(
        params.id,
        { subject, class: classId, tags, content, options, answerIndexes, explanation, marks, type },
        { new: true, runValidators: true }
      )
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate({
        path: 'tags',
        model: 'Tag',
        populate: {
          path: 'type',
          model: 'TagType',
          select: 'name'
        }
      });

      if (!updatedQuestion) {
        return NextResponse.json({ success: false, message: 'Question not found.' }, { status: 404 });
      }

      return NextResponse.json({ success: true, question: updatedQuestion });
    }
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json({ success: false, message: messages.join(', ') }, { status: 400 });
    }
    console.error('Error updating question:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected server error occurred.', error: error.message },
      { status: 500 }
    );
  }
}