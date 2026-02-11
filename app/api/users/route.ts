
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import bcrypt from 'bcryptjs';

// GET users with optional filters
export async function GET(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  try {
    const { searchParams } = url;
    const limitParam = Number(searchParams.get('limit') || '100');
    const pageParam = Number(searchParams.get('page') || '');
    const limit = Math.min(Math.max(isNaN(limitParam) ? 100 : limitParam, 1), 500);
    const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
    const skip = (page - 1) * limit;
    const role = searchParams.get('role');
    const rollNumber = searchParams.get('rollNumber');
    const classId = searchParams.get('classId');

    const query: any = {};
    if (role) query.role = role;
    if (rollNumber) query.rollNumber = rollNumber;
    if (classId) query.class = classId;

    const { User: UserModel } = await getTenantModels(schoolKey, ['User']);
    const total = await UserModel.countDocuments(query);
    const users = await UserModel.find(query).select('-passwordHash').sort({ name: 1 }).skip(skip).limit(limit).lean();
    const pages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({ success: true, users, total, page, pages, limit });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

// POST a new user or return existing student if present
export async function POST(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key');
  const schoolFromQuery = url.searchParams.get('school');
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value;
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });
  try {
    const { User: UserModel } = await getTenantModels(schoolKey, ['User']);
    const { name, email, password, role, class: classId, rollNumber, enrolledAt } = await req.json();

    if (!name || !role) {
      return NextResponse.json({ success: false, message: 'Name and role are required.' }, { status: 400 });
    }
    if (role === 'student' && !rollNumber) {
      return NextResponse.json({ success: false, message: 'rollNumber is required for students.' }, { status: 400 });
    }

    if (role === 'student' && rollNumber && classId) {
      const existingStudent = await UserModel.findOne({ role: 'student', rollNumber, class: classId });
      if (existingStudent) {
        const { passwordHash: _, ...userResponse } = existingStudent.toObject();
        return NextResponse.json({ success: true, user: userResponse, existed: true }, { status: 200 });
      }
    }

    if (email) {
      const existingUser = await UserModel.findOne({ email });
      if (existingUser) {
        return NextResponse.json({ success: false, message: 'A user with this email already exists.' }, { status: 409 });
      }
    }

    let passwordHash = undefined as string | undefined;
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ success: false, message: 'Password must be at least 6 characters long.' }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    const newUserDoc = new UserModel({
      name,
      email,
      passwordHash,
      role,
      class: role === 'student' ? classId : undefined,
      rollNumber: role === 'student' ? rollNumber : undefined,
      enrolledAt: role === 'student' ? (enrolledAt || Date.now()) : undefined,
    });
    await newUserDoc.save();

    const { passwordHash: _, ...userResponse } = newUserDoc.toObject();
    return NextResponse.json({ success: true, user: userResponse }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
