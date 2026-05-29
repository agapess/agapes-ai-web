import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { aiProviderConfigs } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { decrypt, getEncryptionSecret } from '@/lib/encryption'

const AI_INTERNAL_URL = process.env.AI_SERVICE_INTERNAL_URL ?? 'http://localhost:4001'

type Params = { params: { id: string } }

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}

/**
 * POST /api/admin/providers/:id/models
 * Fetch available models for an existing provider using its stored (encrypted) API key.
 * Optionally accepts a new key in the body to override.
 */
export async function POST(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cfg = db.select().from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.id, params.id), eq(aiProviderConfigs.scope, 'platform')))
    .get()

  if (!cfg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { apiKey?: string; baseUrl?: string }

  const secret = getEncryptionSecret()
  // Use caller-provided key first (being updated), fall back to stored key
  const apiKey = body.apiKey || (cfg.apiKey ? (decrypt(cfg.apiKey, secret) ?? undefined) : undefined)
  const baseUrl = body.baseUrl || cfg.baseUrl || undefined

  try {
    const res = await fetch(`${AI_INTERNAL_URL}/api/providers/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: cfg.provider,
        baseUrl,
        apiKey,
        model: cfg.model,
      }),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ models: [] })
  }
}
