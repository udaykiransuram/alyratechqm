/*
  Split combined class names into separate Class + AcademicSection data.

  Default mode is dry-run. Use --commit to apply changes.

  Examples:
    npx ts-node --esm scripts/migrate-class-sections.ts --school=all
    npx ts-node --esm scripts/migrate-class-sections.ts --school=my_school --commit
    npx ts-node --esm scripts/migrate-class-sections.ts --school=my_school --commit --delete-source-classes
    npx ts-node --esm scripts/migrate-class-sections.ts --school=my_school --mapping=./scripts/class-section-mapping.example.json --commit
*/

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

type MappingEntry =
  | {
      className: string;
      sectionName: string;
    }
  | null;

type MappingFile = Record<string, MappingEntry>;

type SplitDecision = {
  sourceName: string;
  className: string;
  sectionName: string;
  reason: "mapping" | "auto";
};

type TenantModels = {
  Class: any;
  AcademicSection: any;
  User: any;
  Question: any;
  QuestionPaper: any;
};

type TenantSummary = {
  schoolKey: string;
  plannedClasses: number;
  skippedClasses: string[];
  createdClasses: number;
  reusedClasses: number;
  createdSections: number;
  reusedSections: number;
  questionsUpdated: number;
  papersUpdated: number;
  studentUsersUpdated: number;
  staffUsersUpdated: number;
  deletedSourceClasses: number;
  sourceClassesSafeToDelete: string[];
};

type ParsedArgs = {
  commit: boolean;
  deleteSourceClasses: boolean;
  schoolKeys: string[] | "all";
  classNames: string[] | "all";
  mappingPath?: string;
  help: boolean;
};

let baseModulesPromise: Promise<{
  connectDB: () => Promise<any>;
  School: any;
  ClassModel: any;
  AcademicSectionModel: any;
  UserModel: any;
  QuestionModel: any;
  QuestionPaperModel: any;
}> | null = null;

async function loadBaseModules() {
  if (!baseModulesPromise) {
    baseModulesPromise = Promise.all([
      import("../lib/db.ts"),
      import("../models/School.ts"),
      import("../models/Class.ts"),
      import("../models/AcademicSection.ts"),
      import("../models/User.ts"),
      import("../models/Question.ts"),
      import("../models/QuestionPaper.ts"),
    ]).then(
      ([dbModule, schoolModule, classModule, sectionModule, userModule, questionModule, paperModule]) => ({
        connectDB: dbModule.connectDB,
        School: schoolModule.default,
        ClassModel: classModule.default,
        AcademicSectionModel: sectionModule.default,
        UserModel: userModule.default,
        QuestionModel: questionModule.default,
        QuestionPaperModel: paperModule.default,
      }),
    );
  }

  return baseModulesPromise;
}

const ROMAN_NUMERAL_RE = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i;
const CLASS_KEYWORD_RE = /^(class|grade|std|standard|nursery|prep|kg|lkg|ukg|prekg|pre-kg)$/i;

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    commit: false,
    deleteSourceClasses: false,
    schoolKeys: "all",
    classNames: "all",
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--commit") {
      args.commit = true;
      continue;
    }
    if (arg === "--delete-source-classes") {
      args.deleteSourceClasses = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg.startsWith("--school=")) {
      const raw = arg.slice("--school=".length).trim();
      args.schoolKeys =
        !raw || raw === "all"
          ? "all"
          : raw
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean);
      continue;
    }
    if (arg.startsWith("--class=")) {
      const raw = arg.slice("--class=".length).trim();
      args.classNames =
        !raw || raw === "all"
          ? "all"
          : raw
              .split(",")
              .map((part) => normalizeWhitespace(part))
              .filter(Boolean);
      continue;
    }
    if (arg.startsWith("--mapping=")) {
      const raw = arg.slice("--mapping=".length).trim();
      if (raw) args.mappingPath = raw;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`
Split combined class names into separate class + academic section references.

Options:
  --school=<key|key1,key2|all>   Limit migration to specific schools. Default: all
  --class=<name|name1,name2>     Limit migration to exact source class name(s)
  --mapping=<path>               Optional JSON mapping file for exact class-name splits
  --commit                       Apply changes. Without this flag the script only previews
  --delete-source-classes        Delete old combined class documents after reference updates
  --help                         Show this help text

Mapping file format:
  {
    "10 A": { "className": "10", "sectionName": "A" },
    "10-B": { "className": "10", "sectionName": "B" },
    "Nursery Red": { "className": "Nursery", "sectionName": "Red" },
    "Leave As Is": null
  }
`);
}

function sanitizeSchoolKey(key: string) {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

function dbNameForSchool(key: string) {
  return `school_db_${sanitizeSchoolKey(key)}`;
}

function normalizeWhitespace(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeSectionName(value: string) {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return trimmed;
  if (/^[a-z]{1,5}$/i.test(trimmed) && trimmed.length <= 5) {
    return trimmed.toUpperCase();
  }
  return trimmed
    .split(" ")
    .map((part) =>
      part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part,
    )
    .join(" ");
}

function looksLikeBaseClass(baseName: string) {
  const normalized = normalizeWhitespace(baseName);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  if (tokens.some((token) => /\d/.test(token))) return true;
  if (tokens.some((token) => ROMAN_NUMERAL_RE.test(token))) return true;
  if (tokens.some((token) => CLASS_KEYWORD_RE.test(token))) return true;
  if (tokens.length >= 2) return true;
  return false;
}

function autoSplitClassName(sourceName: string): SplitDecision | null {
  const normalized = normalizeWhitespace(sourceName);
  if (!normalized) return null;

  const patterns = [
    /^(.*?)[\s/_-]+([A-Za-z]{1,8})$/,
    /^(.*?\d)([A-Za-z]{1,8})$/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const className = normalizeWhitespace(match[1]);
    const sectionName = normalizeSectionName(match[2]);

    if (!className || !sectionName) continue;
    if (!looksLikeBaseClass(className)) continue;
    if (normalizeKey(className) === normalizeKey(normalized)) continue;

    return {
      sourceName: normalized,
      className,
      sectionName,
      reason: "auto",
    };
  }

  return null;
}

function loadMapping(mappingPath?: string): Map<string, MappingEntry> {
  if (!mappingPath) return new Map();

  const resolvedPath = path.resolve(process.cwd(), mappingPath);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const parsed = JSON.parse(raw) as MappingFile;
  const mapping = new Map<string, MappingEntry>();

  Object.entries(parsed || {}).forEach(([key, value]) => {
    mapping.set(normalizeKey(key), value);
  });

  return mapping;
}

function decideSplit(
  sourceName: string,
  mapping: Map<string, MappingEntry>,
): SplitDecision | null {
  const mappingValue = mapping.get(normalizeKey(sourceName));
  if (mappingValue !== undefined) {
    if (mappingValue === null) return null;
    return {
      sourceName: normalizeWhitespace(sourceName),
      className: normalizeWhitespace(mappingValue.className),
      sectionName: normalizeSectionName(mappingValue.sectionName),
      reason: "mapping",
    };
  }

  return autoSplitClassName(sourceName);
}

async function getTenantModels(schoolKey: string): Promise<TenantModels> {
  const {
    connectDB,
    ClassModel,
    AcademicSectionModel,
    UserModel,
    QuestionModel,
    QuestionPaperModel,
  } = await loadBaseModules();

  await connectDB();
  const conn = mongoose.connection.useDb(dbNameForSchool(schoolKey), {
    useCache: false,
  });

  return {
    Class: conn.models.Class || conn.model("Class", ClassModel.schema),
    AcademicSection:
      conn.models.AcademicSection ||
      conn.model("AcademicSection", AcademicSectionModel.schema),
    User: conn.models.User || conn.model("User", UserModel.schema),
    Question:
      conn.models.Question || conn.model("Question", QuestionModel.schema),
    QuestionPaper:
      conn.models.QuestionPaper ||
      conn.model("QuestionPaper", QuestionPaperModel.schema),
  };
}

async function getTargetClass(
  models: TenantModels,
  cache: Map<string, any>,
  className: string,
  sourceClass: any,
  commit: boolean,
  summary: TenantSummary,
) {
  const cacheKey = normalizeKey(className);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const existing = await models.Class.findOne({ name: className }).lean();
  if (existing) {
    cache.set(cacheKey, existing);
    summary.reusedClasses += 1;
    return existing;
  }

  if (!commit) {
    const preview = {
      _id: new mongoose.Types.ObjectId(),
      name: className,
      description: sourceClass?.description || undefined,
    };
    cache.set(cacheKey, preview);
    summary.createdClasses += 1;
    return preview;
  }

  const created = await models.Class.create({
    name: className,
    description: sourceClass?.description || undefined,
  });
  const createdLean = await models.Class.findById(created._id).lean();
  cache.set(cacheKey, createdLean);
  summary.createdClasses += 1;
  return createdLean;
}

async function getTargetSection(
  models: TenantModels,
  cache: Map<string, any>,
  targetClass: any,
  sectionName: string,
  sourceName: string,
  commit: boolean,
  summary: TenantSummary,
) {
  const cacheKey = `${String(targetClass._id)}::${normalizeKey(sectionName)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const existing = await models.AcademicSection.findOne({
    class: targetClass._id,
    name: sectionName,
  }).lean();

  if (existing) {
    cache.set(cacheKey, existing);
    summary.reusedSections += 1;
    return existing;
  }

  if (!commit) {
    const preview = {
      _id: new mongoose.Types.ObjectId(),
      class: targetClass._id,
      name: sectionName,
      description: `Migrated from ${sourceName}`,
      isActive: true,
    };
    cache.set(cacheKey, preview);
    summary.createdSections += 1;
    return preview;
  }

  const created = await models.AcademicSection.create({
    class: targetClass._id,
    name: sectionName,
    description: `Migrated from ${sourceName}`,
    isActive: true,
  });
  const createdLean = await models.AcademicSection.findById(created._id).lean();
  cache.set(cacheKey, createdLean);
  summary.createdSections += 1;
  return createdLean;
}

async function migrateStaffUsersForSourceClass(
  models: TenantModels,
  sourceClassId: any,
  targetClassId: any,
  targetSectionId: any,
  commit: boolean,
): Promise<number> {
  const users = await models.User.find({
    role: { $ne: "student" },
    classIds: sourceClassId,
  })
    .select("classIds academicSectionIds hasAllSections")
    .lean();

  let updated = 0;

  for (const user of users) {
    const existingClassIds = Array.isArray((user as any).classIds)
      ? (user as any).classIds.map((value: any) => String(value))
      : [];
    const existingSectionIds = Array.isArray((user as any).academicSectionIds)
      ? (user as any).academicSectionIds.map((value: any) => String(value))
      : [];

    const nextClassIds = Array.from(
      new Set(
        existingClassIds.map((classId: string) =>
          classId === String(sourceClassId) ? String(targetClassId) : classId,
        ),
      ),
    );
    const nextSectionIds = Array.from(
      new Set([...existingSectionIds, String(targetSectionId)]),
    );

    const classIdsChanged =
      JSON.stringify(existingClassIds.sort()) !==
      JSON.stringify([...nextClassIds].sort());
    const sectionIdsChanged =
      JSON.stringify(existingSectionIds.sort()) !==
      JSON.stringify([...nextSectionIds].sort());
    const shouldForceSectionRestriction =
      nextSectionIds.length > 0 && (user as any).hasAllSections !== false;

    if (!classIdsChanged && !sectionIdsChanged && !shouldForceSectionRestriction) {
      continue;
    }

    updated += 1;

    if (commit) {
      await models.User.updateOne(
        { _id: (user as any)._id },
        {
          $set: {
            classIds: nextClassIds,
            academicSectionIds: nextSectionIds,
            hasAllSections: nextSectionIds.length > 0 ? false : (user as any).hasAllSections,
          },
        },
      );
    }
  }

  return updated;
}

async function canDeleteSourceClass(models: TenantModels, sourceClassId: any) {
  const [questions, papers, studentUsers, staffUsers] = await Promise.all([
    models.Question.countDocuments({ class: sourceClassId }),
    models.QuestionPaper.countDocuments({ class: sourceClassId }),
    models.User.countDocuments({ class: sourceClassId }),
    models.User.countDocuments({ classIds: sourceClassId }),
  ]);

  return questions === 0 && papers === 0 && studentUsers === 0 && staffUsers === 0;
}

async function migrateTenant(
  schoolKey: string,
  mapping: Map<string, MappingEntry>,
  args: ParsedArgs,
): Promise<TenantSummary> {
  const models = await getTenantModels(schoolKey);
  const allClasses = await models.Class.find({}).sort({ name: 1 }).lean();
  const targetClassKeys =
    args.classNames === "all"
      ? null
      : new Set(args.classNames.map((className) => normalizeKey(className)));
  const classes = targetClassKeys
    ? allClasses.filter((sourceClass: any) =>
        targetClassKeys.has(normalizeKey(String(sourceClass?.name || ""))),
      )
    : allClasses;

  const summary: TenantSummary = {
    schoolKey,
    plannedClasses: 0,
    skippedClasses: [],
    createdClasses: 0,
    reusedClasses: 0,
    createdSections: 0,
    reusedSections: 0,
    questionsUpdated: 0,
    papersUpdated: 0,
    studentUsersUpdated: 0,
    staffUsersUpdated: 0,
    deletedSourceClasses: 0,
    sourceClassesSafeToDelete: [],
  };

  const classCache = new Map<string, any>();
  const sectionCache = new Map<string, any>();

  for (const sourceClass of classes) {
    const split = decideSplit(String((sourceClass as any).name || ""), mapping);
    if (!split) {
      summary.skippedClasses.push(String((sourceClass as any).name || ""));
      continue;
    }

    if (normalizeKey(split.className) === normalizeKey(split.sourceName)) {
      summary.skippedClasses.push(String((sourceClass as any).name || ""));
      continue;
    }

    summary.plannedClasses += 1;

    const targetClass = await getTargetClass(
      models,
      classCache,
      split.className,
      sourceClass,
      args.commit,
      summary,
    );

    const targetSection = await getTargetSection(
      models,
      sectionCache,
      targetClass,
      split.sectionName,
      split.sourceName,
      args.commit,
      summary,
    );

    const questionResult = args.commit
      ? await models.Question.updateMany(
          { class: (sourceClass as any)._id },
          { $set: { class: targetClass._id } },
        )
      : {
          modifiedCount: await models.Question.countDocuments({
            class: (sourceClass as any)._id,
          }),
        };
    summary.questionsUpdated += Number(questionResult.modifiedCount || 0);

    const papers = await models.QuestionPaper.find({ class: (sourceClass as any)._id })
      .select("assignedAcademicSections")
      .lean();
    summary.papersUpdated += papers.length;

    if (args.commit) {
      for (const paper of papers) {
        const nextAssignedAcademicSections = Array.from(
          new Set([
            ...((paper as any).assignedAcademicSections || []).map((value: any) => String(value)),
            String(targetSection._id),
          ]),
        );

        await models.QuestionPaper.updateOne(
          { _id: (paper as any)._id },
          {
            $set: {
              class: targetClass._id,
              assignedAcademicSections: nextAssignedAcademicSections,
            },
          },
        );
      }
    }

    const studentResult = args.commit
      ? await models.User.updateMany(
          { role: "student", class: (sourceClass as any)._id },
          {
            $set: {
              class: targetClass._id,
              academicSection: targetSection._id,
            },
          },
        )
      : {
          modifiedCount: await models.User.countDocuments({
            role: "student",
            class: (sourceClass as any)._id,
          }),
        };
    summary.studentUsersUpdated += Number(studentResult.modifiedCount || 0);

    summary.staffUsersUpdated += await migrateStaffUsersForSourceClass(
      models,
      (sourceClass as any)._id,
      targetClass._id,
      targetSection._id,
      args.commit,
    );

    const safeToDelete = await canDeleteSourceClass(models, (sourceClass as any)._id);
    if (safeToDelete) {
      summary.sourceClassesSafeToDelete.push(String((sourceClass as any).name || ""));
    }

    if (args.commit && args.deleteSourceClasses && safeToDelete) {
      await models.Class.deleteOne({ _id: (sourceClass as any)._id });
      summary.deletedSourceClasses += 1;
    }
  }

  return summary;
}

function printTenantSummary(summary: TenantSummary) {
  console.log(`\n[${summary.schoolKey}] Migration summary`);
  console.log(`  Planned source classes: ${summary.plannedClasses}`);
  console.log(`  Skipped source classes: ${summary.skippedClasses.length}`);
  console.log(`  Created classes: ${summary.createdClasses}`);
  console.log(`  Reused classes: ${summary.reusedClasses}`);
  console.log(`  Created sections: ${summary.createdSections}`);
  console.log(`  Reused sections: ${summary.reusedSections}`);
  console.log(`  Questions updated: ${summary.questionsUpdated}`);
  console.log(`  Question papers updated: ${summary.papersUpdated}`);
  console.log(`  Student users updated: ${summary.studentUsersUpdated}`);
  console.log(`  Teacher/admin users updated: ${summary.staffUsersUpdated}`);
  console.log(`  Source classes safe to delete: ${summary.sourceClassesSafeToDelete.length}`);
  console.log(`  Source classes deleted: ${summary.deletedSourceClasses}`);

  if (summary.skippedClasses.length) {
    console.log("  Skipped class names:");
    summary.skippedClasses.forEach((name) => console.log(`    - ${name}`));
  }
}

async function resolveSchoolKeys(rawSchoolKeys: string[] | "all") {
  if (rawSchoolKeys !== "all") {
    return rawSchoolKeys;
  }

  const { School } = await loadBaseModules();
  const schools = await School.find({}).sort({ key: 1 }).lean();
  return schools.map((school: any) => String(school.key)).filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const { connectDB } = await loadBaseModules();
  await connectDB();

  const mapping = loadMapping(args.mappingPath);
  const schoolKeys = await resolveSchoolKeys(args.schoolKeys);

  if (!schoolKeys.length) {
    console.log("No schools found for migration.");
    return;
  }

  console.log(
    args.commit
      ? "Running class-section migration in COMMIT mode."
      : "Running class-section migration in DRY-RUN mode.",
  );
  console.log(`Target schools: ${schoolKeys.join(", ")}`);
  if (args.classNames !== "all") {
    console.log(`Target source classes: ${args.classNames.join(", ")}`);
  }
  if (args.mappingPath) {
    console.log(`Using mapping file: ${path.resolve(process.cwd(), args.mappingPath)}`);
  }
  if (args.deleteSourceClasses) {
    console.log("Source combined class documents will be deleted when safe.");
  }

  const summaries: TenantSummary[] = [];

  for (const schoolKey of schoolKeys) {
    summaries.push(await migrateTenant(schoolKey, mapping, args));
  }

  console.log("\n=== Final Summary ===");
  summaries.forEach(printTenantSummary);

  const totals = summaries.reduce(
    (acc, summary) => {
      acc.plannedClasses += summary.plannedClasses;
      acc.createdClasses += summary.createdClasses;
      acc.reusedClasses += summary.reusedClasses;
      acc.createdSections += summary.createdSections;
      acc.reusedSections += summary.reusedSections;
      acc.questionsUpdated += summary.questionsUpdated;
      acc.papersUpdated += summary.papersUpdated;
      acc.studentUsersUpdated += summary.studentUsersUpdated;
      acc.staffUsersUpdated += summary.staffUsersUpdated;
      acc.deletedSourceClasses += summary.deletedSourceClasses;
      acc.skippedClasses += summary.skippedClasses.length;
      return acc;
    },
    {
      plannedClasses: 0,
      createdClasses: 0,
      reusedClasses: 0,
      createdSections: 0,
      reusedSections: 0,
      questionsUpdated: 0,
      papersUpdated: 0,
      studentUsersUpdated: 0,
      staffUsersUpdated: 0,
      deletedSourceClasses: 0,
      skippedClasses: 0,
    },
  );

  console.log(`\nSchools processed: ${summaries.length}`);
  console.log(`Planned source classes: ${totals.plannedClasses}`);
  console.log(`Skipped source classes: ${totals.skippedClasses}`);
  console.log(`Created classes: ${totals.createdClasses}`);
  console.log(`Created sections: ${totals.createdSections}`);
  console.log(`Questions updated: ${totals.questionsUpdated}`);
  console.log(`Question papers updated: ${totals.papersUpdated}`);
  console.log(`Student users updated: ${totals.studentUsersUpdated}`);
  console.log(`Teacher/admin users updated: ${totals.staffUsersUpdated}`);
  console.log(`Deleted source classes: ${totals.deletedSourceClasses}`);

  if (!args.commit) {
    console.log("\nDry run only. Re-run with --commit to apply changes.");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
