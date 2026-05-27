import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { creditTransactions, chatSessions, projects, users } from '@/lib/schema'
import { and, eq, gte, sql } from 'drizzle-orm'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const usageTransactions30d = db.select().from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, userId),
      eq(creditTransactions.type, 'usage'),
      gte(creditTransactions.createdAt, thirtyDaysAgo),
    ))
    .all()

  const creditsSpent30d = usageTransactions30d.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const allUsage = db.select().from(creditTransactions)
    .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.type, 'usage')))
    .all()
  const creditsSpentTotal = allUsage.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const userSessions = db.select().from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .all()

  const totalMessages = userSessions.reduce((sum, s) => {
    const msgs = s.messages as Array<{ role: string }>
    return sum + (Array.isArray(msgs) ? msgs.filter(m => m.role === 'user').length : 0)
  }, 0)

  const projectCount = db.select({ count: sql<number>`count(*)` }).from(projects)
    .where(eq(projects.userId, userId))
    .get()?.count ?? 0

  const user = db.select({ credits: users.credits, plan: users.plan }).from(users)
    .where(eq(users.id, userId))
    .get()

  const recent = db.select().from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .all()
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 20)

  return NextResponse.json({
    currentCredits: user?.credits ?? 0,
    plan: user?.plan ?? 'free',
    creditsSpent30d,
    creditsSpentTotal,
    totalMessages,
    projectCount,
    recentTransactions: recent.map(t => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      createdAt: t.createdAt?.toISOString() ?? null,
    })),
  })
}
