
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';

export async function GET(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  try {
    const { Tag, Subject } = await getTenantModels(schoolKey, ['Tag','Subject']);
    const tags = await Tag.find({}).populate('type').lean();
    const tagIds = tags.map((t: any) => t._id);
    const subjects = await Subject.find({ tags: { $in: tagIds } }).select('name code tags class').lean();

    const tagIdToSubjects: Record<string, any[]> = {};
    subjects.forEach((subject: any) => {
      (subject.tags || []).forEach((tagId: any) => {
        const id = tagId.toString();
        (tagIdToSubjects[id] ||= []).push({ _id: subject._id, name: subject.name, code: subject.code });
      });
    });

    const tagsWithSubjects = tags.map((tag: any) => ({ ...tag, subjects: tagIdToSubjects[tag._id.toString()] || [] }));
    return NextResponse.json({ success: true, tags: tagsWithSubjects });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
