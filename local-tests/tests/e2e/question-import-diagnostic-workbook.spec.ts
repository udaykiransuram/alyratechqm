/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import {
  buildQuestionImportMetadataTagMap,
  normalizeQuestionImportDiagnosticTagType,
} from "../../../lib/question-import/diagnostic-tags";
import {
  buildDiagnosticQuestionWorkbookBuffer,
  parseDiagnosticQuestionWorkbook,
} from "../../../lib/question-import/xlsx";

test.describe("Question import diagnostic workbook helpers @desktop", () => {
  test("normalizes legacy and canonical tag headers into one canonical tag type registry", async () => {
    expect(normalizeQuestionImportDiagnosticTagType("Chapter Name")).toBe(
      "topic",
    );
    expect(normalizeQuestionImportDiagnosticTagType("Sub Topic")).toBe(
      "subtopic",
    );
    expect(normalizeQuestionImportDiagnosticTagType("Representation Mode")).toBe(
      "representation-mode",
    );
    expect(
      normalizeQuestionImportDiagnosticTagType("Conceptual Procedural Load"),
    ).toBe("conceptual-procedural-load");
    expect(normalizeQuestionImportDiagnosticTagType("Template ID")).toBe(
      "templateid",
    );
    expect(
      normalizeQuestionImportDiagnosticTagType("Option A Misconception"),
    ).toBe("option-a-misconception");
  });

  test("parses a canonical diagnostic workbook row into the existing draft payload metadata", async () => {
    const workbookBuffer = buildDiagnosticQuestionWorkbookBuffer({
      rows: [
        {
          "Paper Title": "Class 7 Foundations Intake",
          Class: "Class 7",
          "Section Name": "Section A",
          Subject: "Mathematics",
          "Question Number": "1",
          "Question Type": "single",
          Question: "Compare 0.35 and 0.503 on a number line.",
          "Option A": "0.35 is greater",
          "Option B": "0.503 is greater",
          "Option C": "Both are equal",
          "Option D": "Cannot be determined",
          "Correct (letter)": "B",
          Explanation: "0.503 has 5 tenths while 0.35 has 3 tenths.",
          Marks: 1,
          Topic: "Decimals",
          "Subtopic": "Ordering decimals",
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
          "Additional Tags":
            "context=pure | estimation-sense-check=compare magnitude",
        },
      ],
    });

    const payload = await parseDiagnosticQuestionWorkbook({
      buffer: workbookBuffer,
      fileName: "diagnostic-import.xlsx",
    });

    expect(payload.paper.title).toBe("Class 7 Foundations Intake");
    expect(payload.paper.classToken).toBe("Class 7");
    expect(payload.paperSections).toHaveLength(1);
    expect(payload.questions).toHaveLength(1);

    const question = payload.questions[0];
    expect(question.subjectToken).toBe("Mathematics");
    expect(question.answerIndexes).toEqual([1]);
    expect(question.metadata.templateId).toBeUndefined();

    expect(buildQuestionImportMetadataTagMap(question.metadata)).toEqual(
      expect.objectContaining({
        topic: "Decimals",
        subtopic: "Ordering decimals",
        subskill: "Compare decimals by place value",
        competency: "Understanding",
        process: "Interpret",
        prerequisite: "Place value",
        "representation-mode": "number-line",
        "conceptual-procedural-load": "concept-heavy",
        "calculation-load": "light",
        "foundation-role": "core",
        "time-target-sec": "60",
        "misconception-family": "whole-number-reading",
        "option-a-misconception": "Reads 35 as larger than 503",
        context: "pure",
        "estimation-sense-check": "compare magnitude",
      }),
    );
  });
});
