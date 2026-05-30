import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pages, chatSessions, projects } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { resolveProvider } from '@/lib/providerResolver'
import { hasCredits } from '@/lib/credits'
import { checkRateLimit } from '@/lib/rateLimiter'

const AI_INTERNAL_URL = process.env.AI_SERVICE_INTERNAL_URL ?? 'http://localhost:4001'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimit = await checkRateLimit(session.user.id)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before sending another message.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining-Minute': String(rateLimit.remainingMinute),
          'X-RateLimit-Remaining-Hour': String(rateLimit.remainingHour),
          'Retry-After': '60',
        },
      },
    )
  }

  const body = await req.json() as {
    projectId: string
    message: string
    provider?: string
    customInstructions?: string
    currentCode?: string   // live JSX from the frontend — always the active page
  }

  const { projectId, message, provider: preferredProvider, customInstructions, currentCode } = body

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

  const chatSession = db.select().from(chatSessions)
    .where(and(eq(chatSessions.projectId, projectId), eq(chatSessions.userId, session.user.id)))
    .get()
  // messages may be a JSON string if it was double-serialised; parse defensively
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  if (chatSession?.messages) {
    const raw = chatSession.messages as unknown
    history = Array.isArray(raw)
      ? (raw as Array<{ role: 'user' | 'assistant'; content: string }>)
      : typeof raw === 'string'
        ? (() => { try { return JSON.parse(raw) } catch { return [] } })()
        : []
  }

  // Use the live code sent from the frontend (always the active page, includes
  // visual edits). Fall back to DB home page only when the page is brand new.
  let projectContext: string | undefined = currentCode && currentCode.trim().length > 20
    ? currentCode
    : undefined

  if (!projectContext) {
    const homePage = db.select({ content: pages.content }).from(pages)
      .where(and(eq(pages.projectId, projectId), eq(pages.isHomePage, true)))
      .get()
    const raw = homePage?.content
    if (raw && typeof raw === 'string' && raw.trim().length > 20) {
      projectContext = raw
    }
  }

  // Load brand settings from project
  const project = db.select({ settings: projects.settings }).from(projects)
    .where(eq(projects.id, projectId))
    .get()
  const projectSettings = project?.settings as Record<string, unknown> | null
  const brandSettings = projectSettings?.brand as {
    primaryColor?: string; fontFamily?: string; borderRadius?: string; navCode?: string
  } | undefined

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
    customInstructions,
    brandSettings,
  }

  let aiRes: Response
  try {
    aiRes = await fetch(`${AI_INTERNAL_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aiRequest),
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Cannot reach AI service at ${AI_INTERNAL_URL}. Make sure the AI service is running (pnpm dev).` },
      { status: 502 },
    )
  }

  if (!aiRes.ok || !aiRes.body) {
    let detail = ''
    try { detail = await aiRes.text() } catch { /* ignore */ }
    return NextResponse.json(
      { error: `AI service error (${aiRes.status})${detail ? ': ' + detail : ''}` },
      { status: 502 },
    )
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
