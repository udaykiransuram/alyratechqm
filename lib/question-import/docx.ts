import { randomUUID } from "crypto";

import JSZip from "jszip";

import {
  convertOmmlNodeToLatex,
  createMathNodeHtml,
  getMathMappingTableVersion,
  normalizeLatexInput,
  renderPlainTextWithMathNodes,
} from "@/lib/question-import/math";
import { QUESTION_IMPORT_TEMPLATE_VERSION } from "@/lib/question-import/template";
import type {
  QuestionImportDraftPayload,
  QuestionImportImageAsset,
  QuestionImportMathFragment,
  QuestionImportQuestionDraft,
  QuestionImportWarning,
} from "@/lib/question-import/types";
import {
  findXmlDescendants,
  getXmlText,
  parseXml,
  type XmlElementNode,
} from "@/lib/question-import/xml";

type ParsedParagraphSegment =
  | { type: "text"; text: string }
  | {
      type: "math";
      rawSource: string;
      normalizedLatex: string;
      displayMode: boolean;
      sourceFormat: "word_omml";
      warning?: string;
    }
  | {
      type: "image";
      relationshipId: string;
      sourcePath: string;
      fileName: string;
      buffer: Buffer;
    };

type ParsedParagraph = {
  segments: ParsedParagraphSegment[];
  plainText: string;
};

type StoreDraftImageResult = {
  url: string;
  fileName: string;
};

type ParseTeacherMasterDocxInput = {
  buffer: Buffer;
  storeImage: (input: {
    buffer: Buffer;
    fileName: string;
    sourcePath: string;
  }) => Promise<StoreDraftImageResult>;
};

type RawDraftQuestion = {
  id: string;
  order: number;
  numberLabel: string;
  sectionId: string;
  type: "single" | "multiple" | "descriptive";
  subjectToken?: string;
  marks: number;
  negativeMarks: number;
  metadata: {
    difficulty?: string;
    topic?: string;
    templateId?: string;
    customTags: Array<{ type: string; value: string }>;
  };
  answerLetters: string[];
  stemParagraphs: ParsedParagraph[];
  optionParagraphs: Record<string, ParsedParagraph[]>;
  explanationParagraphs: ParsedParagraph[];
  warnings: string[];
};

type RawDraftSection = {
  id: string;
  order: number;
  name: string;
  descriptionParagraphs: ParsedParagraph[];
  instructionsParagraphs: ParsedParagraph[];
  subjectToken?: string;
  defaultMarks: number;
  defaultNegativeMarks: number;
};

type ActiveBlock =
  | { type: "paperInstructions"; paragraphs: ParsedParagraph[] }
  | { type: "sectionDescription"; sectionId: string; paragraphs: ParsedParagraph[] }
  | { type: "sectionInstructions"; sectionId: string; paragraphs: ParsedParagraph[] }
  | { type: "questionStem"; questionId: string; paragraphs: ParsedParagraph[] }
  | {
      type: "questionOption";
      questionId: string;
      optionKey: string;
      paragraphs: ParsedParagraph[];
    }
  | { type: "questionExplanation"; questionId: string; paragraphs: ParsedParagraph[] };

const SUPPORTED_DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeTemplateMarker(value: string) {
  return String(value || "").trim().toUpperCase();
}

function normalizeWhitespace(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || randomUUID();
}

function toPositiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

const FRIENDLY_FIELD_MARKER_MAP: Record<string, string> = {
  "template version": "TEMPLATE_VERSION",
  "paper title": "PAPER_TITLE",
  "class": "PAPER_CLASS",
  "duration (minutes)": "PAPER_DURATION_MINUTES",
  "duration": "PAPER_DURATION_MINUTES",
  "passing marks": "PAPER_PASSING_MARKS",
  "exam date": "PAPER_EXAM_DATE",
  "academic sections": "PAPER_ACADEMIC_SECTIONS",
  "paper instructions": "PAPER_INSTRUCTIONS",
  "section subject": "SECTION_DEFAULT_SUBJECT",
  "section default subject": "SECTION_DEFAULT_SUBJECT",
  "section default marks": "SECTION_DEFAULT_MARKS",
  "section default negative marks": "SECTION_DEFAULT_NEGATIVE_MARKS",
  "section description": "SECTION_DESCRIPTION",
  "section instructions": "SECTION_INSTRUCTIONS",
  "question number": "QUESTION_NUMBER",
  "question type": "QUESTION_TYPE",
  "type": "QUESTION_TYPE",
  "question subject": "QUESTION_SUBJECT",
  "subject": "QUESTION_SUBJECT",
  "marks": "QUESTION_MARKS",
  "negative marks": "QUESTION_NEGATIVE_MARKS",
  "difficulty": "QUESTION_DIFFICULTY",
  "topic": "QUESTION_TOPIC",
  "template id": "QUESTION_TEMPLATEID",
  "templateid": "QUESTION_TEMPLATEID",
  "tags": "QUESTION_TAGS",
  "stem": "STEM",
  "explanation": "EXPLANATION",
  "correct answer": "CORRECT_ANSWER",
};

function parseTemplateMarker(
  paragraphText: string,
): { key: string; value: string } | null {
  const normalizedText = paragraphText.trim();
  if (!normalizedText) {
    return null;
  }

  const legacyMatch = /^\[TTR:([A-Z_]+)\](?:\s*(.*))?$/i.exec(normalizedText);
  if (legacyMatch) {
    return {
      key: normalizeTemplateMarker(legacyMatch[1]),
      value: String(legacyMatch[2] || "").trim(),
    };
  }

  const endLabelMappings: Array<[RegExp, string]> = [
    [/^End\s+Paper\s+Instructions$/i, "PAPER_INSTRUCTIONS_END"],
    [/^End\s+Section\s+Description$/i, "SECTION_DESCRIPTION_END"],
    [/^End\s+Section\s+Instructions$/i, "SECTION_INSTRUCTIONS_END"],
    [/^End\s+Stem$/i, "STEM_END"],
    [/^End\s+Explanation$/i, "EXPLANATION_END"],
    [/^End\s+Question$/i, "QUESTION_END"],
    [/^End\s+Section$/i, "SECTION_END"],
  ];

  for (const [pattern, key] of endLabelMappings) {
    if (pattern.test(normalizedText)) {
      return { key, value: "" };
    }
  }

  const optionEndMatch = /^End\s+Option\s+([A-Z])$/i.exec(normalizedText);
  if (optionEndMatch) {
    return {
      key: `OPTION_${optionEndMatch[1].toUpperCase()}_END`,
      value: "",
    };
  }

  const optionStartMatch = /^Option\s+([A-Z])\s*:\s*(.*)$/i.exec(normalizedText);
  if (optionStartMatch) {
    return {
      key: `OPTION_${optionStartMatch[1].toUpperCase()}`,
      value: String(optionStartMatch[2] || "").trim(),
    };
  }

  const sectionStartMatch = /^Section\s*:\s*(.+)$/i.exec(normalizedText);
  if (sectionStartMatch) {
    return {
      key: "SECTION",
      value: normalizeWhitespace(sectionStartMatch[1]),
    };
  }

  const questionStartMatch =
    /^Question(?:\s*#)?(?:\s*:?\s*)(\d[\w()./-]*)\s*:?$/i.exec(normalizedText);
  if (questionStartMatch) {
    return {
      key: "QUESTION",
      value: normalizeWhitespace(questionStartMatch[1]),
    };
  }

  const friendlyFieldMatch = /^([^:]+):\s*(.*)$/i.exec(normalizedText);
  if (!friendlyFieldMatch) {
    return null;
  }

  const label = normalizeWhitespace(friendlyFieldMatch[1]).toLowerCase();
  const key = FRIENDLY_FIELD_MARKER_MAP[label];
  if (!key) {
    return null;
  }

  return {
    key,
    value: String(friendlyFieldMatch[2] || "").trim(),
  };
}

function createPlainTextParagraph(text: string): ParsedParagraph {
  const normalizedText = String(text || "");
  return {
    segments: normalizedText
      ? [
          {
            type: "text" as const,
            text: normalizedText,
          },
        ]
      : [],
    plainText: normalizedText.trim(),
  };
}

function splitTokenList(value: string) {
  return String(value || "")
    .split(/[|,]/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
}

function parseQuestionTags(value: string) {
  return String(value || "")
    .split("|")
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex === -1) {
        return {
          type: "tag",
          value: item,
        };
      }

      return {
        type: normalizeWhitespace(item.slice(0, separatorIndex)),
        value: normalizeWhitespace(item.slice(separatorIndex + 1)),
      };
    })
    .filter((pair) => pair.type && pair.value);
}

function parseCorrectAnswerLetters(value: string) {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/;/g, ",");
  if (!normalized) return [];

  return Array.from(
    new Set(
      normalized
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .flatMap((item) => item.split("")),
    ),
  ).filter((item) => /^[A-Z]$/.test(item));
}

function letterToIndex(letter: string) {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(letter.toUpperCase());
}

function mergeParagraphSegments(segments: ParsedParagraphSegment[]) {
  const merged: ParsedParagraphSegment[] = [];

  segments.forEach((segment) => {
    if (
      segment.type === "text" &&
      merged.length > 0 &&
      merged[merged.length - 1].type === "text"
    ) {
      const previous = merged[merged.length - 1] as { type: "text"; text: string };
      previous.text += segment.text;
      return;
    }

    merged.push(segment);
  });

  return merged;
}

function collectParagraphsInOrder(documentRoot: XmlElementNode) {
  const paragraphs: XmlElementNode[] = [];

  const walk = (node: XmlElementNode) => {
    if (node.name === "w:p") {
      paragraphs.push(node);
      return;
    }

    node.children.forEach((child) => {
      if (child.type === "element") {
        walk(child);
      }
    });
  };

  walk(documentRoot);
  return paragraphs;
}

function buildRelationshipMap(documentRelationshipsXml: string) {
  const relationshipMap = new Map<string, string>();
  const xmlRoot = parseXml(documentRelationshipsXml);

  const walk = (node: XmlElementNode) => {
    if (node.name === "Relationship") {
      const relationshipId = String(node.attrs.Id || "").trim();
      const target = String(node.attrs.Target || "").trim();
      if (relationshipId && target) {
        relationshipMap.set(relationshipId, target);
      }
    }

    node.children.forEach((child) => {
      if (child.type === "element") {
        walk(child);
      }
    });
  };

  walk(xmlRoot);
  return relationshipMap;
}

async function parseDocxParagraphs(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("The uploaded DOCX file is missing word/document.xml.");
  }

  const documentXml = await documentXmlFile.async("string");
  const documentRoot = parseXml(documentXml);
  const relationshipXml =
    (await zip.file("word/_rels/document.xml.rels")?.async("string")) || "";
  const relationshipMap = buildRelationshipMap(relationshipXml);

  const paragraphs = collectParagraphsInOrder(documentRoot);

  const extractParagraphSegments = async (paragraphNode: XmlElementNode) => {
    const segments: ParsedParagraphSegment[] = [];

    const walk = async (node: XmlElementNode): Promise<void> => {
      if (node.name === "w:t") {
        segments.push({
          type: "text",
          text: getXmlText(node),
        });
        return;
      }

      if (node.name === "w:tab") {
        segments.push({
          type: "text",
          text: "\t",
        });
        return;
      }

      if (node.name === "w:br") {
        segments.push({
          type: "text",
          text: "\n",
        });
        return;
      }

      if (node.name === "m:oMath" || node.name === "m:oMathPara") {
        const conversion = convertOmmlNodeToLatex(node);
        segments.push({
          type: "math",
          rawSource: getXmlText(node),
          normalizedLatex: conversion.latex,
          displayMode: node.name === "m:oMathPara",
          sourceFormat: "word_omml",
          warning: conversion.warnings.join(" ").trim() || undefined,
        });
        return;
      }

      if (node.name === "w:drawing" || node.name === "w:pict") {
        const blips = [
          ...findXmlDescendants(node, "a:blip"),
          ...findXmlDescendants(node, "v:imagedata"),
        ];

        for (const blip of blips) {
          const relationshipId =
            String(blip.attrs["r:embed"] || blip.attrs["r:id"] || "").trim();
          const target = relationshipMap.get(relationshipId) || "";
          if (!relationshipId || !target) {
            continue;
          }

          const sourcePath = `word/${target.replace(/^\/+/, "")}`;
          const mediaFile = zip.file(sourcePath);
          if (!mediaFile) {
            continue;
          }

          segments.push({
            type: "image",
            relationshipId,
            sourcePath,
            fileName: target.split("/").pop() || `${relationshipId}.png`,
            buffer: await mediaFile.async("nodebuffer"),
          });
        }
        return;
      }

      for (const child of node.children) {
        if (child.type === "element") {
          await walk(child);
        }
      }
    };

    await walk(paragraphNode);

    const mergedSegments = mergeParagraphSegments(segments);
    return {
      segments: mergedSegments,
      plainText: mergedSegments
        .map((segment) => {
          if (segment.type === "text") {
            return segment.text;
          }

          if (segment.type === "math") {
            return segment.rawSource || segment.normalizedLatex;
          }

          return "";
        })
        .join("")
        .trim(),
    } satisfies ParsedParagraph;
  };

  const parsedParagraphs: ParsedParagraph[] = [];
  for (const paragraph of paragraphs) {
    parsedParagraphs.push(await extractParagraphSegments(paragraph));
  }

  return parsedParagraphs;
}

function registerWarning(
  warnings: QuestionImportWarning[],
  partial: Omit<QuestionImportWarning, "id">,
) {
  const warning = {
    id: randomUUID(),
    ...partial,
  };
  warnings.push(warning);
  return warning.id;
}

function roleFromFieldPath(fieldPath: string) {
  if (fieldPath.includes(".options.")) {
    return "option" as const;
  }
  if (fieldPath.endsWith(".contentHtml")) {
    return "stem" as const;
  }
  if (fieldPath.endsWith(".explanationHtml")) {
    return "explanation" as const;
  }
  return "generic" as const;
}

async function renderParagraphsToHtml({
  paragraphs,
  fieldPath,
  storeImage,
  warnings,
  mathFragments,
  images,
}: {
  paragraphs: ParsedParagraph[];
  fieldPath: string;
  storeImage: ParseTeacherMasterDocxInput["storeImage"];
  warnings: QuestionImportWarning[];
  mathFragments: QuestionImportMathFragment[];
  images: QuestionImportImageAsset[];
}) {
  const htmlParts: string[] = [];

  const registerMathFragment = ({
    sourceFormat,
    rawSource,
    normalizedLatex,
    displayMode,
    warning,
  }: {
    sourceFormat: QuestionImportMathFragment["sourceFormat"];
    rawSource: string;
    normalizedLatex: string;
    displayMode: boolean;
    warning?: string;
  }) => {
    const mappingStatus =
      warning || !normalizedLatex.trim() ? "unmapped" : "mapped";
    const fragmentId = randomUUID();
    mathFragments.push({
      id: fragmentId,
      path: fieldPath,
      sourceFormat,
      rawSource,
      normalizedLatex: normalizedLatex || undefined,
      mappingStatus,
      warning,
      displayMode,
    });

    if (mappingStatus === "unmapped" && !normalizedLatex.trim()) {
      registerWarning(warnings, {
        severity: "warning",
        code: "unmapped_math",
        message: warning || "One or more math expressions could not be mapped cleanly.",
        path: fieldPath,
        blocking: true,
      });
      return escapeHtml(rawSource);
    }

    if (mappingStatus === "unmapped") {
      registerWarning(warnings, {
        severity: "warning",
        code: "review_math_mapping",
        message: warning || "Review the converted math expression before publish.",
        path: fieldPath,
        blocking: true,
      });
    }

    return createMathNodeHtml(normalizedLatex, displayMode);
  };

  for (const paragraph of paragraphs) {
    const segmentHtml: string[] = [];

    for (const segment of paragraph.segments) {
      if (segment.type === "text") {
        const rendered = renderPlainTextWithMathNodes(
          segment.text,
          ({ sourceFormat, rawSource, normalizedLatex, displayMode }) =>
            registerMathFragment({
              sourceFormat,
              rawSource,
              normalizedLatex,
              displayMode,
            }),
        ).replace(/\n/g, "<br />");
        segmentHtml.push(rendered);
        continue;
      }

      if (segment.type === "math") {
        segmentHtml.push(
          registerMathFragment({
            sourceFormat: segment.sourceFormat,
            rawSource: segment.rawSource,
            normalizedLatex: normalizeLatexInput(segment.normalizedLatex),
            displayMode: segment.displayMode,
            warning: segment.warning,
          }),
        );
        continue;
      }

      if (segment.type === "image") {
        const storedImage = await storeImage({
          buffer: segment.buffer,
          fileName: segment.fileName,
          sourcePath: segment.sourcePath,
        });
        const imageId = randomUUID();
        images.push({
          id: imageId,
          fieldPath,
          role: roleFromFieldPath(fieldPath),
          url: storedImage.url,
          fileName: storedImage.fileName,
          sourcePath: segment.sourcePath,
        });
        segmentHtml.push(
          `<img src="${escapeHtml(storedImage.url)}" alt="${escapeHtml(
            segment.fileName,
          )}" />`,
        );
      }
    }

    if (segmentHtml.length > 0) {
      htmlParts.push(`<p>${segmentHtml.join("")}</p>`);
    }
  }

  return htmlParts.join("");
}

function buildSubjectMappings(rawSections: RawDraftSection[], rawQuestions: RawDraftQuestion[]) {
  const tokens = Array.from(
    new Set(
      [
        ...rawSections.map((section) => section.subjectToken || ""),
        ...rawQuestions.map((question) => question.subjectToken || ""),
      ].map((token) => normalizeWhitespace(token)).filter(Boolean),
    ),
  );

  return tokens.map((token) => ({
    token,
  }));
}

function finalizeQuestionType(value: string) {
  const normalized = normalizeTemplateMarker(value).toLowerCase();
  if (
    normalized === "single" ||
    normalized === "multiple" ||
    normalized === "descriptive"
  ) {
    return normalized;
  }
  return "single";
}

export async function parseTeacherMasterDocx({
  buffer,
  storeImage,
}: ParseTeacherMasterDocxInput): Promise<QuestionImportDraftPayload> {
  const paragraphs = await parseDocxParagraphs(buffer);
  const warnings: QuestionImportWarning[] = [];
  const errors: QuestionImportWarning[] = [];
  const mathFragments: QuestionImportMathFragment[] = [];
  const images: QuestionImportImageAsset[] = [];

  const paper = {
    title: "",
    instructionsHtml: "",
    classToken: "",
    classId: "",
    durationMinutes: 60,
    passingMarks: 0,
    examDate: "",
    onlineEnabled: false,
    onlineStartsAt: "",
    onlineEndsAt: "",
    academicSectionAssignmentMode: "all" as const,
    assignedAcademicSectionIds: [] as string[],
    academicSectionTokens: [] as string[],
  };

  const rawSections: RawDraftSection[] = [];
  const rawQuestions: RawDraftQuestion[] = [];

  let currentSection: RawDraftSection | null = null;
  let currentQuestion: RawDraftQuestion | null = null;
  let activeBlock: ActiveBlock | null = null;
  let templateVersion = QUESTION_IMPORT_TEMPLATE_VERSION;

  const findSection = (sectionId: string) =>
    rawSections.find((section) => section.id === sectionId) || null;
  const findQuestion = (questionId: string) =>
    rawQuestions.find((question) => question.id === questionId) || null;

  const flushActiveBlock = () => {
    if (!activeBlock) return;

    switch (activeBlock.type) {
      case "paperInstructions":
        paper.instructionsHtml = "__PENDING_BLOCK_RENDER__";
        (paper as any).__instructionsParagraphs = activeBlock.paragraphs;
        break;
      case "sectionDescription": {
        const section = findSection(activeBlock.sectionId);
        if (section) {
          section.descriptionParagraphs = activeBlock.paragraphs;
        }
        break;
      }
      case "sectionInstructions": {
        const section = findSection(activeBlock.sectionId);
        if (section) {
          section.instructionsParagraphs = activeBlock.paragraphs;
        }
        break;
      }
      case "questionStem": {
        const question = findQuestion(activeBlock.questionId);
        if (question) {
          question.stemParagraphs = activeBlock.paragraphs;
        }
        break;
      }
      case "questionOption": {
        const question = findQuestion(activeBlock.questionId);
        if (question) {
          question.optionParagraphs[activeBlock.optionKey] = activeBlock.paragraphs;
        }
        break;
      }
      case "questionExplanation": {
        const question = findQuestion(activeBlock.questionId);
        if (question) {
          question.explanationParagraphs = activeBlock.paragraphs;
        }
        break;
      }
    }

    activeBlock = null;
  };

  for (const paragraph of paragraphs) {
    const marker = parseTemplateMarker(paragraph.plainText);

    if (marker) {
      const key = marker.key;
      const value = marker.value;

      const isBlockBoundary =
        key.endsWith("_END") ||
        key === "PAPER_INSTRUCTIONS" ||
        key === "SECTION_DESCRIPTION" ||
        key === "SECTION_INSTRUCTIONS" ||
        key === "STEM" ||
        key.startsWith("OPTION_") ||
        key === "EXPLANATION";

      if (isBlockBoundary) {
        flushActiveBlock();
      }

      switch (key) {
        case "TEMPLATE_VERSION":
          templateVersion = value || QUESTION_IMPORT_TEMPLATE_VERSION;
          break;
        case "PAPER_TITLE":
          paper.title = value;
          break;
        case "PAPER_CLASS":
          paper.classToken = value;
          break;
        case "PAPER_DURATION_MINUTES":
          paper.durationMinutes = toPositiveNumber(value, 60);
          break;
        case "PAPER_PASSING_MARKS":
          paper.passingMarks = toPositiveNumber(value, 0);
          break;
        case "PAPER_EXAM_DATE":
          paper.examDate = value;
          break;
        case "PAPER_ACADEMIC_SECTIONS":
          paper.academicSectionTokens = splitTokenList(value);
          break;
        case "PAPER_INSTRUCTIONS":
          activeBlock = {
            type: "paperInstructions",
            paragraphs: value ? [createPlainTextParagraph(value)] : [],
          };
          break;
        case "PAPER_INSTRUCTIONS_END":
          break;
        case "SECTION":
          currentSection = {
            id: `section-${slugify(value || `${rawSections.length + 1}`)}`,
            order: rawSections.length,
            name: value || "",
            descriptionParagraphs: [],
            instructionsParagraphs: [],
            subjectToken: "",
            defaultMarks: 1,
            defaultNegativeMarks: 0,
          };
          rawSections.push(currentSection);
          break;
        case "SECTION_NAME":
          if (currentSection) currentSection.name = value;
          break;
        case "SECTION_DEFAULT_SUBJECT":
          if (currentSection) currentSection.subjectToken = value;
          break;
        case "SECTION_DEFAULT_MARKS":
          if (currentSection) currentSection.defaultMarks = toPositiveNumber(value, 1);
          break;
        case "SECTION_DEFAULT_NEGATIVE_MARKS":
          if (currentSection) {
            currentSection.defaultNegativeMarks = toPositiveNumber(value, 0);
          }
          break;
        case "SECTION_DESCRIPTION":
          if (currentSection) {
            activeBlock = {
              type: "sectionDescription",
              sectionId: currentSection.id,
              paragraphs: value ? [createPlainTextParagraph(value)] : [],
            };
          }
          break;
        case "SECTION_DESCRIPTION_END":
          break;
        case "SECTION_INSTRUCTIONS":
          if (currentSection) {
            activeBlock = {
              type: "sectionInstructions",
              sectionId: currentSection.id,
              paragraphs: value ? [createPlainTextParagraph(value)] : [],
            };
          }
          break;
        case "SECTION_INSTRUCTIONS_END":
          break;
        case "QUESTION":
          if (!currentSection) {
            registerWarning(errors, {
              severity: "error",
              code: "question_without_section",
              message: "A question block was found before any section block.",
              blocking: true,
            });
            break;
          }

          currentQuestion = {
            id: `question-${rawQuestions.length + 1}`,
            order: rawQuestions.length,
            numberLabel: value || String(rawQuestions.length + 1),
            sectionId: currentSection.id,
            type: "single",
            subjectToken: currentSection.subjectToken || "",
            marks: currentSection.defaultMarks || 1,
            negativeMarks: currentSection.defaultNegativeMarks || 0,
            metadata: {
              customTags: [],
            },
            answerLetters: [],
            stemParagraphs: [],
            optionParagraphs: {},
            explanationParagraphs: [],
            warnings: [],
          };
          rawQuestions.push(currentQuestion);
          break;
        case "QUESTION_NUMBER":
          if (currentQuestion) currentQuestion.numberLabel = value || currentQuestion.numberLabel;
          break;
        case "QUESTION_TYPE":
          if (currentQuestion) currentQuestion.type = finalizeQuestionType(value);
          break;
        case "QUESTION_SUBJECT":
          if (currentQuestion) currentQuestion.subjectToken = value;
          break;
        case "QUESTION_MARKS":
          if (currentQuestion) currentQuestion.marks = toPositiveNumber(value, currentQuestion.marks);
          break;
        case "QUESTION_NEGATIVE_MARKS":
          if (currentQuestion) {
            currentQuestion.negativeMarks = toPositiveNumber(
              value,
              currentQuestion.negativeMarks,
            );
          }
          break;
        case "QUESTION_DIFFICULTY":
          if (currentQuestion) currentQuestion.metadata.difficulty = value;
          break;
        case "QUESTION_TOPIC":
          if (currentQuestion) currentQuestion.metadata.topic = value;
          break;
        case "QUESTION_TEMPLATEID":
          if (currentQuestion) currentQuestion.metadata.templateId = value;
          break;
        case "QUESTION_TAGS":
          if (currentQuestion) currentQuestion.metadata.customTags = parseQuestionTags(value);
          break;
        case "STEM":
          if (currentQuestion) {
            activeBlock = {
              type: "questionStem",
              questionId: currentQuestion.id,
              paragraphs: value ? [createPlainTextParagraph(value)] : [],
            };
          }
          break;
        case "STEM_END":
          break;
        case "OPTION_A":
        case "OPTION_B":
        case "OPTION_C":
        case "OPTION_D":
        case "OPTION_E":
          if (currentQuestion) {
            activeBlock = {
              type: "questionOption",
              questionId: currentQuestion.id,
              optionKey: key.split("_")[1],
              paragraphs: value ? [createPlainTextParagraph(value)] : [],
            };
          }
          break;
        case "OPTION_A_END":
        case "OPTION_B_END":
        case "OPTION_C_END":
        case "OPTION_D_END":
        case "OPTION_E_END":
          break;
        case "CORRECT_ANSWER":
          if (currentQuestion) currentQuestion.answerLetters = parseCorrectAnswerLetters(value);
          break;
        case "EXPLANATION":
          if (currentQuestion) {
            activeBlock = {
              type: "questionExplanation",
              questionId: currentQuestion.id,
              paragraphs: value ? [createPlainTextParagraph(value)] : [],
            };
          }
          break;
        case "EXPLANATION_END":
          break;
        case "QUESTION_END":
          currentQuestion = null;
          break;
        case "SECTION_END":
          currentSection = null;
          break;
        default:
          break;
      }

      continue;
    }

    if (activeBlock) {
      activeBlock.paragraphs.push(paragraph);
    }
  }

  flushActiveBlock();

  if (!paper.title) {
    registerWarning(errors, {
      severity: "error",
      code: "missing_paper_title",
      message: "Paper title is required in the teacher master template.",
      path: "paper.title",
      blocking: true,
    });
  }

  if (!paper.classToken) {
    registerWarning(errors, {
      severity: "error",
      code: "missing_paper_class",
      message: "Paper class is required in the teacher master template.",
      path: "paper.classToken",
      blocking: true,
    });
  }

  const finalSections = await Promise.all(
    rawSections.map(async (section) => ({
      id: section.id,
      order: section.order,
      name: section.name || `Section ${section.order + 1}`,
      descriptionHtml: await renderParagraphsToHtml({
        paragraphs: section.descriptionParagraphs,
        fieldPath: `paperSections.${section.id}.descriptionHtml`,
        storeImage,
        warnings,
        mathFragments,
        images,
      }),
      instructionsHtml: await renderParagraphsToHtml({
        paragraphs: section.instructionsParagraphs,
        fieldPath: `paperSections.${section.id}.instructionsHtml`,
        storeImage,
        warnings,
        mathFragments,
        images,
      }),
      subjectToken: normalizeWhitespace(section.subjectToken),
      defaultMarks: section.defaultMarks || 1,
      defaultNegativeMarks: section.defaultNegativeMarks || 0,
    })),
  );

  const finalQuestions: QuestionImportQuestionDraft[] = [];

  for (const rawQuestion of rawQuestions) {
    const contentHtml = await renderParagraphsToHtml({
      paragraphs: rawQuestion.stemParagraphs,
      fieldPath: `questions.${rawQuestion.id}.contentHtml`,
      storeImage,
      warnings,
      mathFragments,
      images,
    });

    const explanationHtml = await renderParagraphsToHtml({
      paragraphs: rawQuestion.explanationParagraphs,
      fieldPath: `questions.${rawQuestion.id}.explanationHtml`,
      storeImage,
      warnings,
      mathFragments,
      images,
    });

    const optionEntries = Object.entries(rawQuestion.optionParagraphs)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(async ([key, optionParagraphs]) => ({
        id: `${rawQuestion.id}-option-${key.toLowerCase()}`,
        key,
        contentHtml: await renderParagraphsToHtml({
          paragraphs: optionParagraphs,
          fieldPath: `questions.${rawQuestion.id}.options.${key}`,
          storeImage,
          warnings,
          mathFragments,
          images,
        }),
      }));

    const options = await Promise.all(optionEntries);
    const answerIndexes = rawQuestion.answerLetters
      .map(letterToIndex)
      .filter((index) => index >= 0);

    if (
      (rawQuestion.type === "single" || rawQuestion.type === "multiple") &&
      options.length < 2
    ) {
      const warningId = registerWarning(warnings, {
        severity: "warning",
        code: "insufficient_options",
        message: `Question ${rawQuestion.numberLabel} needs at least two options before publish.`,
        path: `questions.${rawQuestion.id}.options`,
        blocking: true,
      });
      rawQuestion.warnings.push(warningId);
    }

    if (
      rawQuestion.type !== "descriptive" &&
      answerIndexes.length === 0
    ) {
      const warningId = registerWarning(warnings, {
        severity: "warning",
        code: "missing_correct_answer",
        message: `Question ${rawQuestion.numberLabel} is missing a correct answer.`,
        path: `questions.${rawQuestion.id}.answerIndexes`,
        blocking: true,
      });
      rawQuestion.warnings.push(warningId);
    }

    const questionMathFragmentIds = mathFragments
      .filter((fragment) => fragment.path.startsWith(`questions.${rawQuestion.id}.`))
      .map((fragment) => fragment.id);
    const questionImageIds = images
      .filter((image) => image.fieldPath.startsWith(`questions.${rawQuestion.id}.`))
      .map((image) => image.id);

    const hasBlockingWarning = warnings.some(
      (warning) =>
        warning.blocking &&
        String(warning.path || "").startsWith(`questions.${rawQuestion.id}.`),
    );

    finalQuestions.push({
      id: rawQuestion.id,
      order: rawQuestion.order,
      numberLabel: rawQuestion.numberLabel,
      sectionId: rawQuestion.sectionId,
      approvalStatus: hasBlockingWarning ? "needs_fix" : "pending_review",
      type: rawQuestion.type,
      subjectToken: normalizeWhitespace(rawQuestion.subjectToken),
      marks: rawQuestion.marks || 1,
      negativeMarks: rawQuestion.negativeMarks || 0,
      contentHtml,
      options,
      answerIndexes,
      explanationHtml,
      metadata: rawQuestion.metadata,
      warningIds: rawQuestion.warnings.concat(
        warnings
          .filter((warning) =>
            String(warning.path || "").startsWith(`questions.${rawQuestion.id}.`),
          )
          .map((warning) => warning.id),
      ),
      mathFragmentIds: questionMathFragmentIds,
      imageIds: questionImageIds,
    });
  }

  const paperInstructionsHtml = await renderParagraphsToHtml({
    paragraphs: ((paper as any).__instructionsParagraphs || []) as ParsedParagraph[],
    fieldPath: "paper.instructionsHtml",
    storeImage,
    warnings,
    mathFragments,
    images,
  });

  const payload: QuestionImportDraftPayload = {
    templateVersion: templateVersion || QUESTION_IMPORT_TEMPLATE_VERSION,
    paper: {
      title: paper.title,
      instructionsHtml: paperInstructionsHtml,
      classToken: normalizeWhitespace(paper.classToken),
      classId: "",
      durationMinutes: paper.durationMinutes,
      passingMarks: paper.passingMarks,
      examDate: paper.examDate,
      onlineEnabled: false,
      onlineStartsAt: "",
      onlineEndsAt: "",
      academicSectionAssignmentMode: paper.academicSectionAssignmentMode,
      assignedAcademicSectionIds: paper.assignedAcademicSectionIds,
      academicSectionTokens: paper.academicSectionTokens,
    },
    paperSections: finalSections,
    questions: finalQuestions,
    images,
    warnings,
    errors,
    mappings: {
      subjects: buildSubjectMappings(rawSections, rawQuestions),
      academicSections: paper.academicSectionTokens.map((token) => ({ token })),
    },
    mathFragments,
  };

  registerWarning(payload.warnings, {
    severity: "info",
    code: "math_mapping_table",
    message: `Math mapping table version ${getMathMappingTableVersion()} was used during DOCX parsing.`,
    path: "mathFragments",
    blocking: false,
  });

  return payload;
}

export function isSupportedQuestionImportMimeType(value: string) {
  return String(value || "").toLowerCase() === SUPPORTED_DOCX_MIME_TYPE;
}
