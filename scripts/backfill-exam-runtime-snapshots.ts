import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  isExamRuntimeEnabled,
  syncExamPaperSnapshotForPaperId,
} from "@/lib/exam-runtime";
import School from "@/models/School";

async function main() {
  const runtimeEnabled = await isExamRuntimeEnabled();
  if (!runtimeEnabled) {
    throw new Error(
      "Exam runtime is not configured. Set DATABASE_URL and install the Neon driver before running this backfill.",
    );
  }

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

    const { QuestionPaper: QuestionPaperModel } = await getTenantModels(
      schoolKey,
      ["QuestionPaper"],
    );

    const papers = await QuestionPaperModel.find({
      onlineEnabled: true,
      ...buildArchiveFilter(false),
    })
      .select("_id title")
      .sort({ updatedAt: -1 })
      .lean();

    console.log(
      `[exam-runtime] ${schoolKey}: syncing ${papers.length} online paper snapshots`,
    );

    for (const paper of papers) {
      const paperId = String(paper?._id || "").trim();
      if (!paperId) {
        continue;
      }

      await syncExamPaperSnapshotForPaperId(schoolKey, paperId);
      console.log(
        `[exam-runtime] synced ${schoolKey}/${paperId} ${String(
          paper?.title || "",
        )}`,
      );
    }
  }
}

main().catch((error) => {
  console.error("[exam-runtime] snapshot backfill failed:", error);
  process.exitCode = 1;
});
