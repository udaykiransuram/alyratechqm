export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import QuestionPaperResponse from '@/models/QuestionPaperResponse';
import QuestionPaper from '@/models/QuestionPaper';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { connectDB } from '@/lib/db';
import { getTenantDb } from '@/lib/db-tenant';
import '@/models/User';
import '@/models/Subject';
import '@/models/TagType';
import '@/models/Tag';
import { buildTagReport } from '@/lib/analytics/tagReport';
import { z } from 'zod';
import { objectIdSchema, schoolKeySchema, parseOr400 } from '@/lib/validation';

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

  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  // schoolKey optional: if present validate; if invalid, silently fall back to default (no tenant)
  let tenantKey = '';
  if (schoolKey) {
    const res = parseOr400(z.object({ schoolKey: schoolKeySchema }), { schoolKey });
    if (res.ok) tenantKey = schoolKey;
  }

  // Validate params and query
  const groupByParam = req.nextUrl.searchParams.get('groupBy');
  const groupByParts = groupByParam ? groupByParam.split(',').map(s => s.trim()).filter(Boolean) : [];
  const querySchema = z.object({
    responseId: objectIdSchema,
    groupBy: z.array(z.string()).max(5).optional(),
    json: z.string().optional(),
    groupFields: z.string().optional(),
    classLevel: z.string().optional(),
  });
  const qRes = parseOr400(querySchema, { responseId: params.responseId, groupBy: groupByParts, json: req.nextUrl.searchParams.get('json'), groupFields: req.nextUrl.searchParams.get('groupFields'), classLevel: req.nextUrl.searchParams.get('classLevel') });
  // Do not block on validation; proceed best-effort. If responseId is invalid, DB lookup will yield 404 later.

  // --- Handle groupFields=1 for dynamic grouping options ---

  let QPRModel: any = QuestionPaperResponse;
  let QPModel: any = QuestionPaper;
  if (tenantKey) { try { const conn = await getTenantDb(tenantKey); QPRModel = conn.model('QuestionPaperResponse'); QPModel = conn.model('QuestionPaper'); } catch (e) {} }

  if (req.nextUrl.searchParams.get('groupFields') === '1') {
    try {
      const response = await QPRModel.findById(params.responseId)
        .populate({
          path: 'sectionAnswers.answers.question',
          select: 'tags',
          populate: {
            path: 'tags',
            populate: { path: 'type', select: 'name' }
          }
        });

      const tagTypeSet = new Set<string>();
      response?.sectionAnswers?.forEach((section: any) => {
        section.answers?.forEach((ans: any) => {
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

      const res = NextResponse.json({ fields });
      res.headers.set('X-Debug-Student-GF', 'ok');
      return res;
    } catch (e: any) {
      console.error('student groupFields error:', e?.message || e);
      const res = NextResponse.json({ fields: [{ value: 'section', label: 'Section' }] });
      res.headers.set('X-Debug-Student-GF', 'fallback');
      return res;
    }
  }

  const isClassLevel = req.nextUrl.searchParams.get('classLevel') === '1';

  try {
    const groupBy = groupByParts;

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
      correctStudents: any[];
      incorrectStudents: any[];
      unattemptedStudents: any[];
      correctQuestionIds?: any[];
      incorrectQuestionIds?: any[];
      unattemptedQuestionIds?: any[];
      optionTags?: any[];
    }> = {};
    if (isClassLevel) {
      const firstResponse = await QPRModel.findById(params.responseId)
        .populate('paper', 'title sections')
        .lean();
      if (!firstResponse) {
        return NextResponse.json({ success: false, message: 'Response not found' }, { status: 404 });
      }
      const paperObj = Array.isArray(firstResponse) ? firstResponse[0]?.paper : firstResponse.paper;
      paperId = paperObj?._id?.toString() || paperObj?.toString() || '';
      paperTitle = paperObj?.title || '';

      const paper = await QPModel.findById(paperId)
        .populate({
          path: 'sections.questions.question',
          select: 'tags content answerIndexes options',
          populate: {
            path: 'tags',
            populate: { path: 'type', select: 'name' }
          }
        })
        .lean();

      responses = await QPRModel.find({ paper: paperId })
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
      const response = await QPRModel.findById(params.responseId)
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

    // --- Aggregate stats using shared helper ---
    const stats = buildTagReport({
      responses,
      paperSections,
      groupBy,
      isClassLevel,
      questionStats,
    });

    if (req.nextUrl.searchParams.get('json') === '1') {
      dedupeStatsArrays(stats);
      // Optional compact mode to reduce payload size: aggregates students at group-level and prunes per-question arrays
      if (req.nextUrl.searchParams.get('compact') === '1') {
        const aggregateAndPrune = (node: any) => {
          if (!node || typeof node !== 'object') return;
          const hasCounts = 'correct' in node && 'incorrect' in node && 'unattempted' in node;
          if (hasCounts) {
            const collect = (arr: any[] | undefined, key: 'correctStudents'|'incorrectStudents'|'unattemptedStudents') => {
              const students: { name: string; rollNumber: string }[] = [];
              if (Array.isArray(arr)) {
                arr.forEach((q: any) => {
                  if (Array.isArray(q?.[key])) students.push(...q[key]);
                });
              }
              // Deduplicate by rollNumber|name and keep counts collapsed client-side
              const map = new Map<string, { name: string; rollNumber: string }>();
              students.forEach(s => {
                const k = `${s.rollNumber}|${s.name}`;
                if (!map.has(k)) map.set(k, s);
              });
              return Array.from(map.values());
            };
            const correctAgg = collect(node.correctQuestionIds, 'correctStudents');
            const incorrectAgg = collect(node.incorrectQuestionIds, 'incorrectStudents');
            const unattemptedAgg = collect(node.unattemptedQuestionIds, 'unattemptedStudents');
            if (correctAgg.length) node.correctStudents = correctAgg;
            if (incorrectAgg.length) node.incorrectStudents = incorrectAgg;
            if (unattemptedAgg.length) node.unattemptedStudents = unattemptedAgg;
            // prune per-question student arrays to shrink payload
            if (Array.isArray(node.correctQuestionIds)) {
              node.correctQuestionIds = node.correctQuestionIds.map((q: any) => ({ id: q.id, number: q.number, section: q.section }));
            }
            if (Array.isArray(node.incorrectQuestionIds)) {
              node.incorrectQuestionIds = node.incorrectQuestionIds.map((q: any) => ({ id: q.id, number: q.number, section: q.section }));
            }
            if (Array.isArray(node.unattemptedQuestionIds)) {
              node.unattemptedQuestionIds = node.unattemptedQuestionIds.map((q: any) => ({ id: q.id, number: q.number, section: q.section }));
            }
          }
          Object.values(node).forEach(aggregateAndPrune);
        };
        aggregateAndPrune(stats);
      }
      const responsePayload = {
        success: true,
        stats,
        student: !isClassLevel ? students[0]?.name : undefined,
        rollNumber: !isClassLevel ? students[0]?.rollNumber : undefined,
        students: isClassLevel ? students : undefined,
        paper: paperTitle
      };
      const res = NextResponse.json(responsePayload);
      try { res.headers.set('X-Stats-Bytes', String(JSON.stringify(stats).length)); } catch {}
      return res;
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