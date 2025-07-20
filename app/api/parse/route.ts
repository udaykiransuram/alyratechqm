export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file uploaded or file is not a Blob' }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  console.log('Buffer length:', buffer.length);

  // Forward the buffer to your Node.js extraction service
  const res = await fetch('http://localhost:5000/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: buffer,
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Extraction service failed' }, { status: 500 });
  }

  const result = await res.json();
  return NextResponse.json(result, { status: 200 });
}