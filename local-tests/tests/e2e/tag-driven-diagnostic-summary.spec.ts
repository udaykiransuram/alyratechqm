/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import { buildTagDrivenDiagnosticSummary } from "../../../lib/diagnostics/tag-driven-summary";

test.describe("Tag-driven diagnostic summary helpers @desktop", () => {
  test("builds parent-facing metrics, priority areas, and misconception patterns from tagged question outcomes", async () => {
    const summary = buildTagDrivenDiagnosticSummary({
      totalDurationSeconds: 510,
      questions: [
        {
          questionId: "q1",
          questionNumber: 1,
          status: "incorrect",
          tags: [
            { type: "foundation-role", value: "core" },
            { type: "subskill", value: "Compare decimals by place value" },
            { type: "topic", value: "Decimals" },
            { type: "competency", value: "Understanding" },
            { type: "process", value: "Interpret" },
            { type: "representation-mode", value: "number-line" },
            { type: "conceptual-procedural-load", value: "concept-heavy" },
            { type: "difficulty", value: "easy" },
            { type: "prerequisite", value: "Place value" },
            { type: "misconception-family", value: "whole-number-reading" },
            { type: "time-target-sec", value: "60" },
          ],
        },
        {
          questionId: "q2",
          questionNumber: 2,
          status: "incorrect",
          tags: [
            { type: "foundation-role", value: "core" },
            { type: "subskill", value: "Compare decimals by place value" },
            { type: "topic", value: "Decimals" },
            { type: "competency", value: "Understanding" },
            { type: "process", value: "Interpret" },
            { type: "representation-mode", value: "number-line" },
            { type: "conceptual-procedural-load", value: "concept-heavy" },
            { type: "difficulty", value: "easy" },
            { type: "prerequisite", value: "Place value" },
            { type: "misconception-family", value: "whole-number-reading" },
            { type: "time-target-sec", value: "60" },
          ],
        },
        {
          questionId: "q3",
          questionNumber: 3,
          status: "correct",
          tags: [
            { type: "foundation-role", value: "core" },
            { type: "subskill", value: "Read values from a table" },
            { type: "topic", value: "Data handling" },
            { type: "competency", value: "Problem-Solving" },
            { type: "process", value: "Interpret" },
            { type: "representation-mode", value: "table" },
            { type: "conceptual-procedural-load", value: "balanced" },
            { type: "difficulty", value: "easy" },
            { type: "time-target-sec", value: "75" },
          ],
        },
        {
          questionId: "q4",
          questionNumber: 4,
          status: "unattempted",
          tags: [
            { type: "subskill", value: "Set up a one-step equation" },
            { type: "topic", value: "Algebra" },
            { type: "competency", value: "Reasoning" },
            { type: "process", value: "Formulate" },
            { type: "conceptual-procedural-load", value: "balanced" },
            { type: "difficulty", value: "medium" },
            { type: "time-target-sec", value: "90" },
          ],
        },
      ],
    });

    expect(summary.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "foundations-readiness",
          label: "Foundations Readiness",
          score: 33,
        }),
        expect.objectContaining({
          key: "concept-clarity",
          label: "Concept Clarity",
          score: 0,
        }),
      ]),
    );

    expect(summary.focusAreas[0]).toEqual(
      expect.objectContaining({
        kind: "subskill",
        label: "Compare decimals by place value",
      }),
    );
    expect(summary.prerequisiteFocus[0]).toEqual(
      expect.objectContaining({
        label: "Place value",
      }),
    );
    expect(summary.misconceptionPatterns).toEqual([
      expect.objectContaining({
        label: "whole-number-reading",
      }),
    ]);
    expect(summary.rootCauseSummary.primaryBarrier).toBe("concept");
  });
});
