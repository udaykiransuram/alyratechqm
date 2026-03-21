import { NextRequest, NextResponse } from 'next/server';
import { buildArchiveFilter } from '@/lib/archive';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';

export const dynamic = 'force-dynamic';

function resolveLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(Math.floor(parsed), 100);
}

export async function GET(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const limit = resolveLimit(url.searchParams.get('limit'));
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  try {
    const { Tag, Subject } = await getTenantModels(schoolKey, ['Tag','Subject']);
    const tagFilter = buildArchiveFilter(false);
    const tagsQuery = Tag.find(tagFilter).populate('type').sort({ name: 1 });
    if (limit) {
      tagsQuery.limit(limit);
    }

    const [tags, total] = await Promise.all([
      tagsQuery.lean(),
      Tag.countDocuments(tagFilter),
    ]);

    const tagIds = tags.map((t: any) => t._id);
    const subjects = tagIds.length > 0
      ? await Subject.find({
          tags: { $in: tagIds },
          ...buildArchiveFilter(false),
        })
          .select('name code tags class')
          .lean()
      : [];

    const tagIdToSubjects: Record<string, any[]> = {};
    subjects.forEach((subject: any) => {
      (subject.tags || []).forEach((tagId: any) => {
        const id = tagId.toString();
        (tagIdToSubjects[id] ||= []).push({ _id: subject._id, name: subject.name, code: subject.code });
      });
    });

    const tagsWithSubjects = tags.map((tag: any) => ({ ...tag, subjects: tagIdToSubjects[tag._id.toString()] || [] }));
    return NextResponse.json({
      success: true,
      tags: tagsWithSubjects,
      total,
      partial: tagsWithSubjects.length < total,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
