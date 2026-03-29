export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { requireTenantSession } from '@/lib/api-auth';

const MAX_IMAGE_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSION_BY_MIME_TYPE = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/avif', 'avif'],
]);

function sanitizePathSegment(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '') || 'default';
}

function sanitizeFileBaseName(fileName: string) {
  const normalized = String(fileName || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  return normalized || 'question-image';
}

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
  const extension = IMAGE_EXTENSION_BY_MIME_TYPE.get(mimeType);

  if (!extension) {
    return NextResponse.json(
      {
        success: false,
        message: 'Only PNG, JPEG, WEBP, GIF, and AVIF images are supported.',
      },
      { status: 400 },
    );
  }

  if (file.size <= 0) {
    return NextResponse.json(
      { success: false, message: 'Uploaded image is empty.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, message: 'Images must be 5 MB or smaller.' },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const schoolKeySegment = sanitizePathSegment(auth.schoolKey);
  const createdAt = new Date();
  const year = String(createdAt.getUTCFullYear());
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, '0');
  const baseName = sanitizeFileBaseName(file.name);
  const fileName = `${Date.now()}-${randomUUID()}-${baseName}.${extension}`;
  const relativeDir = path.join(
    'uploads',
    'question-images',
    schoolKeySegment,
    year,
    month,
  );
  const absoluteDir = path.join(process.cwd(), 'public', relativeDir);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, fileName), buffer);

  return NextResponse.json({
    success: true,
    url: `/${relativeDir.replace(/\\/g, '/')}/${fileName}`,
    fileName,
    mimeType,
    size: file.size,
  });
}
