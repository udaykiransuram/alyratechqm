import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { buildArchiveFilter, buildArchivedUpdate } from '@/lib/archive';
import { recordTenantAudit } from '@/lib/audit';
import { requireTenantSession } from '@/lib/api-auth';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';

function formatDependencyCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildClassDependencyBlockMessage(counts: {
  questions: number;
  questionPapers: number;
  courses: number;
}) {
  const parts: string[] = [];

  if (counts.questions > 0) {
    parts.push(
      formatDependencyCount(counts.questions, 'question', 'questions'),
    );
  }
  if (counts.questionPapers > 0) {
    parts.push(
      formatDependencyCount(
        counts.questionPapers,
        'question paper',
        'question papers',
      ),
    );
  }
  if (counts.courses > 0) {
    parts.push(formatDependencyCount(counts.courses, 'course', 'courses'));
  }

  if (parts.length === 0) {
    return 'This class cannot be archived yet because linked content still exists.';
  }

  return `This class cannot be archived yet because it still has ${parts.join(
    ', ',
  )} linked to it. Reassign or archive those records first.`;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin'],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();
  const { id: classId } = await params;

  try {
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ success: false, message: 'Invalid class ID' }, { status: 400 });
    }

    const {
      Class: ClassModel,
      Question: QuestionModel,
      QuestionPaper: QuestionPaperModel,
      Course: CourseModel,
    } = await getTenantModels(schoolKey, ['Class', 'Question', 'QuestionPaper', 'Course']);
    const existingClass = await ClassModel.findOne({
      _id: classId,
      ...buildArchiveFilter(false),
    })
      .select('_id name')
      .lean();

    if (!existingClass) {
      return NextResponse.json({ success: false, message: 'Class not found' }, { status: 404 });
    }

    const [questions, questionPapers, courses] = await Promise.all([
      QuestionModel.countDocuments({
        class: classId,
        ...buildArchiveFilter(false),
      }),
      QuestionPaperModel.countDocuments({
        class: classId,
        ...buildArchiveFilter(false),
      }),
      CourseModel.countDocuments({
        class: classId,
        status: { $ne: 'archived' },
        ...buildArchiveFilter(false),
      }),
    ]);

    if (questions > 0 || questionPapers > 0 || courses > 0) {
      return NextResponse.json(
        {
          success: false,
          message: buildClassDependencyBlockMessage({
            questions,
            questionPapers,
            courses,
          }),
          dependencyCounts: {
            questions,
            questionPapers,
            courses,
          },
        },
        { status: 409 },
      );
    }

    const archivedClass = await ClassModel.findOneAndUpdate(
      { _id: classId, ...buildArchiveFilter(false) },
      buildArchivedUpdate(auth.session.user.id),
      { new: true, runValidators: true },
    );

    if (!archivedClass) {
      return NextResponse.json({ success: false, message: 'Class not found' }, { status: 404 });
    }

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: 'class',
      entityId: String(archivedClass._id),
      entityLabel: String(archivedClass.name || ''),
      action: 'archived',
      summary: `Archived class ${archivedClass.name}.`,
    });

    return NextResponse.json({ success: true, message: 'Class archived successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
