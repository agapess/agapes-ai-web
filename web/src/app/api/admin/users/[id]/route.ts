export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { grantCredits, deductCredits } from '@/lib/credits'
import { z } from 'zod'

const updateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  creditAdjustment: z.number().int().optional(),
  creditReason: z.string().optional(),
})

type Params = { params: { id: string } }

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const adminSession = await requireAdmin()
  if (!adminSession) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const target = db.select().from(users).where(eq(users.id, params.id)).get()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { role, plan, creditAdjustment, creditReason } = parsed.data

  if (role || plan) {
    db.update(users).set({
      ...(role ? { role } : {}),
      ...(plan ? { plan } : {}),
      updatedAt: new Date(),
    }).where(eq(users.id, params.id)).run()
  }

  if (creditAdjustment !== undefined && creditAdjustment !== 0) {
    const reason = creditReason ?? (creditAdjustment > 0 ? 'Admin credit grant' : 'Admin credit removal')
    if (creditAdjustment > 0) {
      grantCredits(db, params.id, creditAdjustment, 'admin', reason)
    } else {
      deductCredits(db, params.id, Math.abs(creditAdjustment), reason)
    }
  }

  const updated = db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    plan: users.plan,
    credits: users.credits,
  }).from(users).where(eq(users.id, params.id)).get()

  return NextResponse.json({ user: updated })
}
