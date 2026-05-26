import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pages, chatSessions } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { resolveProvider } from '@/lib/providerResolver'
import { hasCredits } from '@/lib/credits'

const AI_INTERNAL_URL = process.env.AI_SERVICE_INTERNAL_URL ?? 'http://localhost:4001'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    projectId: string
    message: string
    provider?: string
  }

  const { projectId, message, provider: preferredProvider } = body

  const resolved = resolveProvider(session.user.id, session.user.plan, preferredProvider)
  if (!resolved) {
    return NextResponse.json(
      { error: 'No AI provider configured. Ask your admin to set up a provider.' },
      { status: 503 },
    )
  }

  if (!hasCredits(db, session.user.id, resolved.creditCost)) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  // Load chat history
  const chatSession = db.select().from(chatSessions)
    .where(and(eq(chatSessions.projectId, projectId), eq(chatSessions.userId, session.user.id)))
    .get()
  const history = chatSession
    ? (chatSession.messages as Array<{ role: 'user' | 'assistant'; content: string }>)
    : []

  // Load project context (home page content)
  const homePage = db.select({ content: pages.content }).from(pages)
    .where(and(eq(pages.projectId, projectId), eq(pages.isHomePage, true)))
    .get()
  const projectContext = homePage?.content ? JSON.stringify(homePage.content) : undefined

  const aiRequest = {
    projectId,
    message,
    history,
    providerConfig: {
      provider: resolved.provider,
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
      model: resolved.model,
    },
    projectContext,
  }

  const aiRes = await fetch(`${AI_INTERNAL_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aiRequest),
  })

  if (!aiRes.ok || !aiRes.body) {
    return NextResponse.json({ error: 'AI service error' }, { status: 502 })
  }

  return new NextResponse(aiRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Credit-Cost': String(resolved.creditCost),
    },
  })
}
