import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatSessions } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

type Params = { params: { projectId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chatSession = db.select().from(chatSessions)
    .where(and(eq(chatSessions.projectId, params.projectId), eq(chatSessions.userId, session.user.id)))
    .get()

  return NextResponse.json({
    messages: chatSession ? (chatSession.messages as unknown[]) : [],
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, provider, model } = await req.json() as {
    messages: Array<{ role: string; content: string; timestamp: number }>
    provider?: string
    model?: string
  }

  const existing = db.select().from(chatSessions)
    .where(and(eq(chatSessions.projectId, params.projectId), eq(chatSessions.userId, session.user.id)))
    .get()

  // drizzle mode:'json' columns auto-stringify on write — don't double-stringify
  if (existing) {
    db.update(chatSessions).set({
      messages: messages as unknown as string,
      provider: provider ?? existing.provider,
      model: model ?? existing.model,
      updatedAt: new Date(),
    }).where(eq(chatSessions.id, existing.id)).run()
  } else {
    db.insert(chatSessions).values({
      id: generateId(),
      projectId: params.projectId,
      userId: session.user.id,
      messages: messages as unknown as string,
      provider: provider ?? null,
      model: model ?? null,
    }).run()
  }

  return NextResponse.json({ success: true })
}
