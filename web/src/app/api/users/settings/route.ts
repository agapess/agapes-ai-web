import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { encrypt, getEncryptionSecret } from '@/lib/encryption'
import { z } from 'zod'

const settingsSchema = z.object({
  vercelToken: z.string().optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = db.select({ settings: users.settings }).from(users)
    .where(eq(users.id, session.user.id))
    .get()

  const currentSettings = (user?.settings as Record<string, unknown>) ?? {}
  const secret = getEncryptionSecret()
  const newSettings = { ...currentSettings }

  if (parsed.data.vercelToken !== undefined) {
    if (parsed.data.vercelToken === '') {
      delete newSettings.vercelToken
    } else {
      newSettings.vercelToken = encrypt(parsed.data.vercelToken, secret) ?? ''
    }
  }

  db.update(users).set({
    settings: newSettings,
    updatedAt: new Date(),
  }).where(eq(users.id, session.user.id)).run()

  return NextResponse.json({ success: true })
}
