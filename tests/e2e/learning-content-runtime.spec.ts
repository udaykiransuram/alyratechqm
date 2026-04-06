/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import { listStudentTestsData } from "../../lib/server/student-tests";
import {
  disableExamPaperSnapshotsForPaperId,
  isExamRuntimeEnabled,
} from "../../lib/exam-runtime";
import {
  createLearningContentIntegrationSeed,
  toId,
  type LearningContentIntegrationSeed,
} from "./learning-content-integration.helpers";

test.describe.configure({ mode: "serial" });

function buildStudentPlacement(seed: LearningContentIntegrationSeed) {
  return {
    classId: toId(seed.classAlpha),
    academicSectionId: toId(seed.sectionAlphaOne),
  };
}

test.describe("Learning content integration (exam runtime)", () => {
  let seed!: LearningContentIntegrationSeed;

  test.beforeEach(async () => {
    seed = await createLearningContentIntegrationSeed();
  });

  test.afterEach(async () => {
    if (seed) {
      await seed.cleanup();
    }
  });

  test("runtime-backed student test listing respects requested paperIds", async () => {
    test.skip(
      !(await isExamRuntimeEnabled()),
      "Exam runtime database is not configured for this environment.",
    );

    const linkedPaper = await seed.createPaper({
      key: "runtime-linked",
      title: "Runtime Linked Paper",
    });
    const extraPaper = await seed.createPaper({
      key: "runtime-extra",
      title: "Runtime Extra Paper",
    });

    try {
      const tests = await listStudentTestsData({
        schoolKey: seed.schoolKey,
        studentId: toId(seed.studentPrimary),
        studentPlacement: buildStudentPlacement(seed),
        paperIds: [toId(linkedPaper)],
        autoSubmitExpiredAttempts: false,
      });

      expect(tests.map((entry) => entry._id)).toEqual([toId(linkedPaper)]);
    } finally {
      await disableExamPaperSnapshotsForPaperId(
        seed.schoolKey,
        toId(linkedPaper),
      ).catch(() => undefined);
      await disableExamPaperSnapshotsForPaperId(
        seed.schoolKey,
        toId(extraPaper),
      ).catch(() => undefined);
    }
  });
});
