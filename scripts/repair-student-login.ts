/*
  Diagnose and repair a single student login.

  Default mode is dry-run. Use --commit to apply changes.

  Examples:
    npm run repair:student-login -- --school=greenwood_day --roll=11960
    npm run repair:student-login -- --school=greenwood_day --roll=11960 --commit
*/

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { connectDB } from "../lib/db.ts";
import { getTenantModels } from "../lib/db-tenant.ts";
import {
  clearStudentLoginRateLimit,
  clearStudentSession,
  readStudentSession,
} from "../lib/redis.ts";
import { isStudentSessionFresh } from "../lib/student-session.ts";
import {
  buildStudentRollNumberMatcher,
  getDefaultStudentPassword,
  normalizeRollNumber,
} from "../lib/user-credentials.ts";
import School from "../models/School.ts";

type ParsedArgs = {
  commit: boolean;
  help: boolean;
  rollNumber: string;
  schoolKey: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    commit: false,
    help: false,
    rollNumber: "",
    schoolKey: "",
  };

  for (const arg of argv) {
    if (arg === "--commit") {
      args.commit = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg.startsWith("--school=")) {
      args.schoolKey = String(arg.slice("--school=".length) || "")
        .trim()
        .toLowerCase();
      continue;
    }
    if (arg.startsWith("--roll=")) {
      args.rollNumber = normalizeRollNumber(arg.slice("--roll=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`
Diagnose and repair a single student login.

Options:
  --school=<schoolKey>           Required school key
  --roll=<rollNumber>            Required student roll number
  --commit                       Reset password to roll number and clear auth state
  --help                         Show this help text
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.schoolKey || !args.rollNumber) {
    printHelp();
    throw new Error("Both --school and --roll are required.");
  }

  const defaultPassword = getDefaultStudentPassword(args.rollNumber);
  if (!defaultPassword) {
    throw new Error("Roll number is required to repair a student login.");
  }

  await connectDB();

  const school = await School.findOne({ key: args.schoolKey })
    .select("key displayName")
    .lean();
  if (!school) {
    throw new Error(`School not found for key: ${args.schoolKey}`);
  }

  const { User: UserModel } = await getTenantModels(args.schoolKey, ["User"]);
  const matches = await UserModel.find({
    role: "student",
    rollNumber: buildStudentRollNumberMatcher(args.rollNumber),
  })
    .select(
      "_id name email rollNumber passwordHash isArchived archivedAt +activeStudentSessionId +activeStudentSessionLastSeenAt",
    )
    .lean();

  const activeMatches = matches.filter(
    (student: any) => student?.isArchived !== true,
  );
  const archivedMatches = matches.filter(
    (student: any) => student?.isArchived === true,
  );

  console.log(
    `[student-login-repair] school=${args.schoolKey} roll=${args.rollNumber} matches=${matches.length} active=${activeMatches.length} archived=${archivedMatches.length}`,
  );

  for (const student of matches) {
    const passwordHash = String(student?.passwordHash || "");
    let passwordMatchesRollNumber = false;

    if (passwordHash) {
      try {
        passwordMatchesRollNumber = await bcrypt.compare(
          defaultPassword,
          passwordHash,
        );
      } catch {
        passwordMatchesRollNumber = false;
      }
    }

    const dbSessionId = String(student?.activeStudentSessionId || "").trim();
    const dbSessionFresh = dbSessionId
      ? isStudentSessionFresh(student?.activeStudentSessionLastSeenAt)
      : false;
    const redisSessionId = await readStudentSession(
      args.schoolKey,
      String(student._id),
    ).catch(() => null);

    console.log(
      `[student-login-repair] student=${String(student._id)} name=${JSON.stringify(String(student?.name || ""))} archived=${student?.isArchived === true ? "yes" : "no"} password-hash=${passwordHash ? "yes" : "no"} password-matches-roll=${passwordMatchesRollNumber ? "yes" : "no"} db-session=${dbSessionId ? "yes" : "no"} db-session-fresh=${dbSessionFresh ? "yes" : "no"} redis-session=${redisSessionId ? "yes" : "no"}`,
    );
  }

  if (activeMatches.length === 0) {
    throw new Error("No active student was found for that roll number.");
  }

  if (activeMatches.length > 1) {
    throw new Error(
      "Multiple active students share this roll number. Student login will fail until the duplicate is fixed.",
    );
  }

  const student = activeMatches[0];
  if (!args.commit) {
    console.log(
      "[student-login-repair] dry-run only. Re-run with --commit to reset the password to the roll number and clear auth state.",
    );
    return;
  }

  await UserModel.updateOne(
    {
      _id: student._id,
      role: "student",
    },
    {
      $set: {
        passwordHash: await bcrypt.hash(defaultPassword, 10),
      },
      $unset: {
        activeStudentSessionId: 1,
        activeStudentSessionLastSeenAt: 1,
      },
    },
  );

  await clearStudentSession(args.schoolKey, String(student._id)).catch(
    () => undefined,
  );
  await clearStudentLoginRateLimit(args.schoolKey, args.rollNumber).catch(
    () => undefined,
  );

  console.log(
    `[student-login-repair] repaired ${args.rollNumber}: password reset to roll number, active session cleared, login rate limit cleared.`,
  );
}

main()
  .catch((error) => {
    console.error("[student-login-repair] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
