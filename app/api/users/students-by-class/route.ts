
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getTenantModels } from '@/lib/db-tenant'
import mongoose from 'mongoose'

export async function GET(req: NextRequest) {
  await connectDB()
  const url = new URL(req.url)
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key')
  const schoolFromQuery = url.searchParams.get('school')
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim()
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 })
  try {
    const { Class } = await getTenantModels(schoolKey, ['Class'])
    const classId = url.searchParams.get('classId') || undefined
    const q = url.searchParams.get('q') || undefined
    const includeEmpty = (url.searchParams.get('includeEmpty') || 'false') === 'true'

    const classMatch: any = {}
    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return NextResponse.json({ success: false, message: 'Invalid classId' }, { status: 400 })
      }
      classMatch._id = new mongoose.Types.ObjectId(classId)
    }

    const userFilterOr: any[] = []
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i')
      userFilterOr.push({ name: { $regex: regex } })
      userFilterOr.push({ email: { $regex: regex } })
      userFilterOr.push({ rollNumber: { $regex: regex } })
    }

    const pipeline: any[] = [
      { $match: classMatch },
      {
        $lookup: {
          from: 'users',
          let: { classId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $and: [ { $eq: ['$class', '$$classId'] }, { $eq: ['$role', 'student'] } ] },
              },
            },
            ...(userFilterOr.length ? [ { $match: { $or: userFilterOr } } ] : []),
            { $project: { passwordHash: 0 } },
            { $sort: { name: 1 } },
          ],
          as: 'students',
        },
      },
      { $project: { _id: 1, name: 1, students: 1, count: { $size: '$students' } } },
      { $sort: { name: 1 } },
    ]

    const agg = await Class.aggregate(pipeline)
    const data = (includeEmpty ? agg : agg.filter((c: any) => c.count > 0)).map((c: any) => ({
      classId: c._id,
      className: c.name,
      count: c.count,
      students: c.students?.map((s: any) => ({
        _id: s._id,
        name: s.name,
        email: s.email,
        rollNumber: s.rollNumber,
        enrolledAt: s.enrolledAt,
      })) || [],
    }))

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 })
  }
}
