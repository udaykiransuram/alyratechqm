import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import QuestionPaperResponse from '@/models/QuestionPaperResponse';
import QuestionPaper from '@/models/QuestionPaper';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { connectDB } from '@/lib/db';

function arraysEqual(a: number[], b: number[]) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

function getTagValue(tags: any[], type: string) {
  const tag = tags.find((t: any) => t.type?.name?.toLowerCase() === type.toLowerCase());
  return tag?.name || `Unknown ${type.charAt(0).toUpperCase() + type.slice(1)}`;
}

// Recursively deduplicate question ID arrays in stats
function dedupeStatsArrays(obj: any) {
  if (
    obj &&
    typeof obj === "object" &&
    "correct" in obj &&
    "incorrect" in obj &&
    "unattempted" in obj
  ) {
    if (Array.isArray(obj.correctQuestionIds))
      obj.correctQuestionIds = obj.correctQuestionIds.filter(
        (q: any, idx: number, arr: any[]) =>
          typeof q === 'object'
            ? arr.findIndex(qq => typeof qq === 'object' && qq.id === q.id) === idx
            : arr.indexOf(q) === idx
      );
    if (Array.isArray(obj.incorrectQuestionIds))
      obj.incorrectQuestionIds = obj.incorrectQuestionIds.filter(
        (q: any, idx: number, arr: any[]) =>
          typeof q === 'object'
            ? arr.findIndex(qq => typeof qq === 'object' && qq.id === q.id) === idx
            : arr.indexOf(q) === idx
      );
    if (Array.isArray(obj.unattemptedQuestionIds))
      obj.unattemptedQuestionIds = obj.unattemptedQuestionIds.filter(
        (q: any, idx: number, arr: any[]) =>
          typeof q === 'object'
            ? arr.findIndex(qq => typeof qq === 'object' && qq.id === q.id) === idx
            : arr.indexOf(q) === idx
      );
    // Deduplicate optionTags by option+tag+isCorrect+student.rollNumber
    if (Array.isArray(obj.optionTags)) {
      obj.optionTags = obj.optionTags.filter(
        (tag: any, idx: number, arr: any[]) =>
          arr.findIndex(
            t =>
              t.option === tag.option &&
              t.tag === tag.tag &&
              t.isCorrect === tag.isCorrect &&
              (t.student?.rollNumber || '') === (tag.student?.rollNumber || '')
          ) === idx
      );
    }
    return;
  }
  if (obj && typeof obj === "object") {
    Object.values(obj).forEach(dedupeStatsArrays);
  }
}

export async function GET(req: NextRequest, { params }: { params: { responseId: string } }) {
  await connectDB();

  // --- Handle groupFields=1 for dynamic grouping options ---
  if (req.nextUrl.searchParams.get('groupFields') === '1') {
    const response = await QuestionPaperResponse.findById(params.responseId)
      .populate({
        path: 'sectionAnswers.answers.question',
        select: 'tags',
        populate: {
          path: 'tags',
          populate: { path: 'type', select: 'name' }
        }
      });

    const tagTypeSet = new Set<string>();
    response?.sectionAnswers.forEach((section: any) => {
      section.answers.forEach((ans: any) => {
        ans.question?.tags?.forEach((tag: any) => {
          if (tag.type?.name) tagTypeSet.add(tag.type.name);
        });
      });
    });

    const fields = [{ value: 'section', label: 'Section' }]
      .concat(Array.from(tagTypeSet).map(name => ({
        value: name.toLowerCase(),
        label: name
      })));

    return NextResponse.json({ fields });
  }

  const isClassLevel = req.nextUrl.searchParams.get('classLevel') === '1';

  try {
    const groupByParam = req.nextUrl.searchParams.get('groupBy');
    const groupBy = groupByParam
      ? groupByParam.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    let responses: any[] = [];
    let paperTitle = '';
    let paperId = '';
    let students: any[] = [];
    let paperSections: any[] = [];

    // --- Per-question stats for class level ---
    let questionStats: Record<string, {
      correct: number;
      incorrect: number;
      unattempted: number;
      correctStudents: { name: string; rollNumber: string }[];
      incorrectStudents: { name: string; rollNumber: string }[];
      unattemptedStudents: { name: string; rollNumber: string }[];
    }> = {};

    if (isClassLevel) {
      const firstResponse = await QuestionPaperResponse.findById(params.responseId)
        .populate('paper', 'title sections')
        .lean();
      if (!firstResponse) {
        return NextResponse.json({ success: false, message: 'Response not found' }, { status: 404 });
      }
      const paperObj = Array.isArray(firstResponse) ? firstResponse[0]?.paper : firstResponse.paper;
      paperId = paperObj?._id?.toString() || paperObj?.toString() || '';
      paperTitle = paperObj?.title || '';

      const paper = await QuestionPaper.findById(paperId)
        .populate({
          path: 'sections.questions.question',
          select: 'tags content answerIndexes options',
          populate: {
            path: 'tags',
            populate: { path: 'type', select: 'name' }
          }
        })
        .lean();

      responses = await QuestionPaperResponse.find({ paper: paperId })
        .populate({
          path: 'sectionAnswers.answers.question',
          select: 'answerIndexes tags content options',
          populate: {
            path: 'tags',
            populate: { path: 'type', select: 'name' }
          }
        })
        .populate('student', 'name rollNumber')
        .lean();
      students = responses.map(r => r.student);

      paperSections = Array.isArray(paper) ? (paper[0]?.sections || []) : (paper?.sections || []);

      // --- Aggregate per-question stats for class level ---
      for (const response of responses) {
        const studentInfo = {
          name: response.student?.name || '',
          rollNumber: response.student?.rollNumber || ''
        };
        const answerMap: Record<string, Record<string, any>> = {};
        (response.sectionAnswers || []).forEach((section: any) => {
          answerMap[section.sectionName] = {};
          (section.answers || []).forEach((ans: any) => {
            answerMap[section.sectionName][String(ans.question?._id || ans.question)] = ans;
          });
        });

        for (const paperSection of paperSections) {
          const sectionName = paperSection.name;
          const questions = paperSection.questions || [];
          for (const qWrap of questions) {
            const question = qWrap.question;
            if (!question || !question.tags || !question._id) continue;
            const qid = String(question._id);
            const ans = answerMap[sectionName]?.[qid];
            const attempted = ans && Array.isArray(ans.selectedOptions) && ans.selectedOptions.length > 0;
            const isCorrect = attempted && arraysEqual(ans.selectedOptions, question.answerIndexes || []);
            if (!questionStats[qid]) questionStats[qid] = {
              correct: 0, incorrect: 0, unattempted: 0,
              correctStudents: [], incorrectStudents: [], unattemptedStudents: []
            };
            if (!attempted) {
              questionStats[qid].unattempted += 1;
              questionStats[qid].unattemptedStudents.push(studentInfo);
            }
            else if (isCorrect) {
              questionStats[qid].correct += 1;
              questionStats[qid].correctStudents.push(studentInfo);
            }
            else {
              questionStats[qid].incorrect += 1;
              questionStats[qid].incorrectStudents.push(studentInfo);
            }
          }
        }
      }
    } else {
      const response = await QuestionPaperResponse.findById(params.responseId)
        .populate({
          path: 'sectionAnswers.answers.question',
          select: 'answerIndexes tags content options',
          populate: {
            path: 'tags',
            populate: { path: 'type', select: 'name' }
          }
        })
        .populate({
          path: 'paper',
          select: 'title subject sections',
          populate: {
            path: 'sections.questions.question',
            select: 'tags content answerIndexes options',
            populate: {
              path: 'tags',
              populate: { path: 'type', select: 'name' }
            }
          }
        })
        .populate('student', 'name rollNumber')
        .lean();
      if (!response) {
        return NextResponse.json({ success: false, message: 'Response not found' }, { status: 404 });
      }
      responses = [response];
      paperTitle = Array.isArray(response) ? (response[0]?.paper?.title || '') : (response.paper?.title || '');
      students = Array.isArray(response) ? response.map(r => r.student) : [response.student];
      paperSections = Array.isArray(response)
        ? (response[0]?.paper?.sections || [])
        : (response.paper?.sections || []);
    }

    // --- Aggregate stats ---
    const stats: any = {};

    for (const response of responses) {
      const answerMap: Record<string, Record<string, any>> = {};
      (response.sectionAnswers || []).forEach((section: any) => {
        answerMap[section.sectionName] = {};
        (section.answers || []).forEach((ans: any) => {
          answerMap[section.sectionName][String(ans.question?._id || ans.question)] = ans;
        });
      });

      for (const paperSection of paperSections) {
        const sectionName = paperSection.name;
        const questions = paperSection.questions || [];
        let questionNumber = 1; // Track question number within the section

        for (const qWrap of questions) {
          const question = qWrap.question;
          if (!question || !question.tags || !question._id) continue;

          const ans = answerMap[sectionName]?.[String(question._id)];
          const attempted = ans && Array.isArray(ans.selectedOptions) && ans.selectedOptions.length > 0;
          const isCorrect = attempted && arraysEqual(ans.selectedOptions, question.answerIndexes || []);
          const questionIdStr = String(question._id);

          // Compose question object for frontend
          const questionObj = {
            id: questionIdStr,
            number: questionNumber,
            section: sectionName,
            ...(isClassLevel && questionStats[questionIdStr]
              ? {
                  correctCount: questionStats[questionIdStr].correct,
                  incorrectCount: questionStats[questionIdStr].incorrect,
                  unattemptedCount: questionStats[questionIdStr].unattempted,
                  correctStudents: questionStats[questionIdStr].correctStudents,
                  incorrectStudents: questionStats[questionIdStr].incorrectStudents,
                  unattemptedStudents: questionStats[questionIdStr].unattemptedStudents,
                }
              : {})
          };

          let pointer = stats;
          for (let i = 0; i < groupBy.length; i++) {
            const group = groupBy[i];
            let key;
            if (group === 'section') key = sectionName;
            else if (group === 'tagtype') {
              key = (question.tags || [])
                .map((tag: any) => `${tag.type?.name || 'Other'}: ${tag.name || 'Unknown'}`)
                .join(', ');
            } else {
              key = getTagValue(question.tags, group);
            }

            if (!pointer[key]) pointer[key] = i === groupBy.length - 1
              ? { 
                  correct: 0, 
                  incorrect: 0, 
                  unattempted: 0, 
                  optionTags: [],
                  correctQuestionIds: [],
                  incorrectQuestionIds: [],
                  unattemptedQuestionIds: [],
                  tags: []
                }
              : {};
            pointer = pointer[key];
          }

          if (!attempted) {
            pointer.unattempted += 1;
            pointer.unattemptedQuestionIds ??= [];
            pointer.unattemptedQuestionIds.push(questionObj);
          } else if (isCorrect) {
            pointer.correct += 1;
            pointer.correctQuestionIds ??= [];
            pointer.correctQuestionIds.push(questionObj);
          } else {
            pointer.incorrect += 1;
            pointer.incorrectQuestionIds ??= [];
            pointer.incorrectQuestionIds.push(questionObj);
          }

          // --- Option tags with student info ---
          if (attempted && Array.isArray(ans.selectedOptions)) {
            ans.selectedOptions.forEach((optIdx: number) => {
              const optionTagType = `option ${String.fromCharCode(97 + optIdx)}`;
              const tagsForOption = (question.tags || []).filter(
                (tag: any) => tag.type?.name?.toLowerCase() === optionTagType
              );
              const isOptionCorrect = (question.answerIndexes || []).includes(optIdx);
              tagsForOption.forEach((tag: any) => {
                pointer.optionTags ??= [];
                pointer.optionTags.push({
                  option: optionTagType,
                  tag: tag.name,
                  isCorrect: isOptionCorrect,
                  student: isClassLevel && response.student
                    ? {
                        name: response.student.name,
                        rollNumber: response.student.rollNumber
                      }
                    : undefined
                });
              });
            });
          }

          pointer.tags = (question.tags || []).map((tag: any) => ({
            type: tag.type?.name || 'Unknown',
            value: tag.name
          }));

          questionNumber++; // Increment for each question in section
        }
      }
    }

    if (req.nextUrl.searchParams.get('json') === '1') {
      dedupeStatsArrays(stats);
      const responsePayload = {
        success: true,
        stats,
        student: !isClassLevel ? students[0]?.name : undefined,
        rollNumber: !isClassLevel ? students[0]?.rollNumber : undefined,
        students: isClassLevel ? students : undefined,
        paper: paperTitle
      };
      console.log('Analytics API response:', JSON.stringify(responsePayload, null, 2));
      return NextResponse.json(responsePayload);
    }

    // PDF generation (unchanged)
    const doc = new PDFDocument();
    const stream = new Readable().wrap(doc);

    let buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {});

    doc.fontSize(18).text('Student Tag Analytics Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Student: ${responses[0].student?.name || responses[0].student}`);
    doc.fontSize(14).text(`Roll Number: ${responses[0].student?.rollNumber || ''}`);
    doc.fontSize(14).text(`Paper: ${responses[0].paper?.title || responses[0].paper}`);
    doc.moveDown();
    doc.fontSize(14).text('Subject → Topic → TagType: Tag-wise Correct/Incorrect Count:', { underline: true });
    doc.moveDown();

    Object.entries(stats).forEach(([subject, topics]) => {
      doc.fontSize(15).text(`${subject}:`, { underline: true });
      Object.entries(topics as Record<string, any>).forEach(([topic, tagTypes]) => {
        doc.fontSize(13).text(`  ${topic}:`, { underline: true });
        Object.entries(tagTypes as Record<string, any>).forEach(([tagTypeAndName, stat]) => {
          doc.fontSize(12).text(`    ${tagTypeAndName}: Correct: ${stat.correct}, Incorrect: ${stat.incorrect}`);
          doc.moveDown();
        });
        doc.moveDown();
      });
      doc.moveDown();
    });

    doc.end();

    await new Promise(resolve => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(buffers);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="student_tag_analytics.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Error in analytics route:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}