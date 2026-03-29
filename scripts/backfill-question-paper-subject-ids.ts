import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  buildStoredPaperSubjectFields,
  derivePaperSubjectIdsFromSections,
} from "@/lib/question-paper/subjects";
import School from "@/models/School";

function normalizeId(value: unknown) {
  if (!value) return "";

  if (typeof value === "object" && value !== null) {
    if ("_id" in (value as Record<string, unknown>)) {
      return String((value as Record<string, unknown>)._id || "").trim();
    }
  }

  return String(value || "").trim();
}

function idsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

async function main() {
  await connectDB();

  const schools = await School.find({})
    .select("key displayName")
    .sort({ displayName: 1 })
    .lean();

  for (const school of schools) {
    const schoolKey = String(school?.key || "").trim();
    if (!schoolKey) {
      continue;
    }

    const {
      QuestionPaper: QuestionPaperModel,
      Question: QuestionModel,
    } = await getTenantModels(schoolKey, ["QuestionPaper", "Question"]);

    const papers = await QuestionPaperModel.find({})
      .select("_id title subject subjectIds sections")
      .populate({
        path: "sections.questions.question",
        model: QuestionModel,
        select: "subject",
      })
      .sort({ updatedAt: -1 })
      .lean();

    let updatedCount = 0;

    console.log(
      `[paper-subjects] ${schoolKey}: inspecting ${papers.length} papers`,
    );

    for (const paper of papers as any[]) {
      const derivedSubjectIds = derivePaperSubjectIdsFromSections(
        paper?.sections,
      );
      const legacySubjectId = normalizeId(paper?.subject);
      const nextStoredSubjects = buildStoredPaperSubjectFields(
        derivedSubjectIds.length > 0
          ? derivedSubjectIds
          : legacySubjectId
            ? [legacySubjectId]
            : [],
      );
      const currentSubjectIds = Array.from(
        new Set(
          (Array.isArray(paper?.subjectIds) ? paper.subjectIds : [])
            .map((subject: any) => normalizeId(subject))
            .filter(Boolean),
        ),
      ) as string[];
      currentSubjectIds.sort((left, right) => left.localeCompare(right));
      const currentLegacySubjectId = normalizeId(paper?.subject);

      if (
        idsEqual(currentSubjectIds, nextStoredSubjects.subjectIds) &&
        currentLegacySubjectId === String(nextStoredSubjects.subject || "").trim()
      ) {
        continue;
      }

      await QuestionPaperModel.updateOne(
        { _id: paper._id },
        {
          $set: {
            subjectIds: nextStoredSubjects.subjectIds,
            subject: nextStoredSubjects.subject || null,
          },
        },
      );

      updatedCount += 1;
      console.log(
        `[paper-subjects] updated ${schoolKey}/${String(
          paper?._id || "",
        )} ${String(paper?.title || "")} -> ${nextStoredSubjects.subjectIds.join(",") || "none"}`,
      );
    }

    console.log(
      `[paper-subjects] ${schoolKey}: updated ${updatedCount} paper subject sets`,
    );
  }
}

main().catch((error) => {
  console.error("[paper-subjects] backfill failed:", error);
  process.exitCode = 1;
});
