import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/db.sqlite'
const dbPath = DATABASE_URL.replace(/^file:/, '')

type DB = BetterSQLite3Database<typeof schema>

declare global {
  // eslint-disable-next-line no-var
  var __db: DB | undefined
}

function createDb(): DB {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

export const db: DB = globalThis.__db ?? createDb()
if (process.env.NODE_ENV !== 'production') globalThis.__db = db
