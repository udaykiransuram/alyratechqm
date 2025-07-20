import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Question from '@/models/Question';
import Class from '@/models/Class';
import Subject from '@/models/Subject';
import Tag from '@/models/Tag';
import TagType from '@/models/TagType';
import mongoose from 'mongoose';

// UPDATE a question by ID (supports all types)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    console.log('PUT /api/questions/[id]: params.id =', params.id);
    console.log('PUT /api/questions/[id]: request body =', body);

    // --- Server-Side Validation ---
    if (!subject || !classId || !content || !marks || !type) {
      console.warn('PUT /api/questions/[id]: Missing required fields');
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
      if (answerIndexes.some(idx => idx < 0 || idx >= options.length)) {
        return NextResponse.json(
          { success: false, message: 'One or more selected answer indexes are invalid.' },
          { status: 400 }
        );
      }
    }

    if (type === 'matrix-match') {
      if (!matrixOptions || !Array.isArray(matrixOptions) || matrixOptions.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Matrix match questions require at least one pair.' },
          { status: 400 }
        );
      }
      // matrixAnswers can be empty or array of arrays
    }

    const question = await Question.findById(params.id);
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
      // Descriptive type
      question.options = undefined;
      question.answerIndexes = undefined;
      question.matrixOptions = undefined;
      question.matrixAnswers = undefined;
    }

    try {
      await question.save(); // This will run all validators correctly
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        console.error('PUT /api/questions/[id]: ValidationError', messages);
        return NextResponse.json({ success: false, message: messages.join(', ') }, { status: 400 });
      }
      throw error;
    }

    const updatedQuestion = await Question.findById(params.id)
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

    return NextResponse.json({ success: true, question: updatedQuestion });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      console.error('PUT /api/questions/[id]: ValidationError', messages);
      return NextResponse.json({ success: false, message: messages.join(', ') }, { status: 400 });
    }
    console.error('PUT /api/questions/[id]: Error updating question:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected server error occurred.', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE a question by ID
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  await connectDB();
  try {
    console.log('DELETE /api/questions/[id]: params.id =', params.id);

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      console.warn('DELETE /api/questions/[id]: Invalid question ID', params.id);
      return NextResponse.json({ success: false, message: 'Invalid question ID' }, { status: 400 });
    }

    const deletedQuestion = await Question.findByIdAndDelete(params.id);

    console.log('DELETE /api/questions/[id]: deletedQuestion =', deletedQuestion);

    if (!deletedQuestion) {
      console.warn('DELETE /api/questions/[id]: Question not found for id', params.id);
      return NextResponse.json({ success: false, message: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/questions/[id]: Server error', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

// PATCH - Update a question (supports all types)
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

    console.log('PATCH /api/questions/[id]: params.id =', params.id);
    console.log('PATCH /api/questions/[id]: request body =', body);

    if (!subject || !classId || !content || !marks || !type) {
      console.warn('PATCH /api/questions/[id]: Missing required fields');
      return NextResponse.json(
        { success: false, message: 'Missing required fields.' },
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
      if (answerIndexes.some(idx => idx < 0 || idx >= options.length)) {
        return NextResponse.json(
          { success: false, message: 'One or more selected answer indexes are invalid.' },
          { status: 400 }
        );
      }
    }

    if (type === 'matrix-match') {
      if (!matrixOptions || !Array.isArray(matrixOptions) || matrixOptions.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Matrix match questions require at least one pair.' },
          { status: 400 }
        );
      }
      // matrixAnswers can be empty or array of arrays
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      params.id,
      {
        subject,
        class: classId,
        tags,
        content,
        explanation,
        marks,
        type,
        ...(type === 'single' || type === 'multiple'
          ? { options, answerIndexes, matrixOptions: undefined, matrixAnswers: undefined }
          : type === 'matrix-match'
          ? { matrixOptions, matrixAnswers, options: undefined, answerIndexes: undefined }
          : { options: undefined, answerIndexes: undefined, matrixOptions: undefined, matrixAnswers: undefined }
        ),
      },
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

    console.log('PATCH /api/questions/[id]: updatedQuestion =', updatedQuestion);

    if (!updatedQuestion) {
      console.warn('PATCH /api/questions/[id]: Question not found for id', params.id);
      return NextResponse.json({ success: false, message: 'Question not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, question: updatedQuestion });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      console.error('PATCH /api/questions/[id]: ValidationError', messages);
      return NextResponse.json({ success: false, message: messages.join(', ') }, { status: 400 });
    }
    console.error('PATCH /api/questions/[id]: Error updating question:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected server error occurred.', error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  await connectDB();
  try {
    console.log('GET /api/questions/[id]: params.id =', params.id);

    const question = await Question.findById(params.id)
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate({
        path: 'tags',
        populate: { path: 'type', select: 'name' }
      });

    console.log('GET /api/questions/[id]: question =', question);

    if (!question) {
      console.warn('GET /api/questions/[id]: Question not found for id', params.id);
      return NextResponse.json({ success: false, message: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, question: question });
  } catch (error: any) {
    console.error('GET /api/questions/[id]: Server error', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
