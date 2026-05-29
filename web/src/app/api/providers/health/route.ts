import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const AI_INTERNAL_URL = process.env.AI_SERVICE_INTERNAL_URL ?? 'http://localhost:4001'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })

  try {
    const res = await fetch(`${AI_INTERNAL_URL}/api/providers/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ available: false })
  }
}
