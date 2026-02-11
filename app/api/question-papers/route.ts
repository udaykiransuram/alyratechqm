export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantDb } from '@/lib/db-tenant'
import { getTenantModels } from '@/lib/db-tenant';
import '@/models/QuestionPaperResponse';
import '@/models/Class';
import '@/models/Subject';
import '@/models/TagType';
import '@/models/Tag';
import QuestionPaper from '@/models/QuestionPaper';

export async function POST(req: NextRequest) {
  await connectDB();

  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKeyPost = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKeyPost) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });

  try {

    const { QuestionPaper: QPModel } = await getTenantModels(schoolKeyPost, ['QuestionPaper']);

    const {
      title,
      instructions,
      class: classId, // Rename 'class' to 'classId' here
      subject,
      totalMarks,
      sections,
    } = await req.json();

    // Log incoming data for debugging
    console.log('Received payload:', {
      title,
      instructions,
      classId, // Use the new variable name
      subject,
      totalMarks,
      sections,
    });

    // Basic validation - now this will work correctly
    if (!title || !classId || !subject || !sections || !Array.isArray(sections) || sections.length === 0) {
      console.error('Validation failed: Missing required fields.', { title, classId, subject, sections });
      return NextResponse.json({ success: false, message: 'Missing required fields.' }, { status: 400 });
    }

    // Validate each section
    for (const section of sections) {
      console.log('Validating section:', section);
      if (!section.name || typeof section.marks !== 'number' || !Array.isArray(section.questions)) {
        console.error('Invalid section data:', section);
        return NextResponse.json({ success: false, message: 'Invalid section data.' }, { status: 400 });
      }
      const sectionQuestionMarks = section.questions.reduce((sum: number, q: { marks?: number }) => sum + (q.marks ?? 0), 0);
      if (section.marks !== sectionQuestionMarks) {
        console.error(`Section marks mismatch: ${section.name}`, { sectionMarks: section.marks, questionMarks: sectionQuestionMarks, questions: section.questions });
        return NextResponse.json({
          success: false,
          message: `Section "${section.name}" marks (${section.marks}) do not match total question marks (${sectionQuestionMarks}).`
        }, { status: 400 });
      }
      for (const [qi, q] of section.questions.entries()) {
        if (!q.question || typeof q.marks !== 'number') {
          console.error(`Invalid question data in section "${section.name}" at index ${qi}:`, q);
          return NextResponse.json({
            success: false,
            message: `Invalid question data in section "${section.name}" at index ${qi}.`
          }, { status: 400 });
        }
      }
    }

    // Create and save the question paper
    console.log('Saving question paper...');
    const paper = await QPModel.create({
      title,
      instructions,
      class: classId,
      subject,
      totalMarks,
      sections,
    });

    console.log('Question paper saved:', paper);

    return NextResponse.json({ success: true, paper }, { status: 201 });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKeyGet = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKeyGet) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  const { QuestionPaper: QPModelGet } = await getTenantModels(schoolKeyGet, ['QuestionPaper']);
  try {
    const papers = await QPModelGet.find({})
      .select('title class totalMarks sections createdAt updatedAt')
      .populate('class', 'name') // <-- This will give you { class: { _id, name } }
      .sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, papers });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error.' }, { status: 500 });
  }
}