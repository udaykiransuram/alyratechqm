export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import QuestionPaperResponse from '@/models/QuestionPaperResponse';
import QuestionPaper from '@/models/QuestionPaper';
import { connectDB } from '@/lib/db';
import { getTenantDb } from '@/lib/db-tenant';
import '@/models/User';
import '@/models/Subject';
import '@/models/TagType';
import '@/models/Tag';
import { buildTagReport } from '@/lib/analytics/tagReport';
import { z } from 'zod';
import { objectIdSchema, schoolKeySchema, parseOr400 } from '@/lib/validation';

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

function arraysEqual(a: number[], b: number[]) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

export async function GET(req: NextRequest, { params }: { params: { paperId: string } }) {
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
    paperId: objectIdSchema,
    groupBy: z.array(z.string()).max(5).optional(),
    json: z.string().optional(),
    groupFields: z.string().optional(),
  });
  const qRes = parseOr400(querySchema, { paperId: params.paperId, groupBy: groupByParts, json: req.nextUrl.searchParams.get('json'), groupFields: req.nextUrl.searchParams.get('groupFields') });
  // Do not block on validation; proceed with best-effort to avoid hard failures in UI
  // If invalid, Mongoose will return null on findById which we handle with 404 below

  try {
    let QPRModel: any = QuestionPaperResponse;
    let QPModel: any = QuestionPaper;
    if (tenantKey) {
      try { const conn = await getTenantDb(tenantKey); QPRModel = conn.model('QuestionPaperResponse'); QPModel = conn.model('QuestionPaper'); } catch (e) {}
    }

    const groupBy = groupByParts;

    let responses: any[] = [];
    let paperTitle = '';
    let students: any[] = [];
    let paperSections: any[] = [];

    // --- Fetch paper and responses ---
    const paper = await QPModel.findById(params.paperId)
      .populate({
        path: 'sections.questions.question',
        select: 'tags content answerIndexes options',
        populate: {
          path: 'tags',
          populate: { path: 'type', select: 'name' }
        }
      })
      .lean();

    if (!paper || (Array.isArray(paper) && paper.length === 0)) {
      return NextResponse.json({ success: false, message: 'Paper not found' }, { status: 404 });
    }

    const paperObj: any = Array.isArray(paper) ? paper[0] : paper;
    paperTitle = paperObj.title || '';
    paperSections = paperObj.sections || [];

    responses = await QPRModel.find({ paper: params.paperId })
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

    // --- Aggregate per-question stats for class level ---
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

    // --- Aggregate stats using shared helper ---
    const stats = buildTagReport({
      responses,
      paperSections,
      groupBy,
      isClassLevel: true,
      questionStats,
    });

    if (req.nextUrl.searchParams.get('json') === '1') {
      dedupeStatsArrays(stats);
      // Optional compact mode to reduce payload: aggregate students at group-level and prune per-question arrays
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
        students,
        paper: paperTitle
      };
      const res = NextResponse.json(responsePayload);
      try { res.headers.set('X-Stats-Bytes', String(JSON.stringify(stats).length)); } catch {}
      return res;
    }

    if (req.nextUrl.searchParams.get('groupFields') === '1') {
      // Build group fields from paperSections/tags
      const tagTypes = new Set<string>();
      paperSections.forEach((section: any) => {
        (section.questions || []).forEach((qWrap: any) => {
          (qWrap.question?.tags || []).forEach((tag: any) => {
            if (tag.type?.name) tagTypes.add(tag.type.name);
          });
        });
      });
      const fields = [
        { value: 'section', label: 'Section' },
        ...Array.from(tagTypes).map(type => ({ value: type.toLowerCase(), label: type }))
      ];
      return NextResponse.json({ fields });
    }

    // PDF generation (optional, similar to student route)
    // ...implement if needed...

    return NextResponse.json({ success: true, stats, students, paper: paperTitle });
  } catch (error: any) {
    console.error('Error in class analytics route:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}