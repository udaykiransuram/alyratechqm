export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { requireTenantSession } from '@/lib/api-auth';
import { storePublicImage } from '@/lib/server/public-image-storage';

const MAX_IMAGE_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_SIZE_LABEL = '5 MB';
const SUPPORTED_IMAGE_FORMATS_LABEL = 'PNG, JPG/JPEG, WEBP, GIF, AVIF, and SVG';
export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin', 'teacher'],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, message: 'Image file is required.' },
      { status: 400 },
    );
  }

  const mimeType = String(file.type || '').toLowerCase();
  if (!mimeType) {
    return NextResponse.json(
      {
        success: false,
        message: `Unsupported image format. Upload ${SUPPORTED_IMAGE_FORMATS_LABEL} files only.`,
      },
      { status: 400 },
    );
  }

  if (file.size <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: `Uploaded image is empty. Upload a ${SUPPORTED_IMAGE_FORMATS_LABEL} file up to ${MAX_IMAGE_UPLOAD_SIZE_LABEL}.`,
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      {
        success: false,
        message: `Image too large. Upload ${SUPPORTED_IMAGE_FORMATS_LABEL} files up to ${MAX_IMAGE_UPLOAD_SIZE_LABEL}.`,
      },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let storedImage;
  try {
    storedImage = await storePublicImage({
      buffer,
      schoolKey: auth.schoolKey,
      fileName: file.name,
      mimeType,
      relativeFolder: 'question-images',
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: `Unsupported image format. Upload ${SUPPORTED_IMAGE_FORMATS_LABEL} files only.`,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    url: storedImage.url,
    fileName: storedImage.fileName,
    mimeType: storedImage.mimeType,
    size: storedImage.size,
  });
}
