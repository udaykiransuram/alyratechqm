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
    const newClass = new Class({ name, description });
    await newClass.save();
    return NextResponse.json({ success: true, class: newClass }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) { // Handle duplicate name error
      return NextResponse.json({ success: false, message: 'A class with this name already exists.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}