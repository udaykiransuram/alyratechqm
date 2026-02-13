import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  const { schoolKey, email, password, name = 'Admin User' } = await request.json();
  if (!schoolKey || !email || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  await connectDB();
  const { User } = await getTenantModels(schoolKey, ['User']);
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const adminUser = new User({ name, email, passwordHash, role: 'admin' });
  await adminUser.save();
  return NextResponse.json({ message: 'Admin user created successfully' });
}