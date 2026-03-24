/// <reference types="@playwright/test" />
import { expect, request, test, type APIRequestContext } from "@playwright/test";
import bcrypt from "bcryptjs";

import { connectDB } from "../../lib/db";
import { getTenantDb, getTenantModels } from "../../lib/db-tenant";
import School from "../../models/School";

const testBaseURL = process.env.BASE_URL || "http://127.0.0.1:3000";

type SeededStudent = {
  id: string;
  rollNumber: string;
  password: string;
  sectionId: string;
};

type SeedState = {
  schoolKey: string;
  otherSchoolKey: string;
  paperOpenId: string;
  paperFutureId: string;
  paperClosedId: string;
  students: {
    flow: SeededStudent;
    resume: SeededStudent;
    conflict: SeededStudent;
    future: SeededStudent;
    closed: SeededStudent;
    unassigned: SeededStudent;
  };
};

test.describe.configure({ mode: "serial" });

function toObjectIdString(value: unknown) {
  return String(value || "").trim();
}

async function parseJson(response: Awaited<ReturnType<APIRequestContext["fetch"]>>) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchCsrfToken(context: APIRequestContext) {
  const response = await context.fetch("/api/auth/csrf", {
    method: "GET",
    failOnStatusCode: false,
  });
  expect(response.ok()).toBeTruthy();
  const payload = await parseJson(response);
  expect(payload?.csrfToken).toBeTruthy();
  return String(payload.csrfToken);
}

async function signInStudent(context: APIRequestContext, schoolKey: string, identifier: string, password: string) {
  const csrfToken = await fetchCsrfToken(context);
  const response = await context.fetch("/api/auth/callback/school-user?json=true", {
    method: "POST",
    form: {
      csrfToken,
      identifier,
      password,
      schoolKey,
      callbackUrl: `${testBaseURL}/student/tests`,
      json: "true",
    },
    failOnStatusCode: false,
  });
  expect(response.ok()).toBeTruthy();

  const sessionResponse = await context.fetch("/api/auth/session", {
    method: "GET",
    failOnStatusCode: false,
  });
  expect(sessionResponse.ok()).toBeTruthy();
  const sessionPayload = await parseJson(sessionResponse);
  expect(sessionPayload?.user?.id).toBeTruthy();
  expect(sessionPayload?.user?.schoolKey).toBe(schoolKey);
}

async function signOutStudent(context: APIRequestContext) {
  const csrfToken = await fetchCsrfToken(context);
  const response = await context.fetch("/api/auth/signout?json=true", {
    method: "POST",
    form: {
      csrfToken,
      callbackUrl: `${testBaseURL}/auth/signin`,
      json: "true",
    },
    failOnStatusCode: false,
  });
  expect(response.ok()).toBeTruthy();
}

async function createStudentContext(schoolKey: string, identifier: string, password: string) {
  const context = await request.newContext({
    baseURL: testBaseURL,
    extraHTTPHeaders: {
      Accept: "application/json",
      "x-school-key": schoolKey,
    },
    ignoreHTTPSErrors: true,
  });
  await signInStudent(context, schoolKey, identifier, password);
  return context;
}

function buildSingleQuestionPayload(paper: any, selectedOptionIndex: number) {
  const section = Array.isArray(paper?.sections) ? paper.sections[0] : null;
  const sectionName = String(section?.name || "").trim();
  const firstEntry = Array.isArray(section?.questions) ? section.questions[0] : null;
  const questionId = toObjectIdString(firstEntry?.question?._id);
  if (!sectionName || !questionId) {
    throw new Error("Paper payload did not include a usable first question.");
  }

  return [
    {
      sectionName,
      answers: [
        {
          question: questionId,
          selectedOptions: [selectedOptionIndex],
        },
      ],
    },
  ];
}

async function seedTenantForIntegration() {
  await connectDB();

  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const schoolKey = `online_test_it_${uniqueSuffix}`.toLowerCase();
  const otherSchoolKey = `online_test_it_other_${uniqueSuffix}`.toLowerCase();

  await School.findOneAndUpdate(
    { key: schoolKey },
    { $setOnInsert: { key: schoolKey, displayName: `Online Test IT ${uniqueSuffix}` } },
    { upsert: true, new: true },
  );
  await School.findOneAndUpdate(
    { key: otherSchoolKey },
    { $setOnInsert: { key: otherSchoolKey, displayName: `Other School IT ${uniqueSuffix}` } },
    { upsert: true, new: true },
  );

  const {
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
    Subject: SubjectModel,
    Question: QuestionModel,
    QuestionPaper: QuestionPaperModel,
    User: UserModel,
  } = await getTenantModels(schoolKey, [
    "Class",
    "AcademicSection",
    "Subject",
    "Question",
    "QuestionPaper",
    "User",
    "QuestionPaperResponse",
  ]);

  const password = "Stress123!";
  const passwordHash = await bcrypt.hash(password, 10);

  const classDoc = await ClassModel.create({
    name: `IT Class ${uniqueSuffix}`,
    description: "Online test integration class",
  });
  const sectionA = await AcademicSectionModel.create({
    name: "Section A",
    class: classDoc._id,
    isActive: true,
  });
  const sectionB = await AcademicSectionModel.create({
    name: "Section B",
    class: classDoc._id,
    isActive: true,
  });
  const subjectDoc = await SubjectModel.create({
    name: `IT Subject ${uniqueSuffix}`,
    code: `ITS-${uniqueSuffix.slice(-4)}`,
  });
  const admin = await UserModel.create({
    name: "Integration Admin",
    email: `integration-admin-${uniqueSuffix}@example.com`,
    passwordHash,
    mobileNumber: `91990${uniqueSuffix.slice(-5)}`,
    role: "admin",
    hasAllClasses: true,
    hasAllSections: true,
    hasAllSubjects: true,
    classIds: [],
    academicSectionIds: [],
    subjectIds: [],
  });

  const questionOne = await QuestionModel.create({
    subject: subjectDoc._id,
    class: classDoc._id,
    tags: [],
    content: "<p>2 + 2 = ?</p>",
    type: "single",
    options: [{ content: "<p>4</p>" }, { content: "<p>5</p>" }],
    answerIndexes: [0],
    marks: 2,
    explanation: "Basic arithmetic.",
    createdBy: admin._id,
  });
  const questionTwo = await QuestionModel.create({
    subject: subjectDoc._id,
    class: classDoc._id,
    tags: [],
    content: "<p>3 + 3 = ?</p>",
    type: "single",
    options: [{ content: "<p>6</p>" }, { content: "<p>7</p>" }],
    answerIndexes: [0],
    marks: 2,
    explanation: "Basic arithmetic.",
    createdBy: admin._id,
  });

  const now = new Date();
  const paperOpen = await QuestionPaperModel.create({
    title: `Open Paper ${uniqueSuffix}`,
    instructions: "Select the correct options.",
    class: classDoc._id,
    subject: subjectDoc._id,
    duration: 30,
    passingMarks: 1,
    totalMarks: 4,
    examDate: new Date(now.getTime() - 10 * 60 * 1000),
    onlineEnabled: true,
    onlineStartsAt: new Date(now.getTime() - 10 * 60 * 1000),
    onlineEndsAt: new Date(now.getTime() + 120 * 60 * 1000),
    assignedAcademicSections: [sectionA._id],
    sections: [
      {
        name: "Section 1",
        description: "",
        marks: 4,
        questions: [
          { question: questionOne._id, marks: 2, negativeMarks: 0 },
          { question: questionTwo._id, marks: 2, negativeMarks: 0 },
        ],
      },
    ],
    createdBy: admin._id,
  });
  const paperFuture = await QuestionPaperModel.create({
    title: `Future Paper ${uniqueSuffix}`,
    instructions: "Future schedule test.",
    class: classDoc._id,
    subject: subjectDoc._id,
    duration: 30,
    passingMarks: 1,
    totalMarks: 2,
    examDate: new Date(now.getTime() + 60 * 60 * 1000),
    onlineEnabled: true,
    onlineStartsAt: new Date(now.getTime() + 60 * 60 * 1000),
    onlineEndsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
    assignedAcademicSections: [sectionA._id],
    sections: [
      {
        name: "Section 1",
        description: "",
        marks: 2,
        questions: [{ question: questionOne._id, marks: 2, negativeMarks: 0 }],
      },
    ],
    createdBy: admin._id,
  });
  const paperClosed = await QuestionPaperModel.create({
    title: `Closed Paper ${uniqueSuffix}`,
    instructions: "Closed schedule test.",
    class: classDoc._id,
    subject: subjectDoc._id,
    duration: 30,
    passingMarks: 1,
    totalMarks: 2,
    examDate: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    onlineEnabled: true,
    onlineStartsAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    onlineEndsAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    assignedAcademicSections: [sectionA._id],
    sections: [
      {
        name: "Section 1",
        description: "",
        marks: 2,
        questions: [{ question: questionOne._id, marks: 2, negativeMarks: 0 }],
      },
    ],
    createdBy: admin._id,
  });

  const createStudent = async (key: string, sectionId: string) => {
    const rollNumber = `IT${uniqueSuffix.slice(-4)}${key.slice(0, 2).toUpperCase()}`;
    const student = await UserModel.create({
      name: `Student ${key}`,
      passwordHash,
      mobileNumber: `91991${Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, "0")}`,
      role: "student",
      class: classDoc._id,
      academicSection: sectionId,
      rollNumber,
    });
    return {
      id: toObjectIdString(student._id),
      rollNumber,
      password,
      sectionId,
    };
  };

  const students = {
    flow: await createStudent("flow", toObjectIdString(sectionA._id)),
    resume: await createStudent("resume", toObjectIdString(sectionA._id)),
    conflict: await createStudent("conflict", toObjectIdString(sectionA._id)),
    future: await createStudent("future", toObjectIdString(sectionA._id)),
    closed: await createStudent("closed", toObjectIdString(sectionA._id)),
    unassigned: await createStudent("unassigned", toObjectIdString(sectionB._id)),
  };

  return {
    schoolKey,
    otherSchoolKey,
    paperOpenId: toObjectIdString(paperOpen._id),
    paperFutureId: toObjectIdString(paperFuture._id),
    paperClosedId: toObjectIdString(paperClosed._id),
    students,
  } satisfies SeedState;
}

async function cleanupSeededTenant(seed: SeedState | null) {
  if (!seed) return;
  await connectDB();
  const tenantDb = await getTenantDb(seed.schoolKey);
  await tenantDb.dropDatabase().catch(() => undefined);
  const otherTenantDb = await getTenantDb(seed.otherSchoolKey);
  await otherTenantDb.dropDatabase().catch(() => undefined);
  await School.deleteMany({ key: { $in: [seed.schoolKey, seed.otherSchoolKey] } });
}

test.describe("Student tests API integration (real backend)", () => {
  let seed: SeedState | null = null;

  test.beforeAll(async () => {
    seed = await seedTenantForIntegration();
  });

  test.afterAll(async () => {
    await cleanupSeededTenant(seed);
  });

  test("runs start/save/submit flow, keeps one active attempt, and persists answers", async () => {
    if (!seed) throw new Error("Missing seeded test data.");

    const context = await createStudentContext(
      seed.schoolKey,
      seed.students.flow.rollNumber,
      seed.students.flow.password,
    );

    try {
      const listRes = await context.fetch("/api/student/tests", {
        method: "GET",
        failOnStatusCode: false,
      });
      expect(listRes.ok()).toBeTruthy();
      const listPayload = await parseJson(listRes);
      expect(listPayload?.success).toBe(true);
      const paperListEntry = Array.isArray(listPayload?.tests)
        ? listPayload.tests.find((entry: any) => entry?._id === seed?.paperOpenId)
        : null;
      expect(paperListEntry).toBeTruthy();
      expect(paperListEntry?.status).toBe("available");

      const detailBeforeStartRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}`,
        { method: "GET", failOnStatusCode: false },
      );
      expect(detailBeforeStartRes.ok()).toBeTruthy();
      const detailBeforeStartPayload = await parseJson(detailBeforeStartRes);
      expect(detailBeforeStartPayload?.attempt).toBeNull();
      expect(detailBeforeStartPayload?.status).toBe("available");

      const startResOne = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}/attempt`,
        { method: "POST", failOnStatusCode: false },
      );
      expect(startResOne.ok()).toBeTruthy();
      const startPayloadOne = await parseJson(startResOne);
      expect(startPayloadOne?.success).toBe(true);
      expect(startPayloadOne?.attempt?._id).toBeTruthy();

      const startResTwo = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}/attempt`,
        { method: "POST", failOnStatusCode: false },
      );
      expect(startResTwo.ok()).toBeTruthy();
      const startPayloadTwo = await parseJson(startResTwo);
      expect(startPayloadTwo?.attempt?._id).toBe(startPayloadOne?.attempt?._id);

      const sectionAnswers = buildSingleQuestionPayload(
        detailBeforeStartPayload?.paper,
        0,
      );

      const saveRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}/attempt`,
        {
          method: "PATCH",
          data: {
            sectionAnswers,
            baseLastSavedAt: startPayloadTwo?.attempt?.lastSavedAt || null,
          },
          failOnStatusCode: false,
        },
      );
      expect(saveRes.ok()).toBeTruthy();
      const savePayload = await parseJson(saveRes);
      expect(savePayload?.success).toBe(true);
      expect(savePayload?.attempt?.sectionAnswers?.length).toBeGreaterThan(0);

      const submitRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}/submit`,
        {
          method: "POST",
          data: {
            sectionAnswers,
            baseLastSavedAt: savePayload?.attempt?.lastSavedAt || null,
          },
          failOnStatusCode: false,
        },
      );
      expect(submitRes.ok()).toBeTruthy();
      const submitPayload = await parseJson(submitRes);
      expect(submitPayload?.success).toBe(true);
      expect(["submitted", "auto_submitted"]).toContain(submitPayload?.status);

      const detailAfterSubmitRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}`,
        { method: "GET", failOnStatusCode: false },
      );
      expect(detailAfterSubmitRes.ok()).toBeTruthy();
      const detailAfterSubmitPayload = await parseJson(detailAfterSubmitRes);
      expect(["submitted", "auto_submitted"]).toContain(
        detailAfterSubmitPayload?.status,
      );

      const { QuestionPaperResponse: ResponseModel } = await getTenantModels(
        seed.schoolKey,
        ["QuestionPaperResponse"],
      );
      const count = await ResponseModel.countDocuments({
        paper: seed.paperOpenId,
        student: seed.students.flow.id,
      });
      expect(count).toBe(1);

      const persisted = await ResponseModel.findOne({
        paper: seed.paperOpenId,
        student: seed.students.flow.id,
      })
        .select("status sectionAnswers")
        .lean();
      expect(["submitted", "auto_submitted"]).toContain(String(persisted?.status));
      const persistedAnswerCount = Array.isArray(persisted?.sectionAnswers)
        ? persisted.sectionAnswers.reduce((acc: number, section: any) => {
            const answerCount = Array.isArray(section?.answers)
              ? section.answers.length
              : 0;
            return acc + answerCount;
          }, 0)
        : 0;
      expect(persistedAnswerCount).toBeGreaterThan(0);
    } finally {
      await signOutStudent(context).catch(() => undefined);
      await context.dispose();
    }
  });

  test("resumes an in-progress attempt after sign-out and sign-in", async () => {
    if (!seed) throw new Error("Missing seeded test data.");

    const context = await createStudentContext(
      seed.schoolKey,
      seed.students.resume.rollNumber,
      seed.students.resume.password,
    );

    let attemptId = "";

    try {
      const detailRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}`,
        { method: "GET", failOnStatusCode: false },
      );
      const detailPayload = await parseJson(detailRes);
      const sectionAnswers = buildSingleQuestionPayload(detailPayload?.paper, 0);

      const startRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}/attempt`,
        { method: "POST", failOnStatusCode: false },
      );
      const startPayload = await parseJson(startRes);
      attemptId = String(startPayload?.attempt?._id || "");
      expect(attemptId).toBeTruthy();

      const saveRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}/attempt`,
        {
          method: "PATCH",
          data: {
            sectionAnswers,
            baseLastSavedAt: startPayload?.attempt?.lastSavedAt || null,
          },
          failOnStatusCode: false,
        },
      );
      const savePayload = await parseJson(saveRes);
      expect(savePayload?.success).toBe(true);
      expect(savePayload?.status).toBe("in_progress");
    } finally {
      await signOutStudent(context).catch(() => undefined);
      await context.dispose();
    }

    const resumedContext = await createStudentContext(
      seed.schoolKey,
      seed.students.resume.rollNumber,
      seed.students.resume.password,
    );

    try {
      const resumedDetailRes = await resumedContext.fetch(
        `/api/student/tests/${seed.paperOpenId}`,
        { method: "GET", failOnStatusCode: false },
      );
      expect(resumedDetailRes.ok()).toBeTruthy();
      const resumedDetailPayload = await parseJson(resumedDetailRes);
      expect(resumedDetailPayload?.attempt?._id).toBe(attemptId);
      expect(resumedDetailPayload?.status).toBe("in_progress");
      const resumedAnswers = Array.isArray(
        resumedDetailPayload?.attempt?.sectionAnswers,
      )
        ? resumedDetailPayload.attempt.sectionAnswers
        : [];
      expect(resumedAnswers.length).toBeGreaterThan(0);
    } finally {
      await signOutStudent(resumedContext).catch(() => undefined);
      await resumedContext.dispose();
    }
  });

  test("returns ATTEMPT_STATE_CONFLICT for stale save payloads", async () => {
    if (!seed) throw new Error("Missing seeded test data.");

    const context = await createStudentContext(
      seed.schoolKey,
      seed.students.conflict.rollNumber,
      seed.students.conflict.password,
    );

    try {
      const detailRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}`,
        { method: "GET", failOnStatusCode: false },
      );
      const detailPayload = await parseJson(detailRes);
      const sectionAnswersA = buildSingleQuestionPayload(detailPayload?.paper, 0);
      const sectionAnswersB = buildSingleQuestionPayload(detailPayload?.paper, 1);

      const startRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}/attempt`,
        { method: "POST", failOnStatusCode: false },
      );
      const startPayload = await parseJson(startRes);
      expect(startPayload?.attempt?._id).toBeTruthy();

      const saveOneRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}/attempt`,
        {
          method: "PATCH",
          data: {
            sectionAnswers: sectionAnswersA,
            baseLastSavedAt: startPayload?.attempt?.lastSavedAt || null,
          },
          failOnStatusCode: false,
        },
      );
      const saveOnePayload = await parseJson(saveOneRes);
      expect(saveOnePayload?.success).toBe(true);
      const staleLastSavedAt = saveOnePayload?.attempt?.lastSavedAt;
      expect(staleLastSavedAt).toBeTruthy();

      await new Promise((resolve) => setTimeout(resolve, 1200));

      const saveTwoRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}/attempt`,
        {
          method: "PATCH",
          data: {
            sectionAnswers: sectionAnswersA,
            baseLastSavedAt: staleLastSavedAt,
          },
          failOnStatusCode: false,
        },
      );
      const saveTwoPayload = await parseJson(saveTwoRes);
      expect(saveTwoPayload?.success).toBe(true);

      const staleConflictRes = await context.fetch(
        `/api/student/tests/${seed.paperOpenId}/attempt`,
        {
          method: "PATCH",
          data: {
            sectionAnswers: sectionAnswersB,
            baseLastSavedAt: staleLastSavedAt,
          },
          failOnStatusCode: false,
        },
      );
      expect(staleConflictRes.status()).toBe(409);
      const staleConflictPayload = await parseJson(staleConflictRes);
      expect(staleConflictPayload?.success).toBe(false);
      expect(staleConflictPayload?.code).toBe("ATTEMPT_STATE_CONFLICT");
    } finally {
      await signOutStudent(context).catch(() => undefined);
      await context.dispose();
    }
  });

  test("enforces not-open-yet, closed, and not-assigned paths", async () => {
    if (!seed) throw new Error("Missing seeded test data.");

    const futureContext = await createStudentContext(
      seed.schoolKey,
      seed.students.future.rollNumber,
      seed.students.future.password,
    );
    try {
      const futureStartRes = await futureContext.fetch(
        `/api/student/tests/${seed.paperFutureId}/attempt`,
        { method: "POST", failOnStatusCode: false },
      );
      expect(futureStartRes.status()).toBe(403);
      const futurePayload = await parseJson(futureStartRes);
      expect(futurePayload?.code).toBe("ONLINE_TEST_NOT_OPEN_YET");
    } finally {
      await signOutStudent(futureContext).catch(() => undefined);
      await futureContext.dispose();
    }

    const closedContext = await createStudentContext(
      seed.schoolKey,
      seed.students.closed.rollNumber,
      seed.students.closed.password,
    );
    try {
      const closedStartRes = await closedContext.fetch(
        `/api/student/tests/${seed.paperClosedId}/attempt`,
        { method: "POST", failOnStatusCode: false },
      );
      expect(closedStartRes.status()).toBe(403);
      const closedPayload = await parseJson(closedStartRes);
      expect(closedPayload?.code).toBe("ONLINE_TEST_CLOSED");
    } finally {
      await signOutStudent(closedContext).catch(() => undefined);
      await closedContext.dispose();
    }

    const unassignedContext = await createStudentContext(
      seed.schoolKey,
      seed.students.unassigned.rollNumber,
      seed.students.unassigned.password,
    );
    try {
      const unassignedDetailRes = await unassignedContext.fetch(
        `/api/student/tests/${seed.paperOpenId}`,
        { method: "GET", failOnStatusCode: false },
      );
      expect(unassignedDetailRes.status()).toBe(403);
      const unassignedPayload = await parseJson(unassignedDetailRes);
      expect(unassignedPayload?.code).toBe("ONLINE_TEST_NOT_ASSIGNED");
    } finally {
      await signOutStudent(unassignedContext).catch(() => undefined);
      await unassignedContext.dispose();
    }
  });

  test("blocks cross-school tampering and returns auth failure for invalid session", async () => {
    if (!seed) throw new Error("Missing seeded test data.");

    const signedInContext = await createStudentContext(
      seed.schoolKey,
      seed.students.flow.rollNumber,
      seed.students.flow.password,
    );
    try {
      const tamperedRes = await signedInContext.fetch("/api/student/tests", {
        method: "GET",
        headers: {
          "x-school-key": seed.otherSchoolKey,
        },
        failOnStatusCode: false,
      });
      expect(tamperedRes.status()).toBe(403);
      const tamperedPayload = await parseJson(tamperedRes);
      expect(tamperedPayload?.success).toBe(false);
      expect(String(tamperedPayload?.message || "")).toContain(
        "different school",
      );
    } finally {
      await signOutStudent(signedInContext).catch(() => undefined);
      await signedInContext.dispose();
    }

    const invalidSessionContext = await request.newContext({
      baseURL: testBaseURL,
      extraHTTPHeaders: {
        Accept: "application/json",
        "x-school-key": seed.schoolKey,
        Cookie: `next-auth.session-token=not-a-valid-session-token; schoolKey=${seed.schoolKey}`,
      },
    });

    try {
      const invalidSessionRes = await invalidSessionContext.fetch(
        "/api/student/tests",
        { method: "GET", failOnStatusCode: false },
      );
      expect(invalidSessionRes.status()).toBe(401);
      const invalidPayload = await parseJson(invalidSessionRes);
      expect(invalidPayload?.success).toBe(false);
      expect(String(invalidPayload?.message || "")).toContain(
        "Authentication required",
      );
    } finally {
      await invalidSessionContext.dispose();
    }
  });
});
