import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { generateId } from '@/lib/utils'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { email, password, name } = parsed.data

  const existing = db.select().from(users).where(eq(users.email, email)).get()
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  // First user ever becomes admin with 500 starter credits
  const anyUser = db.select({ id: users.id }).from(users).get()
  const isFirstUser = !anyUser
  const role: 'admin' | 'user' = isFirstUser ? 'admin' : 'user'
  const initialCredits = isFirstUser ? 500 : 50

  const passwordHash = await bcrypt.hash(password, 12)
  const id = generateId()

  db.insert(users).values({
    id,
    email,
    name: name ?? null,
    passwordHash,
    role,
    credits: initialCredits,
  }).run()

  return NextResponse.json({ success: true, isAdmin: isFirstUser }, { status: 201 })
}
