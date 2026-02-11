export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantDb } from '@/lib/db-tenant'
import { getTenantModels } from '@/lib/db-tenant';
import Question from '@/models/Question';
import Class from '@/models/Class';
import Subject from '@/models/Subject';
import Tag from '@/models/Tag';
import TagType from '@/models/TagType';

export async function GET(req: NextRequest) {
    await connectDB();
  const { searchParams } = new URL(req.url);
  // Resolve tenant (school) key from header, query, or cookie
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = new URL(req.url).searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey || !schoolKey.toString().trim()) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }


  // Default to global Question model; switch to tenant model when schoolKey provided
  const { Question: QuestionModel } = await getTenantModels(schoolKey, ['Question','Tag','TagType','Class','Subject']);


  const query: any = {};

  // Filter by class
  const classId = searchParams.get('class');
  if (classId) query.class = classId;

  // Filter by subject
  const subjectId = searchParams.get('subject');
  if (subjectId) query.subject = subjectId;

  // Filter by tags (comma-separated), supports tagsMode=or|and (default: or)
  const tagsParam = searchParams.get('tags');
  const tagsMode = (searchParams.get('tagsMode') || 'or').toLowerCase();
  if (tagsParam) {
    const tagIds = tagsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (tagIds.length > 0) {
      query.tags = tagsMode === 'and' ? { $all: tagIds } : { $in: tagIds };
    }
  }

  // Filter by marks
  const marks = searchParams.get('marks');
  if (marks) query.marks = Number(marks);

  // Search by content
  const search = searchParams.get('search');
  if (search) query.content = { $regex: search, $options: 'i' };

  const pageParam = Number(searchParams.get('page') || '');
  const limitParam = Number(searchParams.get('limit') || '');
  const sortField = searchParams.get('sort'); // e.g., createdAt|marks|content
  const sortOrder = (searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 1 : -1;

  // Build base query
  let cursor = QuestionModel.find(query)
    .select('subject class tags content marks type createdAt options answerIndexes')
    .populate('subject', 'name')
    .populate('class', 'name')
    .populate({ path: 'tags', populate: { path: 'type', select: 'name' } })
    .lean();

  // Apply sort only if requested or if paginated (default createdAt desc)
  if (sortField) {
    const sortObj: any = { [sortField]: sortOrder };
    cursor = cursor.sort(sortObj);
  } else if (pageParam && limitParam) {
    cursor = cursor.sort({ createdAt: -1 });
  }

  let total: number | undefined = undefined;
  let page: number | undefined = undefined;
  let pages: number | undefined = undefined;
  let limit: number | undefined = undefined;

  if (pageParam && limitParam) {
    const totalCount = await QuestionModel.countDocuments(query);
    total = totalCount;
    page = Math.max(1, pageParam);
    limit = Math.max(1, limitParam);
    pages = Math.max(1, Math.ceil(totalCount / (limit || 1)));
    const skip = (page - 1) * limit;
    cursor = cursor.skip(skip).limit(limit);
  }

  try { console.debug('[api/questions] GET', { schoolKey, query, page: pageParam || undefined, limit: limitParam || undefined }); } catch {}
  const questions = await cursor;
  return NextResponse.json({ success: true, questions, total, page, pages, limit });
}

// POST a new question (multiple correct answers)
export async function POST(req: NextRequest) {
  await connectDB();
  // Tenant resolution for POST
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKeyPost = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKeyPost || !schoolKeyPost.toString().trim()) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }

  const { Question: QuestionModelPost } = await getTenantModels(schoolKeyPost, ['Question','Tag','TagType','Class','Subject']);


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

      const newQuestion = new QuestionModelPost({
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

      const createdQuestion = await QuestionModelPost.findById(newQuestion._id)
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
      const newQuestion = new QuestionModelPost({
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

      const createdQuestion = await QuestionModelPost.findById(newQuestion._id)
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

// PATCH - Update an existing question (multiple correct answers and matrix match)

}
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();

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
