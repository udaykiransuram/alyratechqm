import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import School from "@/models/School";

function normalizeKey(value: unknown) {
  return String(value || "").trim();
}

function parseArg(flag: string) {
  const prefix = `--${flag}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function inferQuestionType(question: any) {
  const options = Array.isArray(question?.options) ? question.options : [];
  const answerIndexes = Array.isArray(question?.answerIndexes)
    ? question.answerIndexes
    : [];
  const matrixOptions = Array.isArray(question?.matrixOptions)
    ? question.matrixOptions
    : [];
  const matrixAnswers = Array.isArray(question?.matrixAnswers)
    ? question.matrixAnswers
    : [];

  if (matrixOptions.length > 0 || matrixAnswers.length > 0) {
    return "matrix-match";
  }

  if (options.length > 0) {
    return answerIndexes.length > 1 ? "multiple" : "single";
  }

  const answerText = String(question?.answerText || "").trim();
  if (answerText) {
    return "descriptive";
  }

  return "";
}

async function main() {
  await connectDB();

  const requestedSchoolKey =
    normalizeKey(process.env.SCHOOL_KEY) || normalizeKey(parseArg("school"));
  const requestedLimit = Number.parseInt(parseArg("limit"), 10);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 0;

  const schools = requestedSchoolKey
    ? [
        {
          key: requestedSchoolKey,
          displayName: requestedSchoolKey,
        },
      ]
    : await School.find({})
        .select("key displayName")
        .sort({ displayName: 1 })
        .lean();

  for (const school of schools) {
    const schoolKey = normalizeKey(school?.key);
    if (!schoolKey) {
      continue;
    }

    const { Question: QuestionModel } = await getTenantModels(schoolKey, [
      "Question",
    ]);

    const query = {
      $or: [{ type: { $exists: false } }, { type: null }, { type: "" }],
    } as const;

    const questionQuery = QuestionModel.find(query)
      .select("_id type options answerIndexes matrixOptions matrixAnswers answerText")
      .lean();

    if (limit > 0) {
      questionQuery.limit(limit);
    }

    const questions = (await questionQuery) as any[];

    console.log(
      `[question-types] ${schoolKey}: found ${questions.length} questions missing type`,
    );

    let updatedCount = 0;
    let skippedCount = 0;

    for (const question of questions) {
      const inferredType = inferQuestionType(question);
      if (!inferredType) {
        skippedCount += 1;
        continue;
      }

      await QuestionModel.updateOne(
        { _id: question._id },
        { $set: { type: inferredType } },
      );
      updatedCount += 1;
    }

    console.log(
      `[question-types] ${schoolKey}: updated ${updatedCount}, skipped ${skippedCount}`,
    );
  }
}

main().catch((error) => {
  console.error("[question-types] backfill failed:", error);
  process.exitCode = 1;
});
