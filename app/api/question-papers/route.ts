import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import QuestionPaper from '@/models/QuestionPaper';

export async function POST(req: NextRequest) {
  await connectDB();

  try {
    const {
      title,
      instructions,
      classId,
      subjectId,
      totalMarks,
      sections,
    } = await req.json();

    // Log incoming data for debugging
    console.log('Received payload:', {
      title,
      instructions,
      classId,
      subjectId,
      totalMarks,
      sections,
    });

    // Basic validation
    if (!title || !classId || !subjectId || !sections || !Array.isArray(sections) || sections.length === 0) {
      console.error('Validation failed: Missing required fields.', { title, classId, subjectId, sections });
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
    const paper = await QuestionPaper.create({
      title,
      instructions,
      class: classId,
      subject: subjectId,
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