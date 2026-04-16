export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { storePublicFile } from "@/lib/server/public-file-storage";

const MAX_FILE_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_FILE_UPLOAD_SIZE_LABEL = "20 MB";
const SUPPORTED_FILE_FORMATS_LABEL =
  "PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP, MP4, WEBM, MOV, and M4V";
const LARGE_VIDEO_GUIDANCE =
  "For larger videos, use a YouTube lesson item or paste a hosted video file URL into the resource link field.";

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, message: "File is required." },
      { status: 400 },
    );
  }

  const mimeType = String(file.type || "").toLowerCase();

  if (file.size <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: `Uploaded file is empty. Upload a ${SUPPORTED_FILE_FORMATS_LABEL} file up to ${MAX_FILE_UPLOAD_SIZE_LABEL}. ${LARGE_VIDEO_GUIDANCE}`,
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      {
        success: false,
        message: `File too large. Upload ${SUPPORTED_FILE_FORMATS_LABEL} files up to ${MAX_FILE_UPLOAD_SIZE_LABEL}. ${LARGE_VIDEO_GUIDANCE}`,
      },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const storedFile = await storePublicFile({
      buffer,
      schoolKey: auth.schoolKey,
      fileName: file.name,
      mimeType: mimeType || null,
      relativeFolder: "course-files",
    });

    return NextResponse.json({
      success: true,
      url: storedFile.url,
      fileName: storedFile.fileName,
      mimeType: storedFile.mimeType,
      size: storedFile.size,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : `Unsupported file format. Upload ${SUPPORTED_FILE_FORMATS_LABEL} only.`;
    const isValidationError = message.toLowerCase().includes("unsupported");

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: isValidationError ? 400 : 500 },
    );
  }
}
