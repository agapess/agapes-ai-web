export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const allUsers = db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    plan: users.plan,
    credits: users.credits,
    createdAt: users.createdAt,
  }).from(users).all()

  return NextResponse.json({ users: allUsers })
}
