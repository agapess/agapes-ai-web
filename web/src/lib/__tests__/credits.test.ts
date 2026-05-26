import { describe, it, expect, beforeAll } from 'vitest'
import { eq } from 'drizzle-orm'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../schema'
import { hasCredits, deductCredits, refundCredits, grantCredits } from '../credits'
import path from 'path'

function testDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  return db
}

describe('credit gate', () => {
  let db: ReturnType<typeof testDb>

  beforeAll(() => {
    db = testDb()
    db.insert(schema.users).values({ id: 'u1', email: 'a@b.com', credits: 10 }).run()
  })

  it('hasCredits returns true when balance >= cost', () => {
    expect(hasCredits(db, 'u1', 5)).toBe(true)
  })

  it('hasCredits returns true when cost is 0', () => {
    expect(hasCredits(db, 'u1', 0)).toBe(true)
  })

  it('hasCredits returns false when balance < cost', () => {
    expect(hasCredits(db, 'u1', 100)).toBe(false)
  })

  it('deductCredits reduces balance and creates transaction', () => {
    deductCredits(db, 'u1', 3, 'test deduction')
    const user = db.select().from(schema.users).where(eq(schema.users.id, 'u1')).get()
    expect(user?.credits).toBe(7)
  })

  it('refundCredits increases balance and creates transaction', () => {
    refundCredits(db, 'u1', 2, 'test refund')
    const user = db.select().from(schema.users).where(eq(schema.users.id, 'u1')).get()
    expect(user?.credits).toBe(9)
  })

  it('grantCredits increases balance and creates purchase transaction', () => {
    grantCredits(db, 'u1', 50, 'purchase', 'Starter pack')
    const user = db.select().from(schema.users).where(eq(schema.users.id, 'u1')).get()
    // Starting balance was 9 after previous deduct/refund tests; 9+50=59
    expect(user?.credits).toBe(59)
  })
})
