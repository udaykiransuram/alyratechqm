import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

import { buildArchiveFilter, buildRestoreUpdate } from "@/lib/archive";
import type { StudentCourseSummary } from "@/lib/courses/types";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { listStudentCoursesPage } from "@/lib/server/student-courses";
import {
  maskSummerCrashId,
  normalizeSummerCrashClassBandKey,
  normalizeSummerCrashNameKey,
  normalizeSummerCrashPhone,
  normalizeSummerCrashText,
  resolveSummerCrashDestinationHref,
} from "@/lib/summer-crash/shared";
import { provisionTenant } from "@/lib/tenant-provision";
import {
  getDefaultStudentPassword,
  isUsingDefaultStudentPassword,
  validatePasswordInput,
} from "@/lib/user-credentials";
import SummerCrashCampaign, {
  type ISummerCrashCampaign,
  type ISummerCrashCampaignClassMapping,
} from "@/models/SummerCrashCampaign";
import SummerCrashEnrollment from "@/models/SummerCrashEnrollment";
import School from "@/models/School";
import {
  SUMMER_CRASH_DEFAULT_CLASS_BANDS,
  SUMMER_CRASH_DISPLAY_NAME,
  SUMMER_CRASH_SCHOOL_KEY,
  SUMMER_CRASH_SIGNIN_PATH,
  SUMMER_CRASH_SUPPORT_CONTACT,
  SUMMER_CRASH_WELCOME_PATH,
  isSummerCrashSchoolKey,
} from "@/lib/summer-crash/constants";

const SUMMER_CRASH_SUMMER_ID_PREFIX = "SC";
const SUMMER_CRASH_SUMMER_ID_MIN = 100000;
const SUMMER_CRASH_SUMMER_ID_MAX = 999999;

export type SummerCrashPublicClassBand = {
  classBand: string;
  className: string;
};

export type SummerCrashLookupMatch = {
  studentName: string;
  guardianName: string;
  classBand: string;
  summerId: string;
  maskedSummerId: string;
};

export type SummerCrashStudentState = {
  title: string;
  supportContact: string;
  studentName: string;
  guardianName: string;
  classBand: string;
  summerId: string;
  requiresPasswordSetup: boolean;
  courses: StudentCourseSummary[];
  destinationHref: string;
};

function buildDefaultSummerCrashClassMappings() {
  return SUMMER_CRASH_DEFAULT_CLASS_BANDS.map((classBand, index) => ({
    classBand,
    className: classBand,
    courseIds: [],
    sortOrder: index,
  }));
}

function sortSummerCrashClassMappings(
  mappings: ISummerCrashCampaignClassMapping[] | undefined,
) {
  return [...(Array.isArray(mappings) ? mappings : [])].sort((left, right) => {
    return Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0);
  });
}

function normalizeSummerCrashClassMappings(
  mappings: ISummerCrashCampaignClassMapping[] | undefined,
) {
  const normalized = sortSummerCrashClassMappings(mappings)
    .map((mapping, index) => ({
      classBand: normalizeSummerCrashText(mapping?.classBand),
      className:
        normalizeSummerCrashText(mapping?.className) ||
        normalizeSummerCrashText(mapping?.classBand),
      courseIds: Array.from(
        new Set(
          (Array.isArray(mapping?.courseIds) ? mapping.courseIds : [])
            .map((courseId) => String(courseId || "").trim())
            .filter(Boolean),
        ),
      ),
      sortOrder:
        Number.isFinite(Number(mapping?.sortOrder))
          ? Number(mapping?.sortOrder)
          : index,
    }))
    .filter((mapping) => mapping.classBand && mapping.className);

  return normalized.length > 0 ? normalized : buildDefaultSummerCrashClassMappings();
}

function resolveSummerCrashClassMapping(
  campaign: Pick<ISummerCrashCampaign, "classMappings">,
  classBand: string,
) {
  const normalizedClassBand = normalizeSummerCrashClassBandKey(classBand);
  return normalizeSummerCrashClassMappings(campaign.classMappings).find(
    (mapping) =>
      normalizeSummerCrashClassBandKey(mapping.classBand) === normalizedClassBand,
  );
}

function filterCoursesBySummerCrashMapping(params: {
  campaign: Pick<ISummerCrashCampaign, "classMappings">;
  classBand: string;
  courses: StudentCourseSummary[];
}) {
  const mapping = resolveSummerCrashClassMapping(
    params.campaign,
    params.classBand,
  );
  if (!mapping || mapping.courseIds.length === 0) {
    return params.courses;
  }

  const allowedCourseIds = new Set(mapping.courseIds);
  return params.courses.filter((course) => allowedCourseIds.has(course._id));
}

async function generateUniqueSummerCrashId(UserModel: any) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${SUMMER_CRASH_SUMMER_ID_PREFIX}${randomInt(
      SUMMER_CRASH_SUMMER_ID_MIN,
      SUMMER_CRASH_SUMMER_ID_MAX + 1,
    )}`;
    const existing = await UserModel.findOne({
      role: "student",
      rollNumber: candidate,
      ...buildArchiveFilter(false),
    })
      .select("_id")
      .lean();
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("We couldn't generate a Summer ID right now.");
}

async function ensureSummerCrashSchoolProvisioned() {
  await connectDB();

  let school = await School.findOne({ key: SUMMER_CRASH_SCHOOL_KEY })
    .select("_id key displayName")
    .lean();

  if (!school) {
    try {
      await School.create({
        key: SUMMER_CRASH_SCHOOL_KEY,
        displayName: SUMMER_CRASH_DISPLAY_NAME,
      });
    } catch (error) {
      const duplicateKey =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === 11000;
      if (!duplicateKey) {
        throw error;
      }
    }

    school = await School.findOne({ key: SUMMER_CRASH_SCHOOL_KEY })
      .select("_id key displayName")
      .lean();
  }

  await provisionTenant(SUMMER_CRASH_SCHOOL_KEY);

  return school;
}

async function getOrCreateSummerCrashCampaign() {
  await ensureSummerCrashSchoolProvisioned();

  let campaign = await SummerCrashCampaign.findOne({
    summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
  });

  if (!campaign) {
    try {
      campaign = await SummerCrashCampaign.create({
        isActive: true,
        title: SUMMER_CRASH_DISPLAY_NAME,
        summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
        supportContact: SUMMER_CRASH_SUPPORT_CONTACT || undefined,
        classMappings: buildDefaultSummerCrashClassMappings(),
      });
    } catch (error) {
      const duplicateKey =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === 11000;
      if (!duplicateKey) {
        throw error;
      }

      campaign = await SummerCrashCampaign.findOne({
        summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
      });
    }
  }

  if (!campaign) {
    throw new Error("We couldn't prepare the Summer Crash Course right now.");
  }

  return campaign;
}

async function ensureSummerCrashClass(className: string) {
  const normalizedClassName = normalizeSummerCrashText(className);
  if (!normalizedClassName) {
    throw new Error("Class band is required.");
  }

  const { Class: ClassModel } = await getTenantModels(
    SUMMER_CRASH_SCHOOL_KEY,
    ["Class"],
  );

  let classDoc: {
    _id: unknown;
    name?: string;
  } | null = await ClassModel.findOne({
    name: normalizedClassName,
    ...buildArchiveFilter(false),
  })
    .select("_id name")
    .lean();

  if (!classDoc) {
    const archivedClass = await ClassModel.findOne({
      name: normalizedClassName,
      isArchived: true,
    }).select("_id name");

    if (archivedClass?._id) {
      classDoc = await ClassModel.findByIdAndUpdate(
        archivedClass._id,
        {
          ...buildRestoreUpdate(),
        },
        {
          new: true,
          runValidators: true,
        },
      )
        .select("_id name")
        .lean();
    }
  }

  if (!classDoc) {
    try {
      classDoc = await ClassModel.create({
        name: normalizedClassName,
      }).then((doc: any) => ({
        _id: doc._id,
        name: doc.name,
      }));
    } catch (error) {
      const duplicateKey =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === 11000;
      if (!duplicateKey) {
        throw error;
      }

      classDoc = await ClassModel.findOne({
        name: normalizedClassName,
        ...buildArchiveFilter(false),
      })
        .select("_id name")
        .lean();
    }
  }

  if (!classDoc?._id) {
    throw new Error("We couldn't prepare the Summer Crash Course class.");
  }

  return classDoc;
}

async function findSummerCrashEnrollmentByStudentId(studentId: string) {
  return SummerCrashEnrollment.findOne({
    summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
    summerStudentId: studentId,
    status: { $ne: "archived" },
  })
    .sort({ updatedAt: -1 })
    .lean();
}

export async function getSummerCrashPublicConfig() {
  const campaign = await getOrCreateSummerCrashCampaign();

  return {
    isActive: Boolean(campaign.isActive),
    title: normalizeSummerCrashText(campaign.title) || SUMMER_CRASH_DISPLAY_NAME,
    supportContact:
      normalizeSummerCrashText(campaign.supportContact) ||
      SUMMER_CRASH_SUPPORT_CONTACT,
    classBands: normalizeSummerCrashClassMappings(campaign.classMappings).map(
      (mapping) => ({
        classBand: mapping.classBand,
        className: mapping.className,
      }),
    ) satisfies SummerCrashPublicClassBand[],
  };
}

export async function registerSummerCrashStudent(input: {
  studentName: string;
  guardianName: string;
  phone: string;
  classBand: string;
  sourceSchoolName?: string;
}) {
  const studentName = normalizeSummerCrashText(input.studentName);
  const guardianName = normalizeSummerCrashText(input.guardianName);
  const phoneDigits = normalizeSummerCrashPhone(input.phone);
  const classBand = normalizeSummerCrashText(input.classBand);
  const sourceSchoolName = normalizeSummerCrashText(input.sourceSchoolName);

  if (!studentName) {
    throw new Error("Student name is required.");
  }

  if (!guardianName) {
    throw new Error("Guardian name is required.");
  }

  if (phoneDigits.length < 10) {
    throw new Error("Enter a valid phone or WhatsApp number.");
  }

  if (!classBand) {
    throw new Error("Choose a class band to continue.");
  }

  const campaign = await getOrCreateSummerCrashCampaign();
  if (!campaign.isActive) {
    throw new Error("Summer Crash Course registrations are not open right now.");
  }

  const classMapping = resolveSummerCrashClassMapping(campaign, classBand);
  if (!classMapping) {
    throw new Error("This class band is not available for the Summer Crash Course.");
  }

  const classDoc = await ensureSummerCrashClass(classMapping.className);
  const { User: UserModel } = await getTenantModels(SUMMER_CRASH_SCHOOL_KEY, [
    "User",
  ]);

  const studentNameNormalized = normalizeSummerCrashNameKey(studentName);
  const classBandNormalized = normalizeSummerCrashClassBandKey(classBand);
  const existingEnrollment = await SummerCrashEnrollment.findOne({
    campaignId: campaign._id,
    phoneDigits,
    studentNameNormalized,
    classBandNormalized,
  });

  const defaultPassword = getDefaultStudentPassword(phoneDigits);
  if (!defaultPassword) {
    throw new Error("We couldn't create the account without a valid phone number.");
  }

  let summerId = String(existingEnrollment?.summerId || "").trim().toUpperCase();
  let studentRecord: any =
    existingEnrollment?.summerStudentId
      ? await UserModel.findById(existingEnrollment.summerStudentId).select(
          "_id name fatherName mobileNumber passwordHash rollNumber class role",
        )
      : null;

  if (!studentRecord) {
    summerId = summerId || (await generateUniqueSummerCrashId(UserModel));
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    studentRecord = await UserModel.create({
      name: studentName,
      fatherName: guardianName,
      mobileNumber: phoneDigits,
      passwordHash,
      role: "student",
      class: classDoc._id,
      rollNumber: summerId,
      enrolledAt: new Date(),
    });
  } else {
    summerId =
      String(studentRecord.rollNumber || "").trim().toUpperCase() || summerId;
    await UserModel.updateOne(
      {
        _id: studentRecord._id,
      },
      {
        $set: {
          name: studentName,
          fatherName: guardianName,
          mobileNumber: phoneDigits,
          class: classDoc._id,
        },
      },
    );
    studentRecord = await UserModel.findById(studentRecord._id).select(
      "_id name fatherName mobileNumber passwordHash rollNumber class role",
    );
  }

  if (!studentRecord?._id || !summerId) {
    throw new Error("We couldn't prepare the Summer Crash Course account.");
  }

  const requiresPasswordSetup = await isUsingDefaultStudentPassword({
    mobileNumber: studentRecord.mobileNumber,
    passwordHash: studentRecord.passwordHash,
  });

  const updatedEnrollment = await SummerCrashEnrollment.findOneAndUpdate(
    {
      campaignId: campaign._id,
      phoneDigits,
      studentNameNormalized,
      classBandNormalized,
    },
    {
      $set: {
        summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
        summerStudentId: studentRecord._id,
        summerId,
        studentName,
        studentNameNormalized,
        guardianName,
        phone: phoneDigits,
        phoneDigits,
        classBand,
        classBandNormalized,
        sourceSchoolName: sourceSchoolName || undefined,
        status: requiresPasswordSetup ? "setup_pending" : "active",
      },
      $setOnInsert: {
        joinedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  ).lean();

  return {
    campaignTitle:
      normalizeSummerCrashText(campaign.title) || SUMMER_CRASH_DISPLAY_NAME,
    supportContact:
      normalizeSummerCrashText(campaign.supportContact) ||
      SUMMER_CRASH_SUPPORT_CONTACT,
    studentName,
    guardianName,
    classBand,
    sourceSchoolName,
    summerId,
    studentId: String(studentRecord._id),
    autoSignInAllowed: requiresPasswordSetup,
    bootstrapPassword: requiresPasswordSetup ? defaultPassword : "",
    signInPath: SUMMER_CRASH_SIGNIN_PATH,
    enrollment: updatedEnrollment,
  };
}

export async function lookupSummerCrashIdsByPhone(phone: string) {
  const phoneDigits = normalizeSummerCrashPhone(phone);
  if (phoneDigits.length < 10) {
    throw new Error("Enter a valid phone or WhatsApp number.");
  }

  const campaign = await getOrCreateSummerCrashCampaign();
  const matches = await SummerCrashEnrollment.find({
    campaignId: campaign._id,
    phoneDigits,
    status: { $ne: "archived" },
  })
    .select("studentName guardianName classBand summerId")
    .sort({ studentName: 1, classBand: 1, createdAt: 1 })
    .lean();

  if (!Array.isArray(matches) || matches.length === 0) {
    throw new Error(
      "We couldn't find any Summer Crash Course students for that phone number.",
    );
  }

  return {
    title: normalizeSummerCrashText(campaign.title) || SUMMER_CRASH_DISPLAY_NAME,
    supportContact:
      normalizeSummerCrashText(campaign.supportContact) ||
      SUMMER_CRASH_SUPPORT_CONTACT,
    matches: (Array.isArray(matches) ? matches : []).map((match) => ({
      studentName: normalizeSummerCrashText(match?.studentName),
      guardianName: normalizeSummerCrashText(match?.guardianName),
      classBand: normalizeSummerCrashText(match?.classBand),
      summerId: String(match?.summerId || "").trim().toUpperCase(),
      maskedSummerId: maskSummerCrashId(match?.summerId),
    })) satisfies SummerCrashLookupMatch[],
  };
}

export async function getSummerCrashStudentState(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
}) {
  if (!isSummerCrashSchoolKey(params.schoolKey)) {
    throw new Error("Summer Crash Course access is only available for summer accounts.");
  }

  const campaign = await getOrCreateSummerCrashCampaign();
  const { User: UserModel } = await getTenantModels(params.schoolKey, ["User"]);
  const studentRecord = await UserModel.findById(params.studentId).select(
    "name fatherName mobileNumber passwordHash rollNumber role",
  );

  if (!studentRecord || String(studentRecord.role || "") !== "student") {
    throw new Error("Summer Crash Course student account not found.");
  }

  const enrollment = await findSummerCrashEnrollmentByStudentId(params.studentId);
  const classBand = normalizeSummerCrashText(enrollment?.classBand);
  const requiresPasswordSetup = await isUsingDefaultStudentPassword({
    mobileNumber: studentRecord.mobileNumber,
    passwordHash: studentRecord.passwordHash,
  });
  const courseList = await listStudentCoursesPage({
    schoolKey: params.schoolKey,
    studentId: params.studentId,
    studentPlacement: params.studentPlacement,
    page: 1,
    limit: 60,
    includeOptions: false,
  });
  const courses = classBand
    ? filterCoursesBySummerCrashMapping({
        campaign,
        classBand,
        courses: courseList.items,
      })
    : courseList.items;

  if (enrollment?._id && !enrollment.firstAccessAt) {
    await SummerCrashEnrollment.updateOne(
      {
        _id: enrollment._id,
        firstAccessAt: null,
      },
      {
        $set: {
          firstAccessAt: new Date(),
          status: requiresPasswordSetup ? "setup_pending" : "active",
        },
      },
    ).catch(() => undefined);
  }

  return {
    title: normalizeSummerCrashText(campaign.title) || SUMMER_CRASH_DISPLAY_NAME,
    supportContact:
      normalizeSummerCrashText(campaign.supportContact) ||
      SUMMER_CRASH_SUPPORT_CONTACT,
    studentName: normalizeSummerCrashText(studentRecord.name),
    guardianName:
      normalizeSummerCrashText(enrollment?.guardianName) ||
      normalizeSummerCrashText(studentRecord.fatherName),
    classBand:
      classBand ||
      normalizeSummerCrashText(enrollment?.classBand),
    summerId:
      String(enrollment?.summerId || studentRecord.rollNumber || "")
        .trim()
        .toUpperCase(),
    requiresPasswordSetup,
    courses,
    destinationHref: requiresPasswordSetup
      ? SUMMER_CRASH_WELCOME_PATH
      : resolveSummerCrashDestinationHref(courses.map((course) => course._id)),
  } satisfies SummerCrashStudentState;
}

export async function completeSummerCrashSetup(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
  newPassword: string;
}) {
  if (!isSummerCrashSchoolKey(params.schoolKey)) {
    throw new Error("Summer Crash Course setup is only available for summer accounts.");
  }

  const newPassword = String(params.newPassword || "");
  await connectDB();
  const { User: UserModel } = await getTenantModels(params.schoolKey, ["User"]);
  const studentRecord = await UserModel.findById(params.studentId).select(
    "mobileNumber passwordHash role",
  );

  if (!studentRecord || String(studentRecord.role || "") !== "student") {
    throw new Error("Student account not found.");
  }

  const defaultPassword = getDefaultStudentPassword(studentRecord.mobileNumber);
  const usesDefaultPassword = await isUsingDefaultStudentPassword({
    mobileNumber: studentRecord.mobileNumber,
    passwordHash: studentRecord.passwordHash,
  });

  if (!usesDefaultPassword) {
    return getSummerCrashStudentState(params);
  }

  if (defaultPassword && newPassword === defaultPassword) {
    throw new Error("Choose a new password that is different from the phone digits.");
  }

  const passwordValidation = validatePasswordInput({
    role: "student",
    mobileNumber: studentRecord.mobileNumber,
    password: newPassword,
  });
  if (!passwordValidation.ok) {
    throw new Error(passwordValidation.message);
  }

  studentRecord.passwordHash = await bcrypt.hash(newPassword, 10);
  await studentRecord.save();

  await SummerCrashEnrollment.updateMany(
    {
      summerSchoolKey: params.schoolKey,
      summerStudentId: params.studentId,
      status: { $in: ["registered", "setup_pending"] },
    },
    {
      $set: {
        status: "active",
        firstAccessAt: new Date(),
      },
    },
  ).catch(() => undefined);

  return getSummerCrashStudentState(params);
}
