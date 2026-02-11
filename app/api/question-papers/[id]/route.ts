
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  try {
    const { QuestionPaper: QPModel, Question: QuestionModel, Tag, TagType } = await getTenantModels(schoolKey, ['QuestionPaper','Question','Tag','TagType']);
    let paper = await QPModel.findById(params.id).populate('class').populate('subject');
    if (!paper) return NextResponse.json({ success: false, message: 'Paper not found.' }, { status: 404 });
    await paper.populate({ path: 'sections.questions.question', model: QuestionModel, populate: { path: 'tags', model: Tag, populate: { path: 'type', model: TagType, select: 'name' } } });
    return NextResponse.json({ success: true, paper }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  const { QuestionPaper: QPModel } = await getTenantModels(schoolKey, ['QuestionPaper']);

  try {
    const data = await req.json();
    const updated = await QPModel.findByIdAndUpdate(params.id, data, { new: true });
    if (!updated) return NextResponse.json({ success: false, message: 'Question paper not found.' }, { status: 404 });
    return NextResponse.json({ success: true, paper: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  const { QuestionPaper: QPModel, QuestionPaperResponse: QPRModel } = await getTenantModels(schoolKey, ['QuestionPaper','QuestionPaperResponse']);

  try {
    const deleted = await QPModel.findByIdAndDelete(params.id);
    if (!deleted) return NextResponse.json({ success: false, message: 'Question paper not found.' }, { status: 404 });
    await QPRModel.deleteMany({ paper: params.id });
    return NextResponse.json({ success: true, message: 'Question paper and its responses deleted.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
