export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getTenantDb } from '@/lib/db-tenant'

export async function GET(req: NextRequest) {
  await connectDB()
  const url = new URL(req.url)
  const schoolFromHeader = req.headers.get('x-school-key') || req.headers.get('X-School-Key')
  const schoolFromQuery = url.searchParams.get('school')
  const schoolFromCookie = req.cookies?.get?.('schoolKey')?.value
  const schoolKey = (schoolFromHeader || schoolFromQuery || schoolFromCookie || '').toString().trim()
  if (!schoolKey) return NextResponse.json({ success: false, message: 'schoolKey required' }, { status: 400 })
  try {
    const conn = await getTenantDb(schoolKey)
    const dbName = (conn as any).db?.name
    if (!conn.db) throw new Error('Tenant database not available');
    const colls = await conn.db.listCollections().toArray()
    const collectionNames = colls.map(c => c.name).sort()
    // Count using raw collections to avoid model registration
    const cnt = async (name: string) => { 
      if (!conn.db) return 0;
      try { return await conn.db.collection(name).countDocuments(); } catch { return 0; } 
    }
    const [qCount, qpCount, cCount, sCount, tCount, uCount, qprCount] = await Promise.all([
      cnt('questions'), cnt('questionpapers'), cnt('classes'), cnt('subjects'), cnt('tags'), cnt('users'), cnt('questionpaperresponses')
    ])
    return NextResponse.json({ success: true, schoolKey, dbName, counts: { questions: qCount, qpapers: qpCount, classes: cCount, subjects: sCount, tags: tCount, users: uCount, questionpaperresponses: qprCount }, collections: collectionNames })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'failed' }, { status: 500 })
  }
}
