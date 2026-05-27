import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const adminExists = db.select({ id: users.id }).from(users)
    .where(eq(users.role, 'admin'))
    .get()
  return NextResponse.json({ adminExists: Boolean(adminExists) })
}
