// app/api/questions/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Question from "@/models/Question";
import { getTenantModels } from '@/lib/db-tenant';
import Tag from "@/models/Tag";
import TagType from "@/models/TagType";
import Subject from "@/models/Subject";
import { Model } from 'mongoose';
import Class from "@/models/Class";

interface ClassDoc {
  _id: string;
  name: string;
}

interface SubjectDoc {
  _id: string;
  name: string;
  tags: string[];
  save: () => Promise<void>;
}

interface TagTypeDoc {
  _id: string;
  name: string;
}

interface TagDoc {
  _id: string;
  name: string;
  type: string;
}

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
      ClassModel.find({ name: { $in: classList } }) as Promise<ClassDoc[]>,
      SubjectModel.find({ name: { $in: subjectList } }) as Promise<SubjectDoc[]>,
      TagTypeModel.find({ name: { $in: tagTypeList } }) as Promise<TagTypeDoc[]>,     // stored lowercased
      TagModel.find({ name: { $in: tagNameList } }) as Promise<TagDoc[]>,         // may return multiple types per name
    ]);

    // 3) Build lookup maps
    const classMap   = new Map<string, ClassDoc>(classDocs.map((c: ClassDoc) => [c.name, c]));
    const subjectMap = new Map<string, SubjectDoc>(subjectDocs.map((s: SubjectDoc) => [s.name, s]));
    const tagTypeMap = new Map<string, TagTypeDoc>(tagTypeDocs.map((tt: TagTypeDoc) => [lc(tt.name), tt])); // KEYS LOWERCASED

    // Tag map key: `${tagName}|||${tagTypeId}`
    const tagMap = new Map<string, TagDoc>(
      tagDocs.map((t: TagDoc) => [`${t.name}|||${String(t.type)}`, t])
    );

    // 4) Create missing Classes
    const missingClasses = classList.filter((name) => !classMap.has(name));
    let createdClasses: any[] = [];
    if (missingClasses.length) {
      createdClasses = await ClassModel.insertMany(missingClasses.map((name) => ({ name })));
      createdClasses.forEach((c: any) => classMap.set(c.name, c));
    }

    // 5) Upsert TagTypes (idempotent, lowercase)
    const existingTT = new Set(tagTypeDocs.map((tt: TagTypeDoc) => lc(tt.name)));
    const createTT = tagTypeList.filter((n) => !existingTT.has(n)); // already lowercase

    let createdTagTypes: any[] = [];
    if (createTT.length) {
      const TagTypeModelTyped = TagTypeModel as Model<TagTypeDoc>;
      const results = await Promise.all(
        createTT.map(async (name) =>
          await TagTypeModelTyped.findOneAndUpdate(
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

    const existingTagKeys = new Set(tagDocs.map((t: TagDoc) => `${t.name}|||${String(t.type)}`));
    let createdTags: any[] = [];
    if (missingTags.length) {
      const TagModelTyped = TagModel as Model<TagDoc>;
      const results = await Promise.all(
        missingTags.map(async ({ name, type }) =>
          await TagModelTyped.findOneAndUpdate(
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
      let subjectDoc: SubjectDoc | undefined = subjectMap.get(subjectName);

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
        const newSubject = await SubjectModel.create({
          name: subjectName,
          code: subjectCodes.get(subjectName) || "",
          tags: tagIds,
        });
        subjectDoc = newSubject as SubjectDoc;
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

</final_file_content>

IMPORTANT: For any future changes to this file, use the final_file_content shown above as your reference. This content reflects the current state of the file, including any auto-formatting (e.g., if you used single quotes but the formatter converted them to double quotes). Always base your SEARCH/REPLACE operations on this final version to ensure accuracy.



New problems detected after saving the file:
app/api/questions/bulk/route.ts
- [ts Error] Line 307: Type expected.
- [ts Error] Line 309: Unknown keyword or identifier. Did you mean 'for'?
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: ';' expected.
- [ts Error] Line 309: ';' expected.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: ';' expected.
- [ts Error] Line 309: ';' expected.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: ';' expected.
- [ts Error] Line 309: Identifier expected.
- [ts Error] Line 309: Argument expression expected.
- [ts Error] Line 309: '(' expected.
- [ts Error] Line 309: ')' expected.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unknown keyword or identifier. Did you mean 'for matter'?
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Declaration or statement expected.
- [ts Error] Line 309: Declaration or statement expected.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: ';' expected.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: ';' expected.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 309: Unexpected keyword or identifier.
- [ts Error] Line 311: Identifier expected.
- [ts Error] Line 312: Invalid character.
- [ts Error] Line 312: ';' expected.
- [ts Error] Line 312: Unexpected keyword or identifier.
- [ts Error] Line 312: Unexpected keyword or identifier.
- [ts Error] Line 312: Unexpected keyword or identifier.
- [ts Error] Line 315: Invalid character.
- [ts Error] Line 315: ';' expected.
- [ts Error] Line 315: Unexpected keyword or identifier.
- [ts Error] Line 315: Unexpected keyword or identifier.
- [ts Error] Line 315: Unexpected keyword or identifier.
- [ts Error] Line 316: Identifier expected.
- [ts Error] Line 316: Identifier expected.
- [ts Error] Line 339: '{' expected.
- [ts Error] Line 342: '{' expected.
- [ts Error] Line 355: Invalid character.
- [ts Error] Line 355: ';' expected.
- [ts Error] Line 355: Unexpected keyword or identifier.
- [ts Error] Line 356: Unexpected keyword or identifier.
- [ts Error] Line 356: Unexpected keyword or identifier.
- [ts Error] Line 356: Unexpected keyword or identifier.
- [ts Error] Line 356: Unexpected keyword or identifier.
- [ts Error] Line 356: Unexpected keyword or identifier.
- [ts Error] Line 356: Unexpected keyword or identifier.
- [ts Error] Line 356: Unexpected keyword or identifier.
- [ts Error] Line 356: Unexpected keyword or identifier.
- [ts Error] Line 356: Unexpected keyword or identifier.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ',' expected.
- [ts Error] Line 356: ';' expected.
- [ts Error] Line 359: Invalid character.
- [ts Error] Line 359: ';' expected.
- [ts Error] Line 360: ';' expected.
- [ts Error] Line 360: ';' expected.
- [ts Error] Line 360: ';' expected.
- [ts Error] Line 360: ',' expected.
- [ts Error] Line 360: Octal literals are not allowed. Use the syntax '0o0'.
- [ts Error] Line 362: Invalid character.
- [ts Error] Line 362: ';' expected.
- [ts Error] Line 362: Unexpected keyword or identifier.
- [ts Error] Line 363: An identifier or keyword cannot immediately follow a numeric literal.
- [ts Error] Line 363: Unexpected keyword or identifier.
- [ts Error] Line 363: Expression expected.
- [ts Error] Line 365: Invalid character.
- [ts Error] Line 365: ';' expected.
- [ts Error] Line 366: Unexpected keyword or identifier.
- [ts Error] Line 367: Unterminated regular expression literal.
- [ts Error] Line 309: Cannot find name 'For'.
- [ts Error] Line 309: 'any' only refers to a type, but is being used as a value here.
- [ts Error] Line 309: Cannot find name 'future'.
- [ts Error] Line 309: Cannot find name 'changes'.
- [ts Error] Line 309: Cannot find name 'to'.
- [ts Error] Line 309: Cannot find name 'file'.
- [ts Error] Line 309: Left side of comma operator is unused and has no side effects.
- [ts Error] Line 309: Cannot find name 'use'.
- [ts Error] Line 309: Cannot find name 'the'.
- [ts Error] Line 309: Cannot find name 'final_file_content'.
- [ts Error] Line 309: Cannot find name 'shown'.
- [ts Error] Line 309: Cannot find name 'above'.
- [ts Error] Line 309: Cannot find name 'your'.
- [ts Error] Line 309: Cannot find name 'reference'.
- [ts Error] Line 309: Cannot find name 'content'.
- [ts Error] Line 309: Cannot find name 'reflects'.
- [ts Error] Line 309: Cannot find name 'the'.
- [ts Error] Line 309: Cannot find name 'current'.
- [ts Error] Line 309: Cannot find name 'state'.
- [ts Error] Line 309: Cannot find name 'of'.
- [ts Error] Line 309: Cannot find name 'the'.
- [ts Error] Line 309: Cannot find name 'file'.
- [ts Error] Line 309: Left side of comma operator is unused and has no side effects.
- [ts Error] Line 309: Cannot find name 'including'.
- [ts Error] Line 309: 'any' only refers to a type, but is being used as a value here.
- [ts Error] Line 309: Cannot find name 'auto'.
- [ts Error] Line 309: Cannot find name 'formatting'.
- [ts Error] Line 309: Cannot find name 'e'.
- [ts Error] Line 309: Cannot find name 'you'.
- [ts Error] Line 309: Cannot find name 'used'.
- [ts Error] Line 309: Cannot find name 'single'.
- [ts Error] Line 309: Cannot find name 'quotes'.
- [ts Error] Line 309: Cannot find name 'but'.
- [ts Error] Line 309: Cannot find name 'the'.
- [ts Error] Line 309: Cannot find name 'formatter'.
- [ts Error] Line 309: Cannot find name 'converted'.
- [ts Error] Line 309: Cannot find name 'them'.
- [ts Error] Line 309: Cannot find name 'to'.
- [ts Error] Line 309: Cannot find name 'double'.
- [ts Error] Line 309: Cannot find name 'quotes'.
- [ts Error] Line 309: Cannot find name 'Always'.
- [ts Error] Line 309: Cannot find name 'base'.
- [ts Error] Line 309: Cannot find name 'your'.
- [ts Error] Line 309: Cannot find name 'SEARCH'.
- [ts Error] Line 309: Cannot find name 'REPLACE'.
- [ts Error] Line 309: Cannot find name 'operations'.
- [ts Error] Line 309: Cannot find name 'on'.
- [ts Error] Line 309: Cannot find name 'final'.
- [ts Error] Line 309: Cannot find name 'version'.
- [ts Error] Line 309: Cannot find name 'to'.
- [ts Error] Line 309: Cannot find name 'ensure'.
- [ts Error] Line 309: Cannot find name 'accuracy'.
- [ts Error] Line 311: Cannot find name 'environment_details'.
- [ts Error] Line 312: Cannot find name 'Visual'.
- [ts Error] Line 312: Cannot find name 'Studio'.
- [ts Error] Line 312: Cannot find name 'Code'.
- [ts Error] Line 312: Cannot find name 'Visible'.
- [ts Error] Line 312: Cannot find name 'Files'.
- [ts Error] Line 313: Cannot find name 'app'.
- [ts Error] Line 313: Cannot find name 'api'.
- [ts Error] Line 313: Cannot find name 'questions'.
- [ts Error] Line 313: Cannot find name 'bulk'.
- [ts Error] Line 313: Cannot find name 'route'.
- [ts Error] Line 315: Cannot find name 'Visual'.
- [ts Error] Line 315: Cannot find name 'Studio'.
- [ts Error] Line 315: Cannot find name 'Code'.
- [ts Error] Line 315: Cannot find name 'Open'.
- [ts Error] Line 315: Cannot find name 'Tabs'.
- [ts Error] Line 316: Cannot find name 'questions'.
- [ts Error] Line 317: Cannot find name 'app'.
- [ts Error] Line 317: Cannot find name 'students'.
- [ts Error] Line 317: Cannot find name 'create'.
- [ts Error] Line 317: Cannot find name 'page'.
- [ts Error] Line 318: Cannot find name 'app'.
- [ts Error] Line 318: Cannot find name 'api'.
- [ts Error] Line 318: Cannot find name 'users'.
- [ts Error] Line 318: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 318: Cannot find name 'id'.
- [ts Error] Line 318: Cannot find name 'route'.
- [ts Error] Line 319: Cannot find name 'app'.
- [ts Error] Line 319: Cannot find name 'question'.
- [ts Error] Line 319: Cannot find name 'paper'.
- [ts Error] Line 319: Cannot find name 'page'.
- [ts Error] Line 320: Cannot find name 'app'.
- [ts Error] Line 320: Cannot find name 'analytics'.
- [ts Error] Line 320: Cannot find name 'student'.
- [ts Error] Line 320: Cannot find name 'tag'.
- [ts Error] Line 320: Cannot find name 'report'.
- [ts Error] Line 320: Cannot find name 'excel'.
- [ts Error] Line 320: Cannot find name 'upload'.
- [ts Error] Line 320: Cannot find name 'page'.
- [ts Error] Line 321: Cannot find name 'app'.
- [ts Error] Line 321: Cannot find name 'question'.
- [ts Error] Line 321: Cannot find name 'paper'.
- [ts Error] Line 321: Cannot find name 'edit'.
- [ts Error] Line 321: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 321: Cannot find name 'id'.
- [ts Error] Line 321: Cannot find name 'page'.
- [ts Error] Line 322: Cannot find name 'app'.
- [ts Error] Line 322: Cannot find name 'api'.
- [ts Error] Line 322: Cannot find name 'question'.
- [ts Error] Line 322: Cannot find name 'papers'.
- [ts Error] Line 322: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 322: Cannot find name 'id'.
- [ts Error] Line 322: Cannot find name 'route'.
- [ts Error] Line 323: Cannot find name 'lib'.
- [ts Error] Line 323: Cannot find name 'db'.
- [ts Error] Line 323: Cannot find name 'tenant'.
- [ts Error] Line 324: Cannot find name 'app'.
- [ts Error] Line 324: Cannot find name 'api'.
- [ts Error] Line 324: Cannot find name 'tags'.
- [ts Error] Line 324: Cannot find name 'route'.
- [ts Error] Line 325: Cannot find name 'app'.
- [ts Error] Line 325: Cannot find name 'api'.
- [ts Error] Line 325: Cannot find name 'tags'.
- [ts Error] Line 325: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 325: Cannot find name 'id'.
- [ts Error] Line 325: Cannot find name 'route'.
- [ts Error] Line 326: Cannot find name 'app'.
- [ts Error] Line 326: Cannot find name 'api'.
- [ts Error] Line 326: Cannot find name 'tag'.
- [ts Error] Line 326: Cannot find name 'types'.
- [ts Error] Line 326: Cannot find name 'route'.
- [ts Error] Line 327: Cannot find name 'app'.
- [ts Error] Line 327: Cannot find name 'api'.
- [ts Error] Line 327: Cannot find name 'tag'.
- [ts Error] Line 327: Cannot find name 'types'.
- [ts Error] Line 327: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 327: Cannot find name 'id'.
- [ts Error] Line 327: Cannot find name 'route'.
- [ts Error] Line 328: Cannot find name 'app'.
- [ts Error] Line 328: Cannot find name 'tags'.
- [ts Error] Line 328: Cannot find name 'create'.
- [ts Error] Line 328: Cannot find name 'page'.
- [ts Error] Line 329: Cannot find name 'app'.
- [ts Error] Line 329: Cannot find name 'tags'.
- [ts Error] Line 329: Cannot find name 'edit'.
- [ts Error] Line 329: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 329: Cannot find name 'id'.
- [ts Error] Line 329: Cannot find name 'page'.
- [ts Error] Line 330: Cannot find name 'app'.
- [ts Error] Line 330: Cannot find name 'api'.
- [ts Error] Line 330: Cannot find name 'questions'.
- [ts Error] Line 330: Cannot find name 'route'.
- [ts Error] Line 331: Cannot find name 'app'.
- [ts Error] Line 331: Cannot find name 'questions'.
- [ts Error] Line 331: Cannot find name 'page'.
- [ts Error] Line 332: Cannot find name 'components'.
- [ts Error] Line 332: Cannot find name 'QuestionFilterPopup'.
- [ts Error] Line 333: Cannot find name 'components'.
- [ts Error] Line 333: Cannot find name 'QuestionPaperForm'.
- [ts Error] Line 334: Cannot find name 'components'.
- [ts Error] Line 334: Cannot find name 'analytics'.
- [ts Error] Line 334: Cannot find name 'ChartView'.
- [ts Error] Line 335: Cannot find name 'components'.
- [ts Error] Line 335: Cannot find name 'analytics'.
- [ts Error] Line 335: Cannot find name 'helpers'.
- [ts Error] Line 336: Cannot find name 'components'.
- [ts Error] Line 336: Cannot find name 'analytics'.
- [ts Error] Line 336: Cannot find name 'AnalyticsExportControls'.
- [ts Error] Line 337: Cannot find name 'lib'.
- [ts Error] Line 337: Cannot find name 'validation'.
- [ts Error] Line 338: Cannot find name 'middleware'.
- [ts Error] Line 339: Cannot find name 'app'.
- [ts Error] Line 339: Cannot find name 'api'.
- [ts Error] Line 339: Cannot find name 'analytics'.
- [ts Error] Line 339: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 339: Cannot find name 'tag'.
- [ts Error] Line 339: Cannot find name 'report'.
- [ts Error] Line 339: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 339: Cannot find name 'paperId'.
- [ts Error] Line 339: Cannot find name 'route'.
- [ts Error] Line 340: Cannot find name 'app'.
- [ts Error] Line 340: Cannot find name 'api'.
- [ts Error] Line 340: Cannot find name 'analytics'.
- [ts Error] Line 340: Cannot find name 'student'.
- [ts Error] Line 340: Cannot find name 'tag'.
- [ts Error] Line 340: Cannot find name 'report'.
- [ts Error] Line 340: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 340: Cannot find name 'responseId'.
- [ts Error] Line 340: Cannot find name 'route'.
- [ts Error] Line 341: Cannot find name 'app'.
- [ts Error] Line 341: Cannot find name 'analytics'.
- [ts Error] Line 341: Cannot find name 'student'.
- [ts Error] Line 341: Cannot find name 'tag'.
- [ts Error] Line 341: Cannot find name 'report'.
- [ts Error] Line 341: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 341: Cannot find name 'responseId'.
- [ts Error] Line 341: Cannot find name 'page'.
- [ts Error] Line 342: Cannot find name 'app'.
- [ts Error] Line 342: Cannot find name 'analytics'.
- [ts Error] Line 342: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 342: Cannot find name 'tag'.
- [ts Error] Line 342: Cannot find name 'report'.
- [ts Error] Line 342: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
- [ts Error] Line 342: Cannot find name 'paperId'.
- [ts Error] Line 342: Cannot find name 'page'.
- [ts Error] Line 343: Cannot find name 'components'.
- [ts Error] Line 343: Cannot find name 'analytics'.
- [ts Error] Line 343: Cannot find name 'StatsTable'.
- [ts Error] Line 344: Cannot find name 'components'.
- [ts Error] Line 344: Cannot find name 'analytics'.
- [ts Error] Line 344: Cannot find name 'QuestionListModal'.
- [ts Error] Line 345: Cannot find name 'app'.
- [ts Error] Line 345: Cannot find name 'api'.
- [ts Error] Line 345: Cannot find name 'admin'.
- [ts Error] Line 345: Cannot find name 'migrate'.
- [ts Error] Line 345: Cannot find name 'route'.
- [ts Error] Line 346: Cannot find name 'app'.
- [ts Error] Line 346: Cannot find name 'api'.
- [ts Error] Line 346: Cannot find name 'admin'.
- [ts Error] Line 346: Cannot find name 'reindex'.
- [ts Error] Line 346: Cannot find name 'route'.
- [ts Error] Line 347: Cannot find name 'app'.
- [ts Error] Line 347: Cannot find name 'api'.
- [ts Error] Line 347: Cannot find name 'debug'.
- [ts Error] Line 347: Cannot find name 'db'.
- [ts Error] Line 347: Cannot find name 'route'.
- [ts Error] Line 348: Cannot find name 'app'.
- [ts Error] Line 348: Cannot find name 'api'.
- [ts Error] Line 348: Cannot find name 'schools'.
- [ts Error] Line 348: Cannot find name 'route'.
- [ts Error] Line 349: Cannot find name 'scripts'.
- [ts Error] Line 349: Cannot find name 'build'.
- [ts Error] Line 349: Cannot find name 'tenant'.
- [ts Error] Line 349: Cannot find name 'indexes'.
- [ts Error] Line 350: Cannot find name 'app'.
- [ts Error] Line 350: Cannot find name 'api'.
- [ts Error] Line 350: Cannot find name 'questions'.
- [ts Error] Line 350: Cannot find name 'bulk'.
- [ts Error] Line 350: Cannot find name 'route'.
- [ts Error] Line 351: Cannot find name 'app'.
- [ts Error] Line 351: Cannot find name 'api'.
- [ts Error] Line 351: Cannot find name 'question'.
- [ts Error] Line 351: Cannot find name 'papers'.
- [ts Error] Line 351: Cannot find name 'route'.
- [ts Error] Line 352: Cannot find name 'components'.
- [ts Error] Line 352: Cannot find name 'PaperDetailsForm'.
- [ts Error] Line 353: Cannot find name 'components'.
- [ts Error] Line 353: Cannot find name 'analytics'.
- [ts Error] Line 353: Cannot find name 'OptionTagModal'.
- [ts Error] Line 355: Cannot find name 'Recently'.
- [ts Error] Line 355: Cannot find name 'Modified'.
- [ts Error] Line 355: Cannot find name 'Files'.
- [ts Error] Line 356: Cannot find name 'These'.
- [ts Error] Line 356: Cannot find name 'files'.
- [ts Error] Line 356: Cannot find name 'have'.
- [ts Error] Line 356: Cannot find name 'been'.
- [ts Error] Line 356: Cannot find name 'modified'.
- [ts Error] Line 356: Cannot find name 'since'.
- [ts Error] Line 356: Cannot find name 'you'.
- [ts Error] Line 356: Cannot find name 'last'.
- [ts Error] Line 356: Cannot find name 'accessed'.
- [ts Error] Line 356: Cannot find name 'them'.
- [ts Error] Line 356: Cannot find name 'file'.
- [ts Error] Line 356: Cannot find name 'was'.
- [ts Error] Line 356: Cannot find name 'just'.
- [ts Error] Line 356: Cannot find name 'edited'.
- [ts Error] Line 356: Cannot find name 'so'.
- [ts Error] Line 356: Cannot find name 'you'.
- [ts Error] Line 356: Cannot find name 'may'.
- [ts Error] Line 356: Cannot find name 'need'.
- [ts Error] Line 356: Cannot find name 'to'.
- [ts Error] Line 356: Cannot find name 're'.
- [ts Error] Line 356: Cannot find name 'read'.
- [ts Error] Line 356: Cannot find name 'it'. Do you need to install type definitions for a test runner? Try `npm i --save-dev @types/jest` or `npm i --save-dev @types/mocha`.
- [ts Error] Line 356: Cannot find name 'before'.
- [ts Error] Line 356: Cannot find name 'editing'.
- [ts Error] Line 357: Cannot find name 'app'.
- [ts Error] Line 357: Cannot find name 'api'.
- [ts Error] Line 357: Cannot find name 'questions'.
- [ts Error] Line 357: Cannot find name 'bulk'.
- [ts Error] Line 357: Cannot find name 'route'.
- [ts Error] Line 359: Cannot find name 'Current'.
- [ts Error] Line 359: Cannot find name 'Time'.
- [ts Error] Line 360: Left side of comma operator is unused and has no side effects.
- [ts Error] Line 360: Cannot find name 'AM'.
- [ts Error] Line 360: Cannot find name 'Asia'.
- [ts Error] Line 360: Cannot find name 'Calcutta'.
- [ts Error] Line 360: Cannot find name 'UTC'.
- [ts Error] Line 362: Cannot find name 'Context'.
- [ts Error] Line 362: Cannot find name 'Usage'.
- [ts Error] Line 363: Left side of comma operator is unused and has no side effects.
- [ts Error] Line 363: Cannot find name 'K'.
- [ts Error] Line 363: Cannot find name 'tokens'.
- [ts Error] Line 363: Cannot find name 'used'.
- [ts Error] Line 365: Cannot find name 'Current'.
- [ts Error] Line 365: Cannot find name 'Mode'.
- [ts Error] Line 366: Cannot find name 'ACT'.
- [ts Error] Line 366: Cannot find name 'MODE'.<environment_details>
# Visual Studio Code Visible Files
app/api/questions/bulk/route.ts

# Visual Studio Code Open Tabs
../questions (6).json
app/students/create/page.tsx
app/api/users/[id]/route.ts
app/question-paper/page.tsx
app/analytics/student-tag-report/excel-upload/page.tsx
app/question-paper/edit/[id]/page.tsx
app/api/question-papers/[id]/route.ts
lib/db-tenant.ts
app/api/tags/route.ts
app/api/tags/[id]/route.ts
app/api/tag-types/route.ts
app/api/tag-types/[id]/route.ts
app/tags/create/page.tsx
app/tags/edit/[id]/page.tsx
app/api/questions/route.ts
app/questions/page.tsx
components/QuestionFilterPopup.tsx
components/QuestionPaperForm.tsx
components/analytics/ChartView.tsx
components/analytics/helpers.tsx
components/analytics/AnalyticsExportControls.tsx
lib/validation.ts
middleware.ts
app/api/analytics/class-tag-report/[paperId]/route.ts
app/api/analytics/student-tag-report/[responseId]/route.ts
app/analytics/student-tag-report/[responseId]/page.tsx
app/analytics/class-tag-report/[paperId]/page.tsx
components/analytics/StatsTable.tsx
components/analytics/QuestionListModal.tsx
app/api/admin/migrate/route.ts
app/api/admin/reindex/route.ts
app/api/debug/db/route.ts
app/api/schools/route.ts
scripts/build-tenant-indexes.ts
app/subject/page.tsx
app/api/question-papers/route.ts
components/PaperDetailsForm.tsx
components/analytics/OptionTagModal.tsx
app/api/questions/bulk/route.ts

# Recently Modified Files
These files have been modified since you last accessed them (file was just edited so you may need to re-read it before editing):
app/api/questions/bulk/route.ts

# Current Time
2/13/2026, 3:04:46 AM (Asia/Calcutta, UTC+5.5:00)

# Context Window Usage
92,196 / 128K tokens used (72%)

# Current Mode
ACT MODE
</environment_details>