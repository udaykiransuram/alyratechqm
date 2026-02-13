import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path if needed
import { connectDB } from '@/lib/db';
import School from '@/models/School';
import { ensureIndexesForTenantDbName, dbNameForSchool } from '@/lib/admin/indexing';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  try {
    const body = await req.json();
    const schoolKey = body?.schoolKey ? String(body.schoolKey) : '';
    const all = !!body?.all;
    const out: Record<string, any> = {};

    if (all) {
      const schools = await School.find({}).lean();
      for (const s of schools) {
        const key = s.key || String(s._id);
        const dbn = dbNameForSchool(key);
        out[key] = await ensureIndexesForTenantDbName(dbn);
      }
    } else if (schoolKey) {
      const dbn = dbNameForSchool(schoolKey);
      out[schoolKey] = await ensureIndexesForTenantDbName(dbn);
    } else {
      return NextResponse.json({ success: false, message: 'Provide schoolKey or set all=true' }, { status: 400 });
    }

    return NextResponse.json({ success: true, results: out });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message || 'failed' }, { status: 500 });
  }
}