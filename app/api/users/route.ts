import { NextResponse } from 'next/server';
import {connectDB} from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

// GET all users
export async function GET() {
  await connectDB();
  try {
    const users = await User.find({}).select('-passwordHash').sort({ name: 1 });
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

// POST a new user
export async function POST(request: Request) {
  await connectDB();
  try {
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ success: false, message: 'All fields are required.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ success: false, message: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ success: false, message: 'A user with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, passwordHash, role });
    await newUser.save();
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userResponse } = newUser.toObject();

    return NextResponse.json({ success: true, user: userResponse }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}