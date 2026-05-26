import { eq, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { generateId } from './utils'

type DB = BetterSQLite3Database<typeof schema>

export function hasCredits(db: DB, userId: string, cost: number): boolean {
  if (cost === 0) return true
  const user = db.select({ credits: schema.users.credits })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get()
  return (user?.credits ?? 0) >= cost
}

export function deductCredits(db: DB, userId: string, amount: number, description: string): void {
  if (amount === 0) return
  db.update(schema.users)
    .set({ credits: sql`${schema.users.credits} - ${amount}` })
    .where(eq(schema.users.id, userId))
    .run()
  db.insert(schema.creditTransactions).values({
    id: generateId(),
    userId,
    amount: -amount,
    type: 'usage',
    description,
  }).run()
}

export function refundCredits(db: DB, userId: string, amount: number, description: string): void {
  if (amount === 0) return
  db.update(schema.users)
    .set({ credits: sql`${schema.users.credits} + ${amount}` })
    .where(eq(schema.users.id, userId))
    .run()
  db.insert(schema.creditTransactions).values({
    id: generateId(),
    userId,
    amount,
    type: 'refund',
    description,
  }).run()
}
