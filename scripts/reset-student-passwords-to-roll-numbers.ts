/*
  Reset student passwords to the saved phone-number default.

  Default mode is dry-run. Use --commit to apply changes.

  Examples:
    npm run reset:student-passwords-to-phone -- --school=all
    npm run reset:student-passwords-to-phone -- --school=my_school --commit
*/

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { buildArchiveFilter } from "../lib/archive.ts";
import { connectDB } from "../lib/db.ts";
import { getTenantModels } from "../lib/db-tenant.ts";
import {
  clearStudentLoginRateLimit,
  clearStudentSession,
} from "../lib/redis.ts";
import {
  getDefaultStudentPassword,
} from "../lib/user-credentials.ts";
import School from "../models/School.ts";

type ParsedArgs = {
  clearAuthState: boolean;
  commit: boolean;
  includeArchived: boolean;
  help: boolean;
  schoolKeys: string[] | "all";
};

type TenantSummary = {
  schoolKey: string;
  totalStudents: number;
  alreadyDefault: number;
  resetCount: number;
  skippedMissingPhoneNumber: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    clearAuthState: false,
    commit: false,
    includeArchived: false,
    help: false,
    schoolKeys: "all",
  };

  for (const arg of argv) {
    if (arg === "--commit") {
      args.commit = true;
      continue;
    }
    if (arg === "--clear-auth-state") {
      args.clearAuthState = true;
      continue;
    }
    if (arg === "--include-archived") {
      args.includeArchived = true;
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
              .map((part) => part.trim().toLowerCase())
              .filter(Boolean);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`
Reset student passwords so the stored password matches the student's saved phone number digits.

Options:
  --school=<key|key1,key2|all>   Limit the reset to specific school keys. Default: all
  --commit                       Apply changes. Without this flag, the script only previews
  --clear-auth-state             Clear student session locks and login rate limits even if the password already matches the saved phone number digits
  --include-archived             Include archived student records
  --help                         Show this help text
`);
}

async function resolveSchoolKeys(schoolKeys: ParsedArgs["schoolKeys"]) {
  const schools = await School.find({})
    .select("key displayName")
    .sort({ displayName: 1 })
    .lean();

  const availableSchoolKeys = schools
    .map((school) => String(school?.key || "").trim().toLowerCase())
    .filter(Boolean);

  if (schoolKeys === "all") {
    return availableSchoolKeys;
  }

  const availableSchoolKeySet = new Set(availableSchoolKeys);
  const resolvedKeys = schoolKeys.filter((schoolKey) =>
    availableSchoolKeySet.has(schoolKey),
  );

  const missingSchoolKeys = schoolKeys.filter(
    (schoolKey) => !availableSchoolKeySet.has(schoolKey),
  );
  if (missingSchoolKeys.length > 0) {
    console.warn(
      `[student-password-reset] skipping unknown school keys: ${missingSchoolKeys.join(", ")}`,
    );
  }

  return resolvedKeys;
}

async function resetTenantStudentPasswords(
  schoolKey: string,
  args: ParsedArgs,
): Promise<TenantSummary> {
  const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
  const students = await UserModel.find({
    role: "student",
    ...buildArchiveFilter(args.includeArchived),
  })
    .select("_id rollNumber mobileNumber passwordHash")
    .lean();

  let alreadyDefault = 0;
  let resetCount = 0;
  let skippedMissingPhoneNumber = 0;
  const authCleanupTargets: Array<{ studentId: string; rollNumber: string }> = [];

  const updateOperations: Array<{
    updateOne: {
      filter: { _id: unknown };
      update: {
        $set: { passwordHash: string };
        $unset: {
          activeStudentSessionId: 1;
          activeStudentSessionLastSeenAt: 1;
        };
      };
    };
  }> = [];

  for (const student of students) {
    const rollNumber = String(student?.rollNumber || "").trim();
    const defaultPassword = getDefaultStudentPassword(student?.mobileNumber);
    if (!defaultPassword) {
      skippedMissingPhoneNumber += 1;
      continue;
    }

    const currentPasswordHash = String(student?.passwordHash || "");
    let matchesDefaultPassword = false;

    if (currentPasswordHash) {
      try {
        matchesDefaultPassword = await bcrypt.compare(
          defaultPassword,
          currentPasswordHash,
        );
      } catch {
        matchesDefaultPassword = false;
      }
    }

    if (matchesDefaultPassword) {
      alreadyDefault += 1;
      if (args.commit && args.clearAuthState) {
        authCleanupTargets.push({
          studentId: String(student._id),
          rollNumber,
        });
      }
      continue;
    }

    resetCount += 1;

    if (!args.commit) {
      continue;
    }

    authCleanupTargets.push({
      studentId: String(student._id),
      rollNumber,
    });

    updateOperations.push({
      updateOne: {
        filter: { _id: student._id },
        update: {
          $set: {
            passwordHash: await bcrypt.hash(defaultPassword, 10),
          },
          $unset: {
            activeStudentSessionId: 1,
            activeStudentSessionLastSeenAt: 1,
          },
        },
      },
    });

    const processedCount = alreadyDefault + resetCount + skippedMissingPhoneNumber;
    if (processedCount % 100 === 0 || processedCount === students.length) {
      console.log(
        `[student-password-reset] ${schoolKey}: processed=${processedCount}/${students.length}`,
      );
    }
  }

  if (args.commit && updateOperations.length > 0) {
    await UserModel.bulkWrite(updateOperations, { ordered: false });
  }

  if (args.commit && authCleanupTargets.length > 0) {
    for (const [index, target] of authCleanupTargets.entries()) {
      await clearStudentSession(schoolKey, target.studentId).catch(
        () => undefined,
      );
      await clearStudentLoginRateLimit(schoolKey, target.rollNumber).catch(
        () => undefined,
      );

      const cleanedCount = index + 1;
      if (
        cleanedCount % 100 === 0 ||
        cleanedCount === authCleanupTargets.length
      ) {
        console.log(
          `[student-password-reset] ${schoolKey}: auth-cleanup=${cleanedCount}/${authCleanupTargets.length}`,
        );
      }
    }
  }

  return {
    schoolKey,
    totalStudents: students.length,
    alreadyDefault,
    resetCount,
    skippedMissingPhoneNumber,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  await connectDB();

  const schoolKeys = await resolveSchoolKeys(args.schoolKeys);
  if (!schoolKeys.length) {
    throw new Error("No matching schools found for the requested reset.");
  }

  console.log(
    `[student-password-reset] mode=${args.commit ? "commit" : "dry-run"} schools=${schoolKeys.join(", ")}`,
  );

  const summaries: TenantSummary[] = [];
  for (const schoolKey of schoolKeys) {
    const summary = await resetTenantStudentPasswords(schoolKey, args);
    summaries.push(summary);
    console.log(
      `[student-password-reset] ${schoolKey}: total=${summary.totalStudents}, already-default=${summary.alreadyDefault}, reset=${summary.resetCount}, skipped-missing-phone=${summary.skippedMissingPhoneNumber}`,
    );
  }

  const totals = summaries.reduce(
    (accumulator, summary) => ({
      totalStudents: accumulator.totalStudents + summary.totalStudents,
      alreadyDefault: accumulator.alreadyDefault + summary.alreadyDefault,
      resetCount: accumulator.resetCount + summary.resetCount,
      skippedMissingPhoneNumber:
        accumulator.skippedMissingPhoneNumber + summary.skippedMissingPhoneNumber,
    }),
    {
      totalStudents: 0,
      alreadyDefault: 0,
      resetCount: 0,
      skippedMissingPhoneNumber: 0,
    },
  );

  console.log(
    `[student-password-reset] complete: total=${totals.totalStudents}, already-default=${totals.alreadyDefault}, reset=${totals.resetCount}, skipped-missing-phone=${totals.skippedMissingPhoneNumber}`,
  );
}

main()
  .catch((error) => {
    console.error("[student-password-reset] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
