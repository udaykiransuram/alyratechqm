import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import QuestionPaperResponse from '@/models/QuestionPaperResponse';
import QuestionPaper from '@/models/QuestionPaper';
import User from '@/models/User';
import { connectDB } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { paper, student, sectionAnswers, startedAt, submittedAt, totalMarksAwarded } = body;

    let studentDoc;

    // Accept either a student ID or a full student object
    if (typeof student === 'string' || (student && student._id && !student.rollNumber)) {
      // Existing logic for student ID
      const studentId = typeof student === 'string' ? student : student._id;
      studentDoc = await User.findById(studentId);
      if (!studentDoc) {
        return NextResponse.json({ success: false, message: 'Student not found' }, { status: 400 });
      }
    } else if (student && student.rollNumber) {
      // Try to find student by rollNumber (and class if provided)
      const query: any = { rollNumber: student.rollNumber, role: 'student' };
      if (student.class) query.class = student.class;
      studentDoc = await User.findOne(query);
      if (!studentDoc) {
        // If not found, create new
        studentDoc = new User({
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

    // Validate paper
    let paperDoc = await QuestionPaper.findById(paper)
      .populate('class')
      .populate('subject');

    if (!paperDoc) {
      return NextResponse.json({ success: false, message: 'Invalid question paper' }, { status: 400 });
    }

    // Validate sections and questions, but skip missing sections
    const missingSections: string[] = [];
    const validSectionAnswers = [];

    for (const sectionAns of sectionAnswers) {
      const paperSection = paperDoc.sections.find(
        (sec: any) => sec.name === sectionAns.sectionName
      );
      if (!paperSection) {
        missingSections.push(sectionAns.sectionName);
        continue; // Skip this section
      }
      // Validate questions in this section
      const validAnswers = [];
      for (const ans of sectionAns.answers) {
        if (paperSection.questions.some((q: any) => q.question.equals(ans.question))) {
          validAnswers.push(ans);
        }
        // else skip invalid question
      }
      validSectionAnswers.push({
        sectionName: sectionAns.sectionName,
        answers: validAnswers,
      });
    }

    // Optionally, you can log or return missingSections info
    if (validSectionAnswers.length === 0) {
      return NextResponse.json({ success: false, message: `No valid sections found in paper. Missing: ${missingSections.join(', ')}` }, { status: 400 });
    }

    // Check if a response already exists for this paper and student
    const existingResponse = await QuestionPaperResponse.findOne({
      paper,
      student: studentDoc._id,
    });
    if (existingResponse) {
      return NextResponse.json({
        success: false,
        message: 'A response for this student and question paper already exists.',
      }, { status: 400 });
    }

    // Create response
    const response = await QuestionPaperResponse.create({
      paper,
      student: studentDoc._id,
      sectionAnswers: validSectionAnswers,
      startedAt,
      submittedAt,
      totalMarksAwarded,
    });

    return NextResponse.json({
      success: true,
      response,
      ...(missingSections.length > 0 && { warning: `Some sections were not found: ${missingSections.join(', ')}` }),
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// GET handler to fetch responses for a paper
export async function GET(req: NextRequest) {
  await connectDB();
  try {
    const paperId = req.nextUrl.searchParams.get('paper');
    if (!paperId) {
      return NextResponse.json({ success: false, message: 'Paper ID is required' }, { status: 400 });
    }

    // Fetch the Question Paper to get the question order
    const paper = await QuestionPaper.findById(paperId).select('sections.name sections.questions.question').lean();
    if (!paper) {
      return NextResponse.json({ success: false, message: 'Question paper not found' }, { status: 404 });
    }

    // Create a map of questionId -> questionNumber
    const questionInfoMap = new Map<string, number>();
    if (paper && !Array.isArray(paper) && Array.isArray(paper.sections)) {
      paper.sections.forEach((section: any) => {
        let questionInSectionCounter = 1;
        section.questions.forEach((q: any) => {
          const questionId = q.question.toString();
          questionInfoMap.set(questionId, questionInSectionCounter);
          questionInSectionCounter++;
        });
      });
    }

    // Fetch the responses
    const responses = await QuestionPaperResponse.find({ paper: paperId })
      .populate('student', 'name rollNumber')
      .lean();

    // Augment the responses with the question number
    const augmentedResponses = responses.map(response => {
      response.sectionAnswers = response.sectionAnswers.map((sectionAnswer: any) => {
        sectionAnswer.answers = sectionAnswer.answers.map((answer: any) => {
          const questionId = answer.question.toString();
          return {
            ...answer,
            questionNumber: questionInfoMap.get(questionId) ?? 'N/A', // Add the number
          };
        });
        return sectionAnswer;
      });
      return response;
    });

    return NextResponse.json({ success: true, responses: augmentedResponses });
  } catch (error: any) {
    console.error('Failed to fetch responses:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}