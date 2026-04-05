export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { storePublicImage } from "@/lib/server/public-image-storage";
import { validatePublicImageFile } from "@/lib/uploads/public-image";

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
      { success: false, message: "Image file is required." },
      { status: 400 },
    );
  }

  const validation = validatePublicImageFile(
    {
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    },
    { emptySource: "uploaded" },
  );

  if (!validation.ok) {
    return NextResponse.json(
      {
        success: false,
        message: validation.message,
      },
      { status: validation.status },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const storedImage = await storePublicImage({
      buffer,
      schoolKey: auth.schoolKey,
      fileName: file.name,
      mimeType: validation.mimeType,
      relativeFolder: "course-images",
    });

    return NextResponse.json({
      success: true,
      url: storedImage.url,
      fileName: storedImage.fileName,
      mimeType: storedImage.mimeType,
      size: storedImage.size,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Failed to upload the image.";
    const isValidationError = message.toLowerCase().includes(
      "unsupported image format",
    );

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: isValidationError ? 400 : 500 },
    );
  }
}
