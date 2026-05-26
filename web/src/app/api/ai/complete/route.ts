import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { deductCredits } from '@/lib/credits'
import { z } from 'zod'

const completeSchema = z.object({
  creditCost: z.number().int().min(0),
  description: z.string().default('AI generation'),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = completeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  deductCredits(db, session.user.id, parsed.data.creditCost, parsed.data.description)
  return NextResponse.json({ success: true })
}
