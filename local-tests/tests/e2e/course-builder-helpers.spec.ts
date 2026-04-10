/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import {
  buildCourseBuilderOutlineEntries,
  buildEmptyCourseBuilderBlock,
  createSeededCourseBuilderBlocks,
  ensureSeededCourseBuilderBlocks,
  isCourseBuilderScopeComplete,
  moveCourseBuilderLessonWithinModule,
  moveCourseBuilderTopLevelBlock,
  removeCourseBuilderBlockWithFallback,
} from "../../../lib/courses/course-builder";

test.describe("Course builder helper coverage @desktop", () => {
  test("gates curriculum behind valid scope and seeds the first module and lesson only when empty", async () => {
    expect(
      isCourseBuilderScopeComplete({
        title: "",
        classId: "class-1",
        selectedSubjectIds: ["subject-1"],
      }),
    ).toBe(false);

    expect(
      isCourseBuilderScopeComplete({
        title: "Diagnostic Foundations",
        classId: "class-1",
        selectedSubjectIds: ["subject-1"],
      }),
    ).toBe(true);

    const seeded = ensureSeededCourseBuilderBlocks([]);
    expect(seeded).toHaveLength(2);
    expect(seeded[0]?.type).toBe("module");
    expect(seeded[1]?.type).toBe("lesson");
    expect(seeded[0]?.type === "module" ? seeded[0].title : "").toBe("Module 1");
    expect(seeded[1]?.type === "lesson" ? seeded[1].title : "").toBe("Lesson 1");

    const existingAssessment = buildEmptyCourseBuilderBlock("assessment");
    const preserved = ensureSeededCourseBuilderBlocks([existingAssessment]);
    expect(preserved).toHaveLength(1);
    expect(preserved[0]?.id).toBe(existingAssessment.id);
  });

  test("keeps module and lesson grouping stable after reorder operations and restores a valid fallback after deletion", async () => {
    const seeded = createSeededCourseBuilderBlocks();
    const extraLesson = buildEmptyCourseBuilderBlock("lesson");
    const secondModule = buildEmptyCourseBuilderBlock("module");
    const secondLesson = buildEmptyCourseBuilderBlock("lesson");

    if (extraLesson.type !== "lesson" || secondModule.type !== "module" || secondLesson.type !== "lesson") {
      throw new Error("Unexpected seeded block types while preparing course builder test data.");
    }

    extraLesson.title = "Lesson 2";
    secondModule.title = "Module 2";
    secondLesson.title = "Lesson 3";

    const initialBlocks = [
      seeded[0]!,
      seeded[1]!,
      extraLesson,
      secondModule,
      secondLesson,
    ];

    const movedLessons = moveCourseBuilderLessonWithinModule(initialBlocks, extraLesson.id, -1);
    const movedLessonEntries = buildCourseBuilderOutlineEntries(movedLessons);

    expect(
      movedLessonEntries.filter((entry) => entry.parentModuleId === seeded[0]?.id).map((entry) => entry.blockId),
    ).toEqual([extraLesson.id, seeded[1]?.id]);

    const movedModule = moveCourseBuilderTopLevelBlock(movedLessons, secondModule.id, -1);
    const movedModuleEntries = buildCourseBuilderOutlineEntries(movedModule);

    expect(movedModuleEntries[0]?.blockId).toBe(secondModule.id);
    expect(
      movedModuleEntries.filter((entry) => entry.parentModuleId === secondModule.id).map((entry) => entry.blockId),
    ).toEqual([secondLesson.id]);

    const singleLessonSeed = createSeededCourseBuilderBlocks();
    const fallbackAfterDeletingOnlyLesson = removeCourseBuilderBlockWithFallback(
      singleLessonSeed,
      singleLessonSeed[1]!.id,
    );
    expect(fallbackAfterDeletingOnlyLesson.some((block) => block.type === "module")).toBe(true);
    expect(fallbackAfterDeletingOnlyLesson.some((block) => block.type === "lesson")).toBe(true);

    const singleModuleSeed = createSeededCourseBuilderBlocks();
    const fallbackAfterDeletingOnlyModule = removeCourseBuilderBlockWithFallback(
      singleModuleSeed,
      singleModuleSeed[0]!.id,
    );
    expect(fallbackAfterDeletingOnlyModule.some((block) => block.type === "module")).toBe(true);
    expect(fallbackAfterDeletingOnlyModule.some((block) => block.type === "lesson")).toBe(true);
  });
});
