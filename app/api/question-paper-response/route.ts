
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';

function resolveSchoolKey(req: NextRequest){
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  return (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const schoolKey = resolveSchoolKey(req);
    if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
    const { QuestionPaperResponse: QPRModel, QuestionPaper: QPModel, User: UserModel } = await getTenantModels(schoolKey, ['QuestionPaperResponse','QuestionPaper','User']);

    const body = await req.json();
    const { paper, student, sectionAnswers, startedAt, submittedAt, totalMarksAwarded } = body;

    let studentDoc: any;

    if (typeof student === 'string' || (student && student._id && !student.rollNumber)) {
      const studentId = typeof student === 'string' ? student : student._id;
      studentDoc = await UserModel.findById(studentId);
      if (!studentDoc) {
        return NextResponse.json({ success: false, message: 'Student not found' }, { status: 400 });
      }
    } else if (student && student.rollNumber) {
      const query: any = { rollNumber: student.rollNumber, role: 'student' };
      if (student.class) query.class = student.class;
      studentDoc = await UserModel.findOne(query);
      if (!studentDoc) {
        studentDoc = new UserModel({
          name: student.name,
          rollNumber: student.rollNumber,
          class: student.class,
          role: 'student',
          enrolledAt: new Date(),
        });
        await studentDoc.save();
      }
    } else {
      return NextResponse.json({ success: false, message: 'Student information is required' }, { status: 400 });
    }

    let paperDoc = await QPModel.findById(paper)
      .populate('class')
      .populate('subject');

    if (!paperDoc) {
      return NextResponse.json({ success: false, message: 'Invalid question paper' }, { status: 400 });
    }

    const missingSections: string[] = [];
    const validSectionAnswers: any[] = [];

    for (const sectionAns of sectionAnswers || []) {
      const paperSection = (paperDoc.sections || []).find((sec: any) => sec.name === sectionAns.sectionName);
      if (!paperSection) { missingSections.push(sectionAns.sectionName); continue; }
      const validAnswers: any[] = [];
      for (const ans of sectionAns.answers || []) {
        if ((paperSection.questions || []).some((q: any) => String(q.question) === String(ans.question))) {
          validAnswers.push(ans);
        }
      }
      validSectionAnswers.push({ sectionName: sectionAns.sectionName, answers: validAnswers });
    }

    if (validSectionAnswers.length === 0) {
      return NextResponse.json({ success: false, message: `No valid sections found in paper. Missing: ${missingSections.join(', ')}` }, { status: 400 });
    }

    const existingResponse = await QPRModel.findOne({ paper, student: studentDoc._id });
    if (existingResponse) {
      return NextResponse.json({ success: false, message: 'A response for this student and question paper already exists.' }, { status: 400 });
    }

    const response = await QPRModel.create({
      paper,
      student: studentDoc._id,
      sectionAnswers: validSectionAnswers,
      startedAt,
      submittedAt,
      totalMarksAwarded,
    });

    return NextResponse.json({ success: true, response, ...(missingSections.length > 0 && { warning: `Some sections were not found: ${missingSections.join(', ')}` }) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// GET handler to fetch responses for a paper or student
export async function GET(req: NextRequest) {
  await connectDB();
  try {
    const schoolKey = resolveSchoolKey(req);
    if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
    const { QuestionPaperResponse: QPRModel, QuestionPaper: QPModel } = await getTenantModels(schoolKey, ['QuestionPaperResponse','QuestionPaper']);

    const url = req.nextUrl;
    const paperId = url.searchParams.get('paper');
    const studentId = url.searchParams.get('student');

    if (!paperId && !studentId) {
      return NextResponse.json({ success: false, message: 'Paper ID or Student ID is required' }, { status: 400 });
    }

    if (studentId) {
      const responses = await QPRModel.find({ student: studentId })
        .populate({ path: 'paper', select: 'title subject class', populate: [ { path: 'subject', select: 'name' }, { path: 'class', select: 'name' } ] })
        .lean();
      responses.sort((a:any, b:any) => {
        const ad = a.submittedAt ? new Date(a.submittedAt).getTime() : new Date(a.startedAt || a.createdAt).getTime();
        const bd = b.submittedAt ? new Date(b.submittedAt).getTime() : new Date(b.startedAt || b.createdAt).getTime();
        return bd - ad;
      });
      return NextResponse.json({ success: true, responses });
    }

    const paper = await QPModel.findById(paperId).select('sections.name sections.questions.question').lean();
    if (!paper) {
      return NextResponse.json({ success: false, message: 'Question paper not found' }, { status: 404 });
    }

    const questionInfoMap = new Map<string, number>();
    if (paper && !Array.isArray(paper) && Array.isArray((paper as any).sections)) {
      (paper as any).sections.forEach((section: any) => {
        let questionInSectionCounter = 1;
        section.questions.forEach((q: any) => {
          const questionId = q.question.toString();
          questionInfoMap.set(questionId, questionInSectionCounter);
          questionInSectionCounter++;
        });
      });
    }

    const responses = await QPRModel.find({ paper: paperId })
      .populate('student', 'name rollNumber')
      .lean();

    const augmentedResponses = responses.map((response: any) => {
      response.sectionAnswers = (response.sectionAnswers || []).map((sectionAnswer: any) => {
        sectionAnswer.answers = (sectionAnswer.answers || []).map((answer: any) => ({
          ...answer,
          questionNumber: questionInfoMap.get(String(answer.question)) ?? 'N/A',
        }));
        return sectionAnswer;
      });
      return response;
    });

    return NextResponse.json({ success: true, responses: augmentedResponses });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
