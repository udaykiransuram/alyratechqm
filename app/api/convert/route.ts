// app/api/convert/route.ts
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { NextResponse } from "next/server";
// Note: saveAs (file-saver) is a browser-only API and is not required when running in Node.js.
// The browser download line in generateWordDoc is already commented out, so we omit importing file-saver here.

export const runtime = "nodejs";

type Question = {
  subject: string;
  class: string;
  code: string;
  tags: string[];
  tagTypes: string[];
  content: string;
  explanation: string;
  marks: number;
  type: "single" | "multiple";
  options: { content: string }[];
  answerIndexes: number[];
};

type ConvertResponse = {
  questions: Question[];
  studentPaperHtml: string;
  answerKeyHtml: string;
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return json400({ error: "file is required (FormData key: 'file')" });

    // --- Parse XLSX ---
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];

    const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: 0, blankrows: false })[0];
    if (!headerRow || headerRow.length === 0) return json400({ error: "No header row found." });
    const headers = headerRow.map(String);

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    // --- Required columns (strict) ---
    const colSubject = findCol(headers, ["subject"]);
    const colClass = findCol(headers, ["class"]) ?? findCol(headers, ["grade"]);
    if (!colSubject || !colClass) return json400({ error: "Missing required columns: Subject and Class." });

    const colQuestion = findCol(headers, ["question", "text"]) ?? findCol(headers, ["question"]) ?? findCol(headers, ["stem"]);
    const colOptA = findCol(headers, ["option", "a"]);
    const colOptB = findCol(headers, ["option", "b"]);
    const colOptC = findCol(headers, ["option", "c"]);
    const colOptD = findCol(headers, ["option", "d"]);
    const colOptE = findCol(headers, ["option", "e"]);
    const colCorrectLetter =
      findCol(headers, ["correct", "letter"]) ??
      findCol(headers, ["correct option", "letter"]) ??
      findCol(headers, ["answer", "letter"]);
    const colCorrectText =
      findCol(headers, ["correct option", "text"]) ??
      findCol(headers, ["correct", "text"]) ??
      findCol(headers, ["answer", "text"]);

    if (!colQuestion) return json400({ error: "Could not locate a 'Question Text' column." });
    if (!colOptA || !colOptB || !colOptC || !colOptD) {
      return json400({ error: "Missing one or more required option columns: Option A, Option B, Option C, Option D." });
    }
    if (!colCorrectLetter) return json400({ error: "Missing 'Correct Option (letter...)' column." });

    // --- Build canonical tagTypes from headers (minus subject/class/code); strip () and kebab-case; dedup ---
    const EXCLUDE_FROM_TAGS = new Set(["subject", "class", "code"]);
    const canonicalTagTypesBase = uniqueify(
      headers
        .map((h) => normalizeHeader(h))
        .filter((t) => t && !EXCLUDE_FROM_TAGS.has(t))
    );

    // --- Process rows ---
    const ansMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
    const questions: Question[] = [];

    // Optional uniformity gate: ensure all rows share the same subject/class
    const firstSubject = String(rows[0]?.[colSubject] ?? "").trim();
    const firstClass = String(rows[0]?.[colClass] ?? "").trim();
    const uniformViolations: number[] = [];

    const fileName = file?.name || "test";
    const baseTestId = fileName.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_").toLowerCase().slice(0, 20); // limit to 20 chars
    const shortUnique = Math.floor(Date.now() % 1e6).toString().padStart(6, "0"); // 6-digit suffix
    const testId = `${baseTestId}_${shortUnique}`;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const rowNum = r + 2;

      // Subject/Class strict
      const subjectRaw = String(row[colSubject] ?? "").trim();
      const classRaw = String(row[colClass] ?? "").trim();
      if (!subjectRaw) return json400({ error: `Row ${rowNum}: Subject is blank.` });
      if (!classRaw) return json400({ error: `Row ${rowNum}: Class is blank.` });

      const subjectNorm = normalizeSubjectStrict(subjectRaw);
      if (!subjectNorm) return json400({ error: `Row ${rowNum}: Subject '${subjectRaw}' is not allowed.` });

      const classNum = extractClassNumberStrict(classRaw);
      if (!classNum) return json400({ error: `Row ${rowNum}: Class '${classRaw}' is invalid. Use 1–12, 'Class 7', or Roman (I–XII).` });

      if (subjectRaw !== firstSubject || classRaw !== firstClass) uniformViolations.push(rowNum);

      // Derive code (enforced)
      const derivedCode = `${subjectNorm.abbrev}${classNum}`.toLowerCase();

      // Core content
      const qText = String(row[colQuestion] ?? "").trim();
      if (!qText) return json400({ error: `Row ${rowNum}: Question Text is blank.` });

      // Options (A–D required; E optional)
      const a = ensureOptionStrict(String(row[colOptA] ?? "").trim());
      const b = ensureOptionStrict(String(row[colOptB] ?? "").trim());
      const c = ensureOptionStrict(String(row[colOptC] ?? "").trim());
      const d = ensureOptionStrict(String(row[colOptD] ?? "").trim());
      const e = ensureOptionStrict(
        colOptE !== null && colOptE !== undefined
          ? String(row[colOptE] ?? "").trim()
          : "Spelling/notation variant causing plausible confusion (incorrect)"
      );

      const options = [
        { content: a },
        { content: b },
        { content: c },
        { content: d }
      ];

      if (colOptE !== null && colOptE !== undefined) {
        const eRaw = String(row[colOptE] ?? "").trim();
        if (eRaw) {
          options.push({ content: ensureOptionStrict(eRaw) });
        }
      }

      // Answers
      const lettersRaw = String(row[colCorrectLetter] ?? "").trim().toUpperCase();
      const letters = parseAnswerLetters(lettersRaw);
      if (!letters.length) return json400({ error: `Row ${rowNum}: Correct option letter(s) invalid or empty (expected A–E).` });

      const answerIndexes = letters.map((L) => ansMap[L]).filter((x) => x !== undefined);
      if (!answerIndexes.length) return json400({ error: `Row ${rowNum}: Could not resolve any valid answer indices from '${lettersRaw}'.` });
      const qType: "single" | "multiple" = answerIndexes.length > 1 ? "multiple" : "single";

      // Explanation
      const correctText =
        colCorrectText && row[colCorrectText] !== undefined
          ? String(row[colCorrectText]).trim()
          : "";
      const finalCorrectText = correctText || deriveCorrectTextFromOptions(options, answerIndexes);
      const explanationHTML = buildExplanationHTML(correctText, options, answerIndexes);

      // 1) Align tags to canonical (from headers minus subject/class/code)
      const alignedValues = buildTagsAlignedToCanonical(row, headers, canonicalTagTypesBase);

      // 2) Prune pairs with empty tagTypes/values and any "not specified"
      const pruned = pruneTagPairs(canonicalTagTypesBase, alignedValues, {
        dropEmptyTypes: true,
        dropEmptyValues: true,
        dropNotSpecified: true
      });

      // 3) Append option-level rationales (ALWAYS included, not pruned)
      const optionTagTypes = ["option a", "option b", "option c", "option d"];
      const rationales = [
        "option a: plausible misconception based on surface similarity",
        "option b: correct reasoning aligned to expected method",
        "option c: overgeneralization of rule/procedure",
        "option d: magnitude/operation misapplication"
      ];

      if (options.length === 5) {
        optionTagTypes.push("option e");
        rationales.push("option e: notation/spelling near-miss");
      }

      const finalTagTypes = [...pruned.tagTypes, ...optionTagTypes, "testid"];
      const finalTags = [...pruned.tags, ...rationales, testId];

      const contentHTML = escapeHtml(qText);

      questions.push({
        subject: subjectNorm.label.toLowerCase(),
        class: `class ${classNum}`,
        code: derivedCode,
        tags: finalTags,
        tagTypes: finalTagTypes,
        content: contentHTML,
        explanation: explanationHTML,
        marks: 1,
        type: qType,
        options,
        answerIndexes
      });
    }

    if (uniformViolations.length) {
      return json400({
        error: `Uniformity error: Subject/Class must be identical across the sheet. Offending rows: ${uniformViolations.join(", ")}.`
      });
    }

    const payload: ConvertResponse & { testId: string } = {
  questions,
      studentPaperHtml: renderStudentPaperHtml(questions),
      answerKeyHtml: renderAnswerKeyHtml(questions),
  testId
};

    // Generate Word document
    await generateWordDoc(questions);

    const { searchParams } = new URL(req.url);
    const isExcel = searchParams.get("excel") === "1";
    const isWord = searchParams.get("word") === "1";

    if (isWord) {
      // Generate Word document and return as download
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "Diagnostic Test",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: `Subject: ${questions[0]?.subject ?? ""}    Class: ${questions[0]?.class ?? ""}`,
              heading: HeadingLevel.HEADING_3,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: "Instructions: Choose the best option. Section B may have multiple correct answers.",
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              text: "Section A: Single Correct",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({ text: "" }), // <-- Add this line for space after section A heading
            ...questions.filter(q => q.type === "single").flatMap((q, idx) => questionToParagraph(q, idx + 1)),
            new Paragraph({
              text: "Section B: Multiple Correct",
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({ text: "" }), // <-- Add this line for space after section B heading
            ...questions.filter(q => q.type === "multiple").flatMap((q, idx, arr) => questionToParagraph(q, idx + 1 + questions.filter(q => q.type === "single").length)),
            new Paragraph({
              border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } },
              spacing: { after: 120 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "End of Paper", italics: true, size: 18 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 240 },
            }),
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": "attachment; filename=question_paper.docx"
        }
      });
    } else if (isExcel) {
      // Generate Excel file
      const wbout = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(wbout, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "attachment; filename=questions.xlsx"
        }
      });
    } else {
      return NextResponse.json(payload);
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Internal error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}

/* ---------------- helpers ---------------- */

function json400(obj: any) {
  return new Response(JSON.stringify(obj), { status: 400, headers: { "content-type": "application/json" } });
}

// Remove pairs where tagType is blank OR value is blank/"not specified"
function pruneTagPairs(
  tagTypes: string[],
  tags: string[],
  opts: { dropEmptyTypes: boolean; dropEmptyValues: boolean; dropNotSpecified: boolean }
): { tagTypes: string[]; tags: string[] } {
  const outT: string[] = [];
  const outV: string[] = [];
  const n = Math.min(tagTypes.length, tags.length);

  for (let i = 0; i < n; i++) {
    const t = String(tagTypes[i] ?? "").trim();
    const v = String(tags[i] ?? "").trim();
    const isEmptyType = !t;
    const isEmptyValue = !v || (opts.dropNotSpecified && v.toLowerCase() === "not specified");
    if ((opts.dropEmptyTypes && isEmptyType) || (opts.dropEmptyValues && isEmptyValue)) continue;
    outT.push(t);
    outV.push(v);
  }
  return { tagTypes: outT, tags: outV };
}

// Fuzzy header finder: first header containing ALL tokens (case-insensitive)
function findCol(headers: string[], tokens: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (let i = 0; i < headers.length; i++) {
    const hed = lower[i];
    if (tokens.every((tk) => hed.includes(tk))) return headers[i];
  }
  return null;
}

// Normalize header -> tagType: strip (...) blocks, kebab-case, trim hyphens.
function normalizeHeader(h: string): string {
  const noBrackets = String(h ?? "").replace(/\(.*?\)/g, "");
  return noBrackets
    .trim()
    .toLowerCase()
    .replace(/[\/\s]+/g, "-")
    .replace(/[^a-z0-9\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Deduplicate tagTypes with numeric suffixes
function uniqueify(arr: string[]): string[] {
  const seen = new Map<string, number>();
  return arr.map((t) => {
    if (!seen.has(t)) {
      seen.set(t, 1);
      return t;
    }
    const n = (seen.get(t) || 1) + 1;
    seen.set(t, n);
    return `${t}-${n}`;
  });
}

// Align row values to canonicalTagTypes (by normalized header names)
function buildTagsAlignedToCanonical(
  row: Record<string, unknown>,
  headers: string[],
  canonicalTagTypesBase: string[]
): string[] {
  const normPairs: Array<[string, string]> = headers.map((h) => [normalizeHeader(h), normValue(row[h])]);

  const dupCount: Record<string, number> = {};
  const valueMap = new Map<string, string>();

  for (const [baseTag, val] of normPairs) {
    const count = (dupCount[baseTag] || 0) + 1;
    dupCount[baseTag] = count;
    const tagKey = count === 1 ? baseTag : `${baseTag}-${count}`;
    valueMap.set(tagKey, val);
  }

  return canonicalTagTypesBase.map((t) => (valueMap.has(t) ? valueMap.get(t)! : "not specified"));
}

function normValue(v: unknown, missing = "not specified"): string {
  if (v === null || v === undefined) return missing;
  const s = String(v).trim();
  return s === "" ? missing : s;
}

function ensureOptionStrict(s: string): string {
  const x = String(s ?? "").trim();
  if (!x) return "—"; // visible placeholder if empty
  // ≥15 chars OR math span to ensure meaningfulness
  if (x.length >= 15 || x.includes("\\(") || x.includes("\\frac") || x.includes("\\sqrt")) return x;
  return x + " "; // nudge length (or raise error if you prefer)
}

function parseAnswerLetters(raw: string): string[] {
  if (!raw) return [];
  const letters = raw.replace(/[^A-E]/gi, "").toUpperCase();
  const set = new Set<string>();
  for (const ch of letters) if (/[A-E]/.test(ch)) set.add(ch);
  return Array.from(set);
}

function deriveCorrectTextFromOptions(options: { content: string }[], idxs: number[]): string {
  if (!idxs.length) return "not specified";
  return idxs.map((i) => options[i]?.content ?? "").filter(Boolean).join(", ") || "not specified";
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildExplanationHTML(correctText: string, options: { content: string }[], answerIndexes: number[]): string {
  const correctLetters = answerIndexes.map((i) => String.fromCharCode(65 + i)).join(", ");
  const distractors = options
    .map((o, i) => (answerIndexes.includes(i) ? null : `<li><b>${String.fromCharCode(65 + i)}.</b> ${escapeHtml(o.content)}</li>`))
    .filter(Boolean)
    .join("");
  return `<p>Correct option(s): ${escapeHtml(correctLetters)} — ${escapeHtml(correctText)}</p>${
    distractors ? `<p>Other options:</p><ul>${distractors}</ul>` : ""
  }`;
}

function renderStudentPaperHtml(qs: Question[]): string {
  const singles = qs.filter((q) => q.type === "single");
  const multiples = qs.filter((q) => q.type === "multiple");

  let idx = 1;
  const renderBlock = (items: Question[]) =>
    items
      .map((q) => {
        const opts = q.options
          .map(
            (o, i) =>
              `<div style="display: flex; align-items: flex-start; font-size:11px; margin-bottom:2px;">
                <span style="font-weight:bold; margin-right:2px;">${String.fromCharCode(65 + i)}.</span>
                <span>${escapeHtml(String(o.content))}</span>
              </div>`
          )
          .join("");
        return `<div class="q" style="margin-bottom:7px;">
          <div style="display: flex; align-items: flex-start; font-size:11.5px; margin-bottom:2px;">
            <span style="font-weight:bold; margin-right:4px;">Q${idx++}.</span>
            <span>${q.content}</span>
          </div>
          ${opts}
        </div>`;
      })
      .join("");

  const s = qs[0]?.subject || "not specified";
  const c = qs[0]?.class || "not specified";
  const head = `
    <div style="text-align:center; margin-bottom:12px;">
      <h1 style="margin:0; font-size:1.3em;">Diagnostic Test</h1>
      <h3 style="margin:6px 0 0 0; font-weight:normal; font-size:1em;">Subject: <span style="font-weight:bold;">${escapeHtml(s)}</span> &nbsp;|&nbsp; Class: <span style="font-weight:bold;">${escapeHtml(c)}</span></h3>
      <p style="margin:8px 0 0 0; font-size:10.5px;">Instructions: Choose the best option. Section B may have multiple correct answers.</p>
    </div>
  `;

  return `<html>
  <head>
    <meta charset="UTF-8" />
    <title>Diagnostic Test</title>
    <style>
      @media print {
        body { margin: 0; }
      }
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        background: #fff;
        color: #222;
        margin: 14px;
        font-size: 11.5px;
        max-width: 700px;
      }
      h1, h2, h3 { text-align: center; }
      .section-title {
        margin: 14px 0 6px 0;
        font-size: 1.05em;
        border-bottom: 1px solid #ccc;
        padding-bottom: 2px;
      }
      .q { margin-bottom: 7px; }
    </style>
  </head>
  <body>
    ${head}
    <div class="section-title">Section A: Single Correct</div>
    ${renderBlock(singles)}
    <div class="section-title">Section B: Multiple Correct</div>
    ${renderBlock(multiples)}
    <div style="margin-top: 14px; font-size: 10px; color: #666; text-align: center;">
      <em>End of Paper</em>
    </div>
  </body>
</html>`;
}

function renderAnswerKeyHtml(qs: Question[]): string {
  let n = 1;
  const rows = qs
    .map((q) => {
      const letters = q.answerIndexes.map((i) => String.fromCharCode(65 + i)).join("");
      return `<tr>
        <td>${n++}</td>
        <td>${letters}</td>
        <td>not specified</td>
        <td>not specified</td>
        <td>not specified</td>
        <td>not specified</td>
      </tr>`;
    })
    .join("");

  return `<html><body>
    <h1>Answer Key</h1>
    <table border="1" cellpadding="6">
      <thead><tr>
        <th>Q#</th><th>Correct</th><th>templateId</th><th>topic</th><th>subTopic</th><th>difficulty</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

/* ---------- strict subject/class helpers ---------- */

const SUBJECT_MAP: Record<string, { label: string; abbrev: string; synonyms: string[] }> = {
  math: { label: "math", abbrev: "math", synonyms: ["math", "mathematics", "maths"] },
  science: { label: "science", abbrev: "sci", synonyms: ["science", "general science"] },
  english: { label: "english", abbrev: "eng", synonyms: ["english"] },
  hindi: { label: "hindi", abbrev: "hin", synonyms: ["hindi"] },
  sanskrit: { label: "sanskrit", abbrev: "san", synonyms: ["sanskrit"] },
  "social science": { label: "social science", abbrev: "sst", synonyms: ["social science", "social studies", "sst"] },
  geography: { label: "geography", abbrev: "geo", synonyms: ["geography"] },
  history: { label: "history", abbrev: "his", synonyms: ["history"] },
  civics: { label: "civics", abbrev: "civ", synonyms: ["civics"] },
  "computer science": { label: "computer science", abbrev: "cs", synonyms: ["computer science", "computer", "ict"] },
  physics: { label: "physics", abbrev: "phy", synonyms: ["physics"] },
  chemistry: { label: "chemistry", abbrev: "chem", synonyms: ["chemistry"] },
  biology: { label: "biology", abbrev: "bio", synonyms: ["biology"] },
  evs: { label: "evs", abbrev: "evs", synonyms: ["evs", "environmental studies"] }
};

function normalizeSubjectStrict(raw: string): { label: string; abbrev: string } | null {
  const x = raw.toLowerCase().replace(/[^a-z ]/g, "").trim();
  for (const key of Object.keys(SUBJECT_MAP)) {
    const def = SUBJECT_MAP[key];
    if (def.synonyms.includes(x)) return { label: def.label, abbrev: def.abbrev };
  }
  return null;
}

function extractClassNumberStrict(raw: string): string | null {
  const s = (raw || "").toString().trim();
  const d = s.match(/\d+/);
  if (d) {
    const n = parseInt(d[0], 10);
    return n >= 1 && n <= 12 ? String(n) : null;
  }
  const r = s.toUpperCase().match(/\b[IVXLCM]+\b/);
  if (r) {
    const n = romanToInt(r[0]);
    if (n && n >= 1 && n <= 12) return String(n);
  }
  return null;
}

function romanToInt(r: string): number | null {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0, prev = 0;
  for (let i = r.length - 1; i >= 0; i--) {
    const val = map[r[i]];
    if (!val) return null;
    if (val < prev) total -= val; else total += val;
    prev = val;
  }
  return total;
}

// Generate Word document
async function generateWordDoc(questions: Question[], fileName = "question_paper.docx") {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "Diagnostic Test",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: `Subject: ${questions[0]?.subject ?? ""}    Class: ${questions[0]?.class ?? ""}`,
          heading: HeadingLevel.HEADING_3,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: "Instructions: Choose the best option. Section B may have multiple correct answers.",
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Section A: Single Correct",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "" }), // <-- Add this line for space after section A heading
        ...questions.filter(q => q.type === "single").flatMap((q, idx) => questionToParagraph(q, idx + 1)),
        new Paragraph({
          text: "Section B: Multiple Correct",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "" }), // <-- Add this line for space after section B heading
        ...questions.filter(q => q.type === "multiple").flatMap((q, idx, arr) => questionToParagraph(q, idx + 1 + questions.filter(q => q.type === "single").length)),
        new Paragraph({
          border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } },
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "End of Paper", italics: true, size: 18 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 240 },
        }),
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);

  // For Node.js: save to disk
  const fs = require("fs");
  fs.writeFileSync(fileName, buffer);

  // For browser: trigger download
  // saveAs(new Blob([buffer]), fileName);
}

function questionToParagraph(q: Question, idx: number) {
  // Question number and text side by side, inline
  const questionPara = new Paragraph({
    children: [
      new TextRun({ text: `Q${idx}. `, bold: true }),
      new TextRun({ text: q.content }),
    ],
    spacing: { after: 0 },
    keepNext: true,
    keepLines: true,
  });

  // Single blank line between question and options
  const spacer = new Paragraph({ text: "", spacing: { after: 0, before: 0 } });

  // Options: each as a single line, letter and text side by side, no indent
  const optionParas = q.options.map((o, i) =>
    new Paragraph({
      children: [
        new TextRun({ text: `${String.fromCharCode(65 + i)}. `, bold: true }),
        new TextRun({ text: o.content }),
      ],
      spacing: { after: 0 },
      keepLines: true,
    })
  );

  // Add a small space after each question block
  const afterSpace = new Paragraph({ text: "", spacing: { after: 120 } });

  return [
    questionPara,
    spacer,
    ...optionParas,
    afterSpace,
  ];
}
