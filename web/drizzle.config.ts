import type { Config } from 'drizzle-kit'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env from workspace root (one level up from web/)
config({ path: resolve(__dirname, '../.env') })
// Also try local .env
config({ path: resolve(__dirname, '.env') })

// drizzle-kit needs a raw file path, not a sqlite: URI
const rawUrl = (process.env.DATABASE_URL ?? 'file:./data/db.sqlite')
  .replace(/^file:/, '')

export default {
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: rawUrl,
  },
} satisfies Config
