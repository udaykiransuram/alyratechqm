import { NextResponse } from 'next/server';
import {connectDB} from '@/lib/db';
import User from '@/models/User';
import mongoose from 'mongoose';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  await connectDB();
  try {
    const userId = params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 });
    }

    const { name, role, class: classId, rollNumber, enrolledAt } = await request.json();
    if (!name || !role) {
      return NextResponse.json({ success: false, message: 'Name and role are required.' }, { status: 400 });
    }
    if (role === 'student' && (!classId || !rollNumber)) {
      return NextResponse.json({ success: false, message: 'class and rollNumber are required for students.' }, { status: 400 });
    }

    // Prevent changing the role of the last admin
    const userToUpdate = await User.findById(userId);
    if (userToUpdate && userToUpdate.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return NextResponse.json({ success: false, message: 'Cannot change the role of the last administrator.' }, { status: 409 });
      }
    }

    const updateData: any = { name, role };
    if (role === 'student') {
      updateData.class = classId;
      updateData.rollNumber = rollNumber;
      if (enrolledAt) updateData.enrolledAt = enrolledAt;
    } else {
      updateData.class = undefined;
      updateData.rollNumber = undefined;
      updateData.enrolledAt = undefined;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}


export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  await connectDB();
  try {
    const userId = params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 });
    }

    // Professional check: Prevent deletion of the last admin user
    const userToDelete = await User.findById(userId);
    if (userToDelete && userToDelete.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return NextResponse.json({ success: false, message: 'Cannot delete the last administrator.' }, { status: 409 });
      }
    }

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}