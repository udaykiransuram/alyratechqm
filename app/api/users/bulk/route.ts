import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  await connectDB();
  try {
    const { students } = await request.json();
    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ success: false, message: 'No students provided.' }, { status: 400 });
    }

    const results = [];
    for (const student of students) {
      // Normalize all keys to lowercase for comparison
      const normalizedStudent: any = {};
      Object.keys(student).forEach(key => {
        normalizedStudent[key.toLowerCase()] = student[key];
      });

      const {
        name,
        email,
        password,
        role,
        class: classId,
        enrolledat,
        rollnumber,
        rollNumber,
      } = normalizedStudent;

      // Use rollNumber if present, else fallback to rollnumber
      const finalRollNumber = rollNumber || rollnumber;

      // Only name and role are always required
      if (!name || !role) {
        results.push({ success: false, message: 'Name and role are required.', student });
        continue;
      }
      // For students, rollNumber is required
      if (role === 'student' && !finalRollNumber) {
        results.push({ success: false, message: 'rollNumber is required for students.', student });
        continue;
      }

      // Check for existing student by rollNumber and class
      if (role === 'student' && finalRollNumber && classId) {
        const existingStudent = await User.findOne({
          role: 'student',
          rollNumber: finalRollNumber,
          class: classId,
        });
        if (existingStudent) {
          results.push({ success: true, user: existingStudent, existed: true });
          continue;
        }
      }

      // Email and password are optional, but check for duplicates if email is provided
      if (email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          results.push({ success: false, message: 'A user with this email already exists.', student });
          continue;
        }
      }

      let passwordHash = undefined;
      if (password) {
        if (password.length < 6) {
          results.push({ success: false, message: 'Password must be at least 6 characters long.', student });
          continue;
        }
        passwordHash = await bcrypt.hash(password, 10);
      }

      const newUser = new User({
        name,
        email,
        passwordHash,
        role,
        class: role === 'student' ? classId : undefined,
        rollNumber: role === 'student' ? finalRollNumber : undefined,
        enrolledAt: role === 'student'
          ? (enrolledat || Date.now())
          : undefined,
      });
      await newUser.save();
      results.push({ success: true, user: newUser });
    }

    const successCount = results.filter(r => r.success).length;
    return NextResponse.json({ success: true, count: successCount, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}