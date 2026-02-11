
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  await connectDB();
  try {
    const url = new URL(request.url);
    const schoolFromHeader = request.headers.get('x-school-key') || request.headers.get('X-School-Key');
    const schoolFromQuery = url.searchParams.get('school');
    const schoolFromCookie = request.cookies?.get?.('schoolKey')?.value;
    const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim();
    if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 });

    const { User } = await getTenantModels(schoolKey, ['User']);

    const { students } = await request.json();
    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ success: false, message: 'No students provided.' }, { status: 400 });
    }

    const results: any[] = [];
    for (const student of students) {
      const normalizedStudent: any = {};
      Object.keys(student || {}).forEach(key => { normalizedStudent[key.toLowerCase()] = (student as any)[key]; });

      const { name, email, password, role, class: classId, enrolledat, rollnumber, rollnumber: rn1, rollNumber: rn2 } = normalizedStudent;
      const finalRollNumber = rn2 || rn1 || rollnumber;

      if (!name || !role) { results.push({ success: false, message: 'Name and role are required.', student }); continue; }
      if (role === 'student' && !finalRollNumber) { results.push({ success: false, message: 'rollNumber is required for students.', student }); continue; }

      if (role === 'student' && finalRollNumber && classId) {
        const existingStudent = await User.findOne({ role: 'student', rollNumber: finalRollNumber, class: classId });
        if (existingStudent) { results.push({ success: true, user: existingStudent, existed: true }); continue; }
      }

      if (email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) { results.push({ success: false, message: 'A user with this email already exists.', student }); continue; }
      }

      let passwordHash: string | undefined = undefined;
      if (password) {
        if (String(password).length < 6) { results.push({ success: false, message: 'Password must be at least 6 characters long.', student }); continue; }
        passwordHash = await bcrypt.hash(String(password), 10);
      }

      const newUser = new User({
        name,
        email,
        passwordHash,
        role,
        class: role === 'student' ? classId : undefined,
        rollNumber: role === 'student' ? finalRollNumber : undefined,
        enrolledAt: role === 'student' ? (enrolledat || Date.now()) : undefined,
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
