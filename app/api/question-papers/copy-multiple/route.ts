import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import QuestionPaper from '@/models/QuestionPaper';
import { getTenantModels } from '@/lib/db-tenant';

export async function POST(req: NextRequest) {
  await connectDB();

  // Tenant resolution
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  const { QuestionPaper: QPModel } = await getTenantModels(schoolKey, ['QuestionPaper']);

  try {
    const { papers } = await req.json();

    if (!Array.isArray(papers) || papers.length === 0) {
      return NextResponse.json({ success: false, message: 'No papers provided.' }, { status: 400 });
    }

    const createdPapers: any[] = [];

    for (let i = 0; i < papers.length; i++) {
      const paperData = papers[i];
      const {
        title,
        instructions,
        classId,
        subjectId,
        totalMarks,
        sections,
        duration,
        passingMarks,
        examDate,
      } = paperData;

      // Log incoming data for debugging
      console.log(`Received payload for paper #${i + 1}:`, {
        title,
        instructions,
        classId,
        subjectId,
        totalMarks,
        sections,
      });

      // Basic validation
      if (!title || !classId || !subjectId || !sections || !Array.isArray(sections) || sections.length === 0) {
        console.error(`Validation failed: Missing required fields in paper #${i + 1}.`, { title, classId, subjectId, sections });
        return NextResponse.json({ success: false, message: `Missing required fields in paper #${i + 1}.` }, { status: 400 });
      }

      // Validate each section
      for (const section of sections) {
        console.log(`Validating section in paper #${i + 1}:`, section);
        // Accept both .marks and .defaultMarks for compatibility
        const sectionMarks = typeof section.marks === 'number' ? section.marks : section.defaultMarks;
        if (!section.name || typeof sectionMarks !== 'number' || !Array.isArray(section.questions)) {
          console.error(`Invalid section data in paper #${i + 1}:`, section);
          return NextResponse.json({ success: false, message: `Invalid section data in paper #${i + 1}.` }, { status: 400 });
        }
        const sectionQuestionMarks = section.questions.reduce((sum: number, q: { marks?: number }) => sum + (q.marks ?? 0), 0);
        if (sectionMarks !== sectionQuestionMarks) {
          console.error(`Section marks mismatch in paper #${i + 1}: ${section.name}`, { sectionMarks, questionMarks: sectionQuestionMarks, questions: section.questions });
          return NextResponse.json({
            success: false,
            message: `Section "${section.name}" in paper #${i + 1} marks (${sectionMarks}) do not match total question marks (${sectionQuestionMarks}).`
          }, { status: 400 });
        }
        for (const [qi, q] of section.questions.entries()) {
          if (!q.question || typeof q.marks !== 'number') {
            console.error(`Invalid question data in section "${section.name}" at index ${qi} in paper #${i + 1}:`, q);
            return NextResponse.json({
              success: false,
              message: `Invalid question data in section "${section.name}" at index ${qi} in paper #${i + 1}.`
            }, { status: 400 });
          }
        }
      }

      // Save the paper
      console.log(`Saving question paper #${i + 1}...`);
      const newPaper = await QPModel.create({
        title,
        instructions,
        class: classId,
        subject: subjectId,
        totalMarks,
        sections: sections.map((section: any) => ({
          ...section,
          marks: typeof section.marks === 'number' ? section.marks : section.defaultMarks,
        })),
        duration,
        passingMarks,
        examDate,
      });
      createdPapers.push(newPaper);
    }

    return NextResponse.json({ success: true, papers: createdPapers }, { status: 201 });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error.' }, { status: 500 });
  }
}