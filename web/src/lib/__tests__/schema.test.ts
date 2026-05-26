import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../schema'
import { eq } from 'drizzle-orm'
import path from 'path'

function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  return db
}

describe('schema', () => {
  let db: ReturnType<typeof createTestDb>

  beforeAll(() => {
    db = createTestDb()
  })

  it('can insert and query a user', () => {
    db.insert(schema.users).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    }).run()

    const user = db.select().from(schema.users).where(
      eq(schema.users.id, 'user-1')
    ).get()

    expect(user?.email).toBe('test@example.com')
    expect(user?.role).toBe('user')
    expect(user?.credits).toBe(0)
    expect(user?.plan).toBe('free')
  })

  it('can insert a project linked to a user', () => {
    db.insert(schema.projects).values({
      id: 'proj-1',
      userId: 'user-1',
      name: 'My Site',
      slug: 'my-site',
    }).run()

    const project = db.select().from(schema.projects).where(
      eq(schema.projects.id, 'proj-1')
    ).get()

    expect(project?.name).toBe('My Site')
    expect(project?.status).toBe('draft')
  })
})
