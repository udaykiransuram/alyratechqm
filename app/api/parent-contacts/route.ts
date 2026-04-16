export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { getTenantModels } from "@/lib/db-tenant";
import { connectDB } from "@/lib/db";

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const studentId = normalizeId(req.nextUrl.searchParams.get("studentId"));
  const classId = normalizeId(req.nextUrl.searchParams.get("classId"));
  const sectionId = normalizeId(req.nextUrl.searchParams.get("sectionId"));

  await connectDB();
  const { ParentContact: ParentContactModel, User: UserModel } = await getTenantModels(
    auth.schoolKey,
    ["ParentContact", "User"],
  );

  const query: Record<string, unknown> = {};
  if (studentId) {
    query.student = studentId;
  }

  const contacts = await ParentContactModel.find(query)
    .populate({
      path: "student",
      model: UserModel,
      select: "name class academicSection rollNumber mobileNumber",
    })
    .lean();

  const filtered = contacts.filter((contact: any) => {
    const student = contact?.student;
    if (!student) return false;
    const matchesClass = classId
      ? normalizeId(student?.class) === classId ||
        normalizeId(student?.class?._id) === classId
      : true;
    const matchesSection = sectionId
      ? normalizeId(student?.academicSection) === sectionId ||
        normalizeId(student?.academicSection?._id) === sectionId
      : true;
    return matchesClass && matchesSection;
  });

  return NextResponse.json({
    success: true,
    contacts: filtered.map((contact: any) => ({
      _id: normalizeId(contact?._id),
      student: contact?.student
        ? {
            _id: normalizeId(contact.student?._id),
            name: String(contact.student?.name || "").trim(),
            rollNumber: String(contact.student?.rollNumber || "").trim() || null,
            mobileNumber: String(contact.student?.mobileNumber || "").trim() || null,
          }
        : null,
      parentName: String(contact?.parentName || "").trim(),
      whatsappOptIn: Boolean(contact?.whatsappOptIn),
      preferredLanguage: String(contact?.preferredLanguage || "").trim(),
      relationship: String(contact?.relationship || "").trim(),
      consentAt: contact?.consentAt || null,
      updatedAt: contact?.updatedAt || null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const studentId = normalizeId(body.studentId);

  if (!studentId) {
    return NextResponse.json(
      { success: false, message: "Student is required." },
      { status: 400 },
    );
  }

  await connectDB();
  const { ParentContact: ParentContactModel } = await getTenantModels(
    auth.schoolKey,
    ["ParentContact"],
  );

  const contact = await ParentContactModel.findOneAndUpdate(
    { student: studentId },
    {
      $set: {
        student: studentId,
        parentName: String(body.parentName || "").trim(),
        phoneCountryCode: null,
        phoneNumber: null,
        whatsappOptIn: body.whatsappOptIn !== false,
        consentAt: body.consentAt ? new Date(String(body.consentAt)) : new Date(),
        preferredLanguage: String(body.preferredLanguage || "en").trim(),
        relationship: String(body.relationship || "parent").trim(),
      },
    },
    { upsert: true, new: true },
  );

  return NextResponse.json({
    success: true,
    contact: {
      _id: normalizeId(contact?._id),
      studentId: normalizeId(contact?.student),
      phoneNumber: null,
      whatsappOptIn: Boolean(contact?.whatsappOptIn),
    },
  });
}
