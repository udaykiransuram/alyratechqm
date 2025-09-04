import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

// GET users with optional filters
export async function GET(request: Request) {
  await connectDB();
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const rollNumber = searchParams.get('rollNumber');
    const classId = searchParams.get('classId');

    const query: any = {};
    if (role) query.role = role;
    if (rollNumber) query.rollNumber = rollNumber;
    if (classId) query.class = classId;

    const users = await User.find(query).select('-passwordHash').sort({ name: 1 });
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

// POST a new user or return existing student if present
export async function POST(request: Request) {
  await connectDB();
  try {
    const { name, email, password, role, class: classId, rollNumber, enrolledAt } = await request.json();

    // Only name and role are always required
    if (!name || !role) {
      return NextResponse.json({ success: false, message: 'Name and role are required.' }, { status: 400 });
    }
    // For students, rollNumber is required
    if (role === 'student' && !rollNumber) {
      return NextResponse.json({ success: false, message: 'rollNumber is required for students.' }, { status: 400 });
    }

    // Check for existing student by rollNumber and class
    if (role === 'student' && rollNumber && classId) {
      const existingStudent = await User.findOne({ role: 'student', rollNumber, class: classId });
      if (existingStudent) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash: _, ...userResponse } = existingStudent.toObject();
        return NextResponse.json({ success: true, user: userResponse, existed: true }, { status: 200 });
      }
    }

    // Email and password are optional, but check for duplicates if email is provided
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return NextResponse.json({ success: false, message: 'A user with this email already exists.' }, { status: 409 });
      }
    }

    let passwordHash = undefined;
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ success: false, message: 'Password must be at least 6 characters long.' }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    const newUser = new User({
      name,
      email,
      passwordHash,
      role,
      class: role === 'student' ? classId : undefined,
      rollNumber: role === 'student' ? rollNumber : undefined,
      enrolledAt: role === 'student' ? (enrolledAt || Date.now()) : undefined,
    });
    await newUser.save();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userResponse } = newUser.toObject();

    return NextResponse.json({ success: true, user: userResponse }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}