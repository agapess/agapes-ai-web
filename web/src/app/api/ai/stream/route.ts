import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const AI_SERVICE_INTERNAL_URL = process.env.AI_SERVICE_INTERNAL_URL ?? 'http://localhost:4001'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  const aiRes = await fetch(`${AI_SERVICE_INTERNAL_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!aiRes.ok || !aiRes.body) {
    return NextResponse.json({ error: 'AI service error' }, { status: 502 })
  }

  return new NextResponse(aiRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
