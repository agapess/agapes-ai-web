import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/db.sqlite'
const dbPath = DATABASE_URL.replace(/^file:/, '')

type DB = BetterSQLite3Database<typeof schema>

declare global {
  // eslint-disable-next-line no-var
  var __db: DB | undefined
}

function createDb(): DB {
  // Ensure the directory exists (handles Docker volume mounts)
  const dir = dirname(dbPath)
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

// Use a lazy getter so the DB connection is only created on first access
// This prevents "database is locked" errors during Next.js build when
// multiple routes are pre-rendered in parallel
let _db: DB | undefined = globalThis.__db

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    if (!_db) {
      _db = createDb()
      if (process.env.NODE_ENV !== 'production') globalThis.__db = _db
    }
    return (_db as any)[prop]
  },
})
