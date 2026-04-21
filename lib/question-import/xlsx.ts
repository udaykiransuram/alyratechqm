import { randomUUID } from "crypto";

import * as XLSX from "xlsx";

import {
  appendQuestionImportMetadataTagPair,
  createEmptyQuestionImportMetadata,
  getQuestionImportDiagnosticTagLabel,
  normalizeQuestionImportDiagnosticTagType,
  QUESTION_IMPORT_DIAGNOSTIC_TAGS,
} from "@/lib/question-import/diagnostic-tags";
import { syncQuestionImportMappings } from "@/lib/question-import/review";
import { QUESTION_IMPORT_TEMPLATE_VERSION } from "@/lib/question-import/template";
import type {
  QuestionImportDraftPayload,
  QuestionImportPaperSectionDraft,
  QuestionImportQuestionDraft,
  QuestionImportQuestionType,
} from "@/lib/question-import/types";

const WORKBOOK_SHEET_NAME = "Questions";
const WORKBOOK_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeHeaderKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[_\s/]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugify(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripExtension(fileName: string) {
  return normalizeText(fileName).replace(/\.[a-z0-9]+$/i, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isProbablyHtml(value: string) {
  return /<[^>]+>/.test(value);
}

function textToHtml(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }

  if (isProbablyHtml(normalized)) {
    return normalized;
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) =>
      `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    );

  return paragraphs.join("");
}

function toPositiveNumber(value: unknown, fallback: number, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, parsed);
}

function toDateToken(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return undefined;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeQuestionType(value: unknown): QuestionImportQuestionType {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "multiple" || normalized === "descriptive") {
    return normalized;
  }
  return "single";
}

function parseCorrectAnswerIndexes(value: unknown) {
  const normalized = normalizeText(value)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/;/g, ",");

  if (!normalized) {
    return [];
  }

  return Array.from(
    new Set(
      normalized
        .split(",")
        .filter(Boolean)
        .flatMap((item) => item.split("")),
    ),
  )
    .filter((letter) => /^[A-E]$/.test(letter))
    .map((letter) => letter.charCodeAt(0) - 65);
}

function parseTagPairs(value: unknown) {
  return normalizeText(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex === -1) {
        return null;
      }

      const type = normalizeText(item.slice(0, separatorIndex));
      const tagValue = normalizeText(item.slice(separatorIndex + 1));
      if (!type || !tagValue) {
        return null;
      }

      return {
        type,
        value: tagValue,
      };
    })
    .filter(Boolean) as Array<{ type: string; value: string }>;
}

function buildNormalizedRowLookup(row: Record<string, unknown>) {
  const lookup = new Map<string, unknown>();
  Object.entries(row || {}).forEach(([header, value]) => {
    const key = normalizeHeaderKey(header);
    if (!key || lookup.has(key)) {
      return;
    }
    lookup.set(key, value);
  });
  return lookup;
}

function getRowValue(
  rowLookup: Map<string, unknown>,
  aliases: string[],
) {
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeaderKey(alias);
    if (normalizedAlias && rowLookup.has(normalizedAlias)) {
      return rowLookup.get(normalizedAlias);
    }
  }
  return "";
}

const STATIC_WORKBOOK_HEADERS = [
  "Paper Title",
  "Class",
  "Duration (minutes)",
  "Passing Marks",
  "Exam Date",
  "Paper Instructions",
  "Section Name",
  "Section Subject",
  "Section Default Marks",
  "Section Default Negative Marks",
  "Section Description",
  "Section Instructions",
  "Question Number",
  "Question Type",
  "Subject",
  "Marks",
  "Negative Marks",
  "Question",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Option E",
  "Correct (letter)",
  "Explanation",
] as const;

export const DIAGNOSTIC_QUESTION_WORKBOOK_HEADERS = [
  ...STATIC_WORKBOOK_HEADERS,
  ...QUESTION_IMPORT_DIAGNOSTIC_TAGS.map((config) =>
    getQuestionImportDiagnosticTagLabel(config.type),
  ),
  "Additional Tags",
] as const;

export function isSupportedQuestionImportWorkbookMimeType(value: unknown) {
  return normalizeText(value).toLowerCase() === WORKBOOK_MIME_TYPE;
}

export function buildDiagnosticQuestionWorkbookBuffer(params: {
  rows: Array<Record<string, unknown>>;
}) {
  const providedRows = Array.isArray(params.rows) ? params.rows : [];
  const extraHeaders = Array.from(
    new Set(
      providedRows.flatMap((row) => Object.keys(row || {})).filter(Boolean),
    ),
  ).filter(
    (header) =>
      !DIAGNOSTIC_QUESTION_WORKBOOK_HEADERS.some(
        (knownHeader) =>
          normalizeHeaderKey(knownHeader) === normalizeHeaderKey(header),
      ),
  );

  const worksheet = XLSX.utils.json_to_sheet(providedRows, {
    header: [...DIAGNOSTIC_QUESTION_WORKBOOK_HEADERS, ...extraHeaders],
    skipHeader: false,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, WORKBOOK_SHEET_NAME);

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}

export function buildDiagnosticQuestionWorkbookTemplateBuffer() {
  return buildDiagnosticQuestionWorkbookBuffer({
    rows: [
      {
        "Paper Title": "Class 7 Foundations Intake",
        Class: "Class 7",
        "Duration (minutes)": 60,
        "Passing Marks": 24,
        "Exam Date": "2026-04-15",
        "Paper Instructions":
          "Students should answer every question and use rough work where needed.",
        "Section Name": "Section A",
        "Section Subject": "Mathematics",
        "Section Default Marks": 1,
        "Section Default Negative Marks": 0,
        "Section Description": "Diagnostic questions covering foundations.",
        "Section Instructions": "Choose the best answer.",
        "Question Number": "1",
        "Question Type": "single",
        Subject: "Mathematics",
        Marks: 1,
        "Negative Marks": 0,
        Question: "Compare 0.35 and 0.503 on a number line.",
        "Option A": "0.35 is greater",
        "Option B": "0.503 is greater",
        "Option C": "Both are equal",
        "Option D": "Cannot be determined",
        "Correct (letter)": "B",
        Explanation: "0.503 has 5 tenths while 0.35 has 3 tenths.",
        Topic: "Decimals",
        Subtopic: "Ordering decimals",
        Subskill: "Compare decimals by place value",
        Competency: "Understanding",
        Process: "Interpret",
        Prerequisite: "Place value",
        "Representation Mode": "number-line",
        "Conceptual-Procedural Load": "concept-heavy",
        "Calculation Load": "light",
        "Foundation Role": "core",
        "Time Target Sec": 60,
        "Misconception Family": "whole-number-reading",
        "Option A Misconception": "Reads 35 as larger than 503",
        "Additional Tags": "context=pure | estimation-sense-check=compare magnitude",
      },
    ],
  });
}

function buildQuestionOptions(rowLookup: Map<string, unknown>) {
  const optionHeaders = ["A", "B", "C", "D", "E"] as const;
  return optionHeaders
    .map((optionKey, index) => {
      const value = normalizeText(getRowValue(rowLookup, [`Option ${optionKey}`]));
      if (!value) {
        return null;
      }

      return {
        id: `option-${optionKey.toLowerCase()}-${index + 1}-${randomUUID().slice(0, 6)}`,
        key: optionKey,
        contentHtml: textToHtml(value),
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    key: string;
    contentHtml: string;
  }>;
}

function buildSectionDraft(params: {
  rowLookup: Map<string, unknown>;
  order: number;
  sectionId: string;
  sectionName: string;
}): QuestionImportPaperSectionDraft {
  return {
    id: params.sectionId,
    order: params.order,
    name: params.sectionName,
    descriptionHtml: textToHtml(
      getRowValue(params.rowLookup, ["Section Description"]),
    ),
    instructionsHtml: textToHtml(
      getRowValue(params.rowLookup, ["Section Instructions"]),
    ),
    subjectToken: normalizeText(
      getRowValue(params.rowLookup, ["Section Subject"]),
    ),
    defaultMarks: toPositiveNumber(
      getRowValue(params.rowLookup, ["Section Default Marks"]),
      1,
      1,
    ),
    defaultNegativeMarks: toPositiveNumber(
      getRowValue(params.rowLookup, ["Section Default Negative Marks"]),
      0,
      0,
    ),
  };
}

function buildQuestionDraft(params: {
  row: Record<string, unknown>;
  rowLookup: Map<string, unknown>;
  rowIndex: number;
  section: QuestionImportPaperSectionDraft;
}): QuestionImportQuestionDraft {
  const metadata = createEmptyQuestionImportMetadata();
  const rowEntries = Object.entries(params.row || {});

  rowEntries.forEach(([header, value]) => {
    const normalizedType = normalizeQuestionImportDiagnosticTagType(header);
    if (!normalizedType || !normalizeText(value)) {
      return;
    }

    appendQuestionImportMetadataTagPair(metadata, {
      type: normalizedType,
      value: normalizeText(value),
    });
  });

  parseTagPairs(
    getRowValue(params.rowLookup, ["Additional Tags", "Tags"]),
  ).forEach((pair) => appendQuestionImportMetadataTagPair(metadata, pair));

  const type = normalizeQuestionType(
    getRowValue(params.rowLookup, ["Question Type", "Type"]),
  );
  const options = buildQuestionOptions(params.rowLookup);

  return {
    id: `question-${params.rowIndex + 1}`,
    order: params.rowIndex,
    numberLabel:
      normalizeText(getRowValue(params.rowLookup, ["Question Number"])) ||
      String(params.rowIndex + 1),
    sectionId: params.section.id,
    approvalStatus: "pending_review",
    type,
    subjectToken:
      normalizeText(getRowValue(params.rowLookup, ["Subject"])) ||
      normalizeText(params.section.subjectToken),
    marks: toPositiveNumber(
      getRowValue(params.rowLookup, ["Marks"]),
      params.section.defaultMarks || 1,
      1,
    ),
    negativeMarks: toPositiveNumber(
      getRowValue(params.rowLookup, ["Negative Marks"]),
      params.section.defaultNegativeMarks || 0,
      0,
    ),
    contentHtml: textToHtml(getRowValue(params.rowLookup, ["Question", "Stem"])),
    options,
    answerIndexes:
      type === "descriptive"
        ? []
        : parseCorrectAnswerIndexes(
            getRowValue(params.rowLookup, ["Correct (letter)", "Correct Answer"]),
          ),
    explanationHtml: textToHtml(getRowValue(params.rowLookup, ["Explanation"])),
    metadata,
    warningIds: [],
    mathFragmentIds: [],
    imageIds: [],
  };
}

export async function parseDiagnosticQuestionWorkbook(params: {
  buffer: Buffer;
  fileName?: string;
}) {
  const workbook = XLSX.read(params.buffer, {
    type: "buffer",
    cellDates: false,
    cellText: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The uploaded workbook does not contain any sheets.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  }).filter((row) =>
    Object.values(row || {}).some((value) => normalizeText(value)),
  );

  if (rows.length === 0) {
    throw new Error("The uploaded workbook does not contain any question rows.");
  }

  const firstRowLookup = buildNormalizedRowLookup(rows[0]);
  const paperTitle =
    normalizeText(getRowValue(firstRowLookup, ["Paper Title"])) ||
    stripExtension(normalizeText(params.fileName) || "Imported Question Paper");

  const paperSections: QuestionImportPaperSectionDraft[] = [];
  const questions: QuestionImportQuestionDraft[] = [];
  const sectionIdByKey = new Map<string, string>();
  const sectionById = new Map<string, QuestionImportPaperSectionDraft>();

  rows.forEach((row, rowIndex) => {
    const rowLookup = buildNormalizedRowLookup(row);
    const sectionName =
      normalizeText(getRowValue(rowLookup, ["Section Name"])) || "Section A";
    const sectionKey = slugify(sectionName) || `section-${paperSections.length + 1}`;
    let sectionId = sectionIdByKey.get(sectionKey);

    if (!sectionId) {
      sectionId = `section-${paperSections.length + 1}`;
      sectionIdByKey.set(sectionKey, sectionId);
      const sectionDraft = buildSectionDraft({
        rowLookup,
        order: paperSections.length,
        sectionId,
        sectionName,
      });
      paperSections.push(sectionDraft);
      sectionById.set(sectionId, sectionDraft);
    }

    const section = sectionById.get(sectionId);
    if (!section) {
      return;
    }

    questions.push(
      buildQuestionDraft({
        row,
        rowLookup,
        rowIndex,
        section,
      }),
    );
  });

  const payload: QuestionImportDraftPayload = {
    templateVersion: QUESTION_IMPORT_TEMPLATE_VERSION,
    paper: {
      title: paperTitle,
      instructionsHtml: textToHtml(
        getRowValue(firstRowLookup, ["Paper Instructions"]),
      ),
      classToken: normalizeText(getRowValue(firstRowLookup, ["Class"])),
      classId: "",
      durationMinutes: toPositiveNumber(
        getRowValue(firstRowLookup, ["Duration (minutes)", "Duration"]),
        60,
        1,
      ),
      passingMarks: toPositiveNumber(
        getRowValue(firstRowLookup, ["Passing Marks"]),
        0,
        0,
      ),
      examDate: toDateToken(getRowValue(firstRowLookup, ["Exam Date"])),
      onlineEnabled: false,
      academicSectionAssignmentMode: "all",
      assignedAcademicSectionIds: [],
      academicSectionTokens: [],
    },
    paperSections,
    questions,
    images: [],
    warnings: [],
    errors: [],
    mappings: {
      subjects: [],
      academicSections: [],
    },
    mathFragments: [],
  };

  return syncQuestionImportMappings(payload);
}

