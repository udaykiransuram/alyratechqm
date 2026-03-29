export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireTenantSession } from '@/lib/api-auth';

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PDF_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
]);

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ['admin', 'teacher'],
  });
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file uploaded or file is not a Blob' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File exceeds the 10MB upload limit.' },
      { status: 413 },
    );
  }

  if (!ALLOWED_PDF_MIME_TYPES.has(String(file.type || '').toLowerCase())) {
    return NextResponse.json(
      { error: 'Only PDF files are allowed.' },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  console.log('Buffer length:', buffer.length);

  const extractServiceUrl = String(
    process.env.PDF_EXTRACT_SERVICE_URL || 'http://localhost:5000/extract',
  ).trim();

  const res = await fetch(extractServiceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: buffer,
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Extraction service failed' }, { status: 500 });
  }

  const result = await res.json();
  return NextResponse.json(result, { status: 200 });
}
