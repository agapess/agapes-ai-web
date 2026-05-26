import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/db.sqlite'
const dbPath = DATABASE_URL.replace(/^file:/, '')

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle> | undefined
}

function createDb() {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

export const db = globalThis.__db ?? createDb()
if (process.env.NODE_ENV !== 'production') globalThis.__db = db
