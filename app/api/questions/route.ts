export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import { buildArchiveFilter, resolveIncludeArchived } from '@/lib/archive';
import { requireTenantSession } from '@/lib/api-auth';
import {
  sanitizeQuestionForApiResponse,
  sanitizeQuestionOptions,
  sanitizeRichTextHtml,
} from '@/lib/security/html-sanitize';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildStableQuestionSort(
  primaryField: string,
  primaryOrder: 1 | -1,
) {
  if (!primaryField || primaryField === "_id") {
    return { _id: primaryOrder };
  }

  return {
    [primaryField]: primaryOrder,
    _id: primaryOrder,
  };
}

function sanitizeQuestionForPickerResponse(question: any) {
  const fullQuestion = sanitizeQuestionForApiResponse(question);

  return {
    _id: String(fullQuestion?._id || ''),
    content: sanitizeRichTextHtml(fullQuestion?.content),
    subject: fullQuestion?.subject || null,
    class: fullQuestion?.class || null,
    tags: Array.isArray(fullQuestion?.tags) ? fullQuestion.tags : [],
    marks: Number(fullQuestion?.marks || 0),
    type: String(fullQuestion?.type || ''),
    createdAt: String(fullQuestion?.createdAt || ''),
    options: Array.isArray(fullQuestion?.options) ? fullQuestion.options : [],
    answerIndexes: Array.isArray(fullQuestion?.answerIndexes)
      ? fullQuestion.answerIndexes
      : [],
    detailLevel: 'summary' as const,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin', 'teacher'],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();
  const { searchParams } = new URL(req.url);

  const { Question: QuestionModel } = await getTenantModels(schoolKey, ['Question','Tag','TagType','Class','Subject']);


  const query: any = { ...buildArchiveFilter(resolveIncludeArchived(searchParams)) };

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

  // Exclude specific question ids (comma-separated)
  const excludeIdsParam = searchParams.get('excludeIds');
  if (excludeIdsParam) {
    const excludeIds = excludeIdsParam
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (excludeIds.length > 0) {
      query._id = {
        ...(query._id || {}),
        $nin: excludeIds,
      };
    }
  }

  const idsParam = searchParams.get('ids');
  if (idsParam) {
    const requestedIds = idsParam
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (requestedIds.length > 0) {
      query._id = {
        ...(query._id || {}),
        $in: requestedIds,
      };
    }
  }

  // Search by content
  const search = searchParams.get('search');
  if (search) query.content = { $regex: escapeRegExp(search), $options: 'i' };

  const pageParam = Number(searchParams.get('page') || '');
  const limitParam = Number(searchParams.get('limit') || '');
  const sortField = searchParams.get('sort'); // e.g., createdAt|marks|content
  const sortOrder = (searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  const responseView = (searchParams.get('view') || '').trim().toLowerCase();
  const isPickerSummaryView = responseView === 'picker';
  const isPickerIdsView = responseView === 'picker-ids';
  const selectedFields = isPickerSummaryView
    ? 'subject class tags content marks type createdAt options answerIndexes'
    : isPickerIdsView
      ? '_id'
    : 'subject class tags content marks type createdAt options answerIndexes matrixOptions matrixAnswers explanation';

  // Build base query
  let cursor: any = QuestionModel.find(query).select(selectedFields);

  if (!isPickerIdsView) {
    cursor = cursor
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate({ path: 'tags', populate: { path: 'type', select: 'name' } });
  }

  cursor = cursor.lean();

  // Apply sort only if requested or if paginated (default createdAt desc)
  if (sortField) {
    const sortObj = buildStableQuestionSort(sortField, sortOrder as 1 | -1);
    cursor = cursor.sort(sortObj);
  } else if ((pageParam && limitParam) || isPickerIdsView) {
    cursor = cursor.sort(buildStableQuestionSort("createdAt", -1));
  }

  let total: number | undefined = undefined;
  let page: number | undefined = undefined;
  let pages: number | undefined = undefined;
  let limit: number | undefined = undefined;
  let totalCountPromise: Promise<number | undefined> | undefined;

  if (!isPickerIdsView && pageParam && limitParam) {
    limit = Math.min(100, Math.max(1, limitParam));
    totalCountPromise = QuestionModel.countDocuments(query).then((count) => count);
  }

  const totalCount = totalCountPromise ? await totalCountPromise : undefined;
  if (typeof totalCount === 'number') {
    total = totalCount;
    pages = Math.max(1, Math.ceil(totalCount / (limit || 1)));
    page = Math.min(Math.max(1, pageParam), pages);
    const skip = (page - 1) * limit!;
    cursor = cursor.skip(skip).limit(limit!);
  }

  const rawQuestions = await cursor;

  if (isPickerIdsView) {
    const questionIds = rawQuestions
      .map((question: any) => String(question?._id || ''))
      .filter(Boolean);

    return NextResponse.json({ success: true, questionIds, total: questionIds.length });
  }

  const questions = rawQuestions.map((question: any) =>
    isPickerSummaryView
      ? sanitizeQuestionForPickerResponse(question)
      : sanitizeQuestionForApiResponse(question),
  );
  return NextResponse.json({ success: true, questions, total, page, pages, limit });
}

// POST a new question (multiple correct answers)
export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin', 'teacher'],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();

  const { Question: QuestionModelPost } = await getTenantModels(schoolKey, ['Question','Tag','TagType','Class','Subject']);


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

    const sanitizedContent = sanitizeRichTextHtml(content);
    const sanitizedExplanation = sanitizeRichTextHtml(explanation);
    const sanitizedOptions = sanitizeQuestionOptions(options);

    // --- Server-Side Validation ---
    if (!subject || !classId || !sanitizedContent || !marks) {
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
        content: sanitizedContent,
        matrixOptions: filteredMatrixOptions,
        matrixAnswers,
        explanation: sanitizedExplanation,
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

      return NextResponse.json(
        { success: true, question: sanitizeQuestionForApiResponse(createdQuestion) },
        { status: 201 },
      );
    } else {
      if (
        (type === 'single' || type === 'multiple') &&
        sanitizedOptions.some((option: any) => !String(option?.content || '').trim())
      ) {
        return NextResponse.json(
          { success: false, message: 'Question options cannot be empty.' },
          { status: 400 },
        );
      }

      const newQuestion = new QuestionModelPost({
        subject,
        class: classId,
        tags,
        content: sanitizedContent,
        options: sanitizedOptions,
        answerIndexes,
        explanation: sanitizedExplanation,
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

      return NextResponse.json(
        { success: true, question: sanitizeQuestionForApiResponse(createdQuestion) },
        { status: 201 },
      );
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
