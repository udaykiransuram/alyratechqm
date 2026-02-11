// app/api/questions/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Question from "@/models/Question";
import { getTenantModels } from '@/lib/db-tenant';
import Tag from "@/models/Tag";
import TagType from "@/models/TagType";
import Subject from "@/models/Subject";
import Class from "@/models/Class";

export const runtime = "nodejs";

/* ---------------- helpers ---------------- */
const toS = (v: any) => (v == null ? "" : String(v));
const lc  = (v: any) => toS(v).toLowerCase();

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

type Pair = { type: string; name: string }; // { tagTypeName(lowercased), tagValue(original string) }

// ANY-LENGTH TAGS: zip tagTypes & tags to min length, drop blanks, normalize type -> lowercase
function zipPairs(tagTypes: any[], tags: any[]): Pair[] {
  const n = Math.min(Array.isArray(tagTypes) ? tagTypes.length : 0, Array.isArray(tags) ? tags.length : 0);
  const out: Pair[] = [];
  for (let i = 0; i < n; i++) {
    const type = lc(tagTypes[i]);
    const name = toS(tags[i]).trim();
    if (!type || !name) continue; // skip blanks
    out.push({ type, name });
  }
  return out;
}

/* ---------------- route ---------------- */
export async function POST(req: NextRequest) {
  await connectDB();

  // Tenant resolution
  const urlTenant = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = urlTenant.searchParams.get('school');
  const schoolFromCookie = (req as any).cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) {
    return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  }

  // Bind tenant models (shadow globals below)
  const { Class: ClassModel, Subject: SubjectModel, TagType: TagTypeModel, Tag: TagModel, Question: QuestionModel } = await getTenantModels(schoolKey, ['Class','Subject','TagType','Tag','Question']);

  try {
    const body = await req.json();
    const { questions } = body || {};

    if (!Array.isArray(questions) || questions.length === 0) {
      return bad("Invalid input. Expected a non-empty array of questions.");
    }

    // 1) Collect uniques + pre-zip pairs per question
    const classNames = new Set<string>();
    const subjectNames = new Set<string>();
    const subjectCodes = new Map<string, string>(); // subject -> code

    const tagTypeNames = new Set<string>();         // LOWERCASED names
    const tagNameTypePairs = new Set<string>();     // key: `${tagValue}|||${tagTypeNameLower}`

    const perQuestionPairs: Pair[][] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q || typeof q !== "object") return bad(`Question ${i + 1}: not an object`);
      if (!q.class || !q.subject || !q.code) return bad(`Question ${i + 1}: each question must have 'class', 'subject', and 'code'.`);
      if (!Array.isArray(q.tags) || !Array.isArray(q.tagTypes)) {
        return bad(`Question ${i + 1}: 'tags' and 'tagTypes' must be arrays.`);
      }

      classNames.add(toS(q.class));
      subjectNames.add(toS(q.subject));
      subjectCodes.set(toS(q.subject), toS(q.code));

      const pairs = zipPairs(q.tagTypes, q.tags);
      perQuestionPairs[i] = pairs;

      for (const p of pairs) {
        tagTypeNames.add(p.type); // already lowercase
        tagNameTypePairs.add(`${p.name}|||${p.type}`);
      }
    }

    // 2) Bulk fetch existing docs
    const classList = Array.from(classNames);
    const subjectList = Array.from(subjectNames);
    const tagTypeList = Array.from(tagTypeNames); // already lowercased
    const tagNameList = Array.from(tagNameTypePairs).map((s) => s.split("|||")[0]); // fetch by name only

    const [classDocs, subjectDocs, tagTypeDocs, tagDocs] = await Promise.all([
      ClassModel.find({ name: { $in: classList } }),
      SubjectModel.find({ name: { $in: subjectList } }),
      TagTypeModel.find({ name: { $in: tagTypeList } }),     // stored lowercased
      TagModel.find({ name: { $in: tagNameList } }),         // may return multiple types per name
    ]);

    // 3) Build lookup maps
    const classMap   = new Map(classDocs.map((c: any) => [c.name, c]));
    const subjectMap = new Map(subjectDocs.map((s: any) => [s.name, s]));
    const tagTypeMap = new Map(tagTypeDocs.map((tt: any) => [lc(tt.name), tt])); // KEYS LOWERCASED

    // Tag map key: `${tagName}|||${tagTypeId}`
    const tagMap = new Map(
      tagDocs.map((t: any) => [`${t.name}|||${String(t.type)}`, t])
    );

    // 4) Create missing Classes
    const missingClasses = classList.filter((name) => !classMap.has(name));
    let createdClasses: any[] = [];
    if (missingClasses.length) {
      createdClasses = await ClassModel.insertMany(missingClasses.map((name) => ({ name })));
      createdClasses.forEach((c: any) => classMap.set(c.name, c));
    }

    // 5) Upsert TagTypes (idempotent, lowercase)
    const existingTT = new Set(tagTypeDocs.map((tt: any) => lc(tt.name)));
    const createTT = tagTypeList.filter((n) => !existingTT.has(n)); // already lowercase

    let createdTagTypes: any[] = [];
    if (createTT.length) {
      const results = await Promise.all(
        createTT.map((name) =>
          TagTypeModel.findOneAndUpdate(
            { name },                        // lowercase
            { $setOnInsert: { name } },
            { upsert: true, new: true }
          )
        )
      );
      results.forEach((tt) => tagTypeMap.set(lc(tt.name), tt));
      createdTagTypes = results;
    }

    // 6) Upsert Tags (idempotent) for (name, typeId) pairs
    const missingTags: { name: string; type: any }[] = [];
    for (const key of Array.from(tagNameTypePairs)) {
      const [tagName, typeNameLower] = key.split("|||");
      const tt = tagTypeMap.get(typeNameLower);
      if (!tt) continue; // unknown tag type (shouldn't happen)
      const tagKey = `${tagName}|||${String(tt._id)}`;
      if (!tagMap.has(tagKey)) {
        missingTags.push({ name: tagName, type: tt._id });
      }
    }

    const existingTagKeys = new Set(tagDocs.map((t: any) => `${t.name}|||${String(t.type)}`));
    let createdTags: any[] = [];
    if (missingTags.length) {
      const results = await Promise.all(
        missingTags.map(({ name, type }) =>
          TagModel.findOneAndUpdate(
            { name, type },
            { $setOnInsert: { name, type } },
            { upsert: true, new: true }
          )
        )
      );
      for (const t of results) {
        const k = `${t.name}|||${String(t.type)}`;
        if (!existingTagKeys.has(k)) {
          existingTagKeys.add(k);
          tagMap.set(k, t);
          createdTags.push(t);
        }
      }
    }

    // 7) Create/update Subjects and attach union of tagIds used with that subject
    let createdSubjects: any[] = [];
    for (const subjectName of subjectList) {
      let subjectDoc = subjectMap.get(subjectName);

      // Collect unique tagIds across all questions for this subject
      const tagIdsSet = new Set<string>();
      questions.forEach((q, idx) => {
        if (toS(q.subject) !== subjectName) return;
        const pairs = perQuestionPairs[idx] || [];
        for (const p of pairs) {
          const tt = tagTypeMap.get(p.type);
          if (!tt) continue;
          const k = `${p.name}|||${String(tt._id)}`;
          const tagDoc = tagMap.get(k);
          if (tagDoc) tagIdsSet.add(String(tagDoc._id));
        }
      });
      const tagIds = Array.from(tagIdsSet);

      if (!subjectDoc) {
        subjectDoc = await SubjectModel.create({
          name: subjectName,
          code: subjectCodes.get(subjectName) || "",
          tags: tagIds,
        });
        createdSubjects.push(subjectDoc);
        subjectMap.set(subjectName, subjectDoc);
      } else {
        const oldIds = new Set((subjectDoc.tags ?? []).map((x: any) => String(x)));
        const merged = new Set(Array.from(oldIds).concat(tagIds));
        if (merged.size !== oldIds.size) {
          subjectDoc.tags = Array.from(merged);
          await subjectDoc.save();
        }
      }
    }

    // 8) Prepare Questions
    const questionDataArray: any[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const classDoc = classMap.get(toS(q.class));
      const subjectDoc = subjectMap.get(toS(q.subject));
      if (!classDoc || !subjectDoc) {
        throw new Error(`Class or Subject not found for question: ${toS(q.content).slice(0, 30)}`);
      }

      // Map pairs -> tagIds
      const pairs = perQuestionPairs[i] || [];
      const tagIds: any[] = [];
      for (const p of pairs) {
        const tt = tagTypeMap.get(p.type);
        if (!tt) continue;
        const k = `${p.name}|||${String(tt._id)}`;
        const tagDoc = tagMap.get(k);
        if (tagDoc) tagIds.push(tagDoc._id);
      }

      const qDoc: any = {
        subject: subjectDoc._id,
        class: classDoc._id,
        tags: tagIds,
        content: q.content,
        explanation: q.explanation || undefined,
        marks: q.marks,
        type: q.type,
      };

      if (q.type === "matrix-match") {
        qDoc.matrixOptions = q.matrixOptions;
        qDoc.matrixAnswers = q.matrixAnswers;
      } else if (q.type === "single" || q.type === "multiple") {
        qDoc.options = q.options;
        qDoc.answerIndexes = q.answerIndexes;
      }

      questionDataArray.push(qDoc);
    }

    // 9) Insert all Questions
    const createdQuestions = await QuestionModel.insertMany(questionDataArray);

    return NextResponse.json(
      {
        success: true,
        message: "Bulk creation completed.",
        createdQuestions,
        createdTags,
        createdTagTypes,
        createdSubjects,
        createdClasses,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[BulkQuestion] Error during bulk creation:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Server error during bulk creation." },
      { status: 500 }
    );
  }
}
