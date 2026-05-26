import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from './db'
import path from 'path'

const migrationsFolder = path.join(process.cwd(), 'drizzle')
migrate(db, { migrationsFolder })
