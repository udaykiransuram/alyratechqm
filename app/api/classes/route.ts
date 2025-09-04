import { NextResponse } from 'next/server';
import {connectDB} from '@/lib/db';
import Class from '@/models/Class';

export async function GET() {
  await connectDB();
  try {
    const classes = await Class.find({}).sort({ name: 1 });
    return NextResponse.json({ success: true, classes });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  await connectDB();
  try {
    const { name, description } = await request.json();
    if (!name) {
      return NextResponse.json({ success: false, message: 'Class name is required.' }, { status: 400 });
    }
    // Check if class already exists
    let existing = await Class.findOne({ name });
    if (existing) {
      return NextResponse.json({ success: true, class: existing, classId: existing._id }, { status: 200 });
    }
    // Create new class
    const newClass = new Class({ name, description });
    await newClass.save();
    return NextResponse.json({ success: true, class: newClass, classId: newClass._id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}