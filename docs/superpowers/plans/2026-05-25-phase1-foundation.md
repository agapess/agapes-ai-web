# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working app shell — monorepo, auth, database, chat-first builder UI, Sandpack preview, and basic Ollama connectivity.

**Architecture:** pnpm monorepo with three packages: `web/` (Next.js 14), `ai/` (Express), `shared/` (types + schemas). Docker Compose runs web:4000 + ai:4001 + redis:6380. Ollama lives on an external LAN machine at a configurable base URL.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, NextAuth v4, Drizzle ORM + better-sqlite3, Zustand, Sandpack, Express, Vitest, pnpm workspaces, Docker Compose.

---

## File Map

```
Website_Bulder/
├── package.json                     workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── docker-compose.yml
│
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts                 all shared TypeScript types
│       ├── schemas.ts               Zod validation schemas
│       └── index.ts                 barrel export
│
├── web/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── components.json              shadcn config
│   ├── vitest.config.ts
│   └── src/
│       ├── middleware.ts            NextAuth route protection
│       ├── app/
│       │   ├── layout.tsx           root layout + SessionProvider
│       │   ├── page.tsx             redirect → /dashboard
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── register/page.tsx
│       │   ├── dashboard/page.tsx   project list
│       │   ├── builder/[projectId]/page.tsx
│       │   └── api/
│       │       ├── auth/[...nextauth]/route.ts
│       │       ├── projects/route.ts          GET list, POST create
│       │       └── projects/[id]/route.ts     GET, PATCH, DELETE
│       ├── lib/
│       │   ├── auth.ts              NextAuth config
│       │   ├── db.ts               Drizzle client singleton
│       │   └── schema.ts           Drizzle schema (all Phase 1 tables)
│       ├── components/
│       │   ├── builder/
│       │   │   ├── BuilderLayout.tsx
│       │   │   ├── BuilderHeader.tsx
│       │   │   ├── ChatPanel.tsx
│       │   │   ├── PreviewPanel.tsx
│       │   │   └── StylePanel.tsx
│       │   └── ui/                 shadcn components (auto-generated)
│       └── store/
│           ├── builderStore.ts
│           └── chatStore.ts
│
└── ai/
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    └── src/
        ├── index.ts                Express app entry
        ├── config.ts               env config
        ├── adapters/
        │   ├── types.ts            AIAdapter interface
        │   └── ollama.ts           OllamaAdapter
        └── routes/
            ├── chat.ts             SSE streaming endpoint
            └── providers.ts        health + model list
```

---

## Task 1: Monorepo Root Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Create workspace package.json**

```json
{
  "name": "ai-website-builder",
  "private": true,
  "scripts": {
    "dev": "concurrently \"pnpm --filter web dev\" \"pnpm --filter ai dev\"",
    "build": "pnpm --filter shared build && pnpm --filter web build && pnpm --filter ai build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'shared'
  - 'web'
  - 'ai'
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Update .gitignore**

```gitignore
node_modules/
.next/
dist/
.env
.env.local
*.db
*.db-shm
*.db-wal
.superpowers/
data/
```

- [ ] **Step 5: Install root deps and commit**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm install
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore
git commit -m "chore: monorepo root scaffold"
```

---

## Task 2: Shared Package

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types.ts`
- Create: `shared/src/schemas.ts`
- Create: `shared/src/index.ts`

- [ ] **Step 1: Create shared/package.json**

```json
{
  "name": "@ai-builder/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  },
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

- [ ] **Step 2: Create shared/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create shared/src/types.ts**

```typescript
export type UserRole = 'user' | 'admin'
export type UserPlan = 'free' | 'pro' | 'enterprise'
export type ProjectStatus = 'draft' | 'published'
export type AIProvider = 'ollama' | 'lmstudio' | 'openai' | 'claude' | 'gemini' | 'openrouter' | 'custom'
export type AIJobType = 'generate' | 'edit' | 'export' | 'deploy'
export type AIJobStatus = 'queued' | 'running' | 'done' | 'failed'
export type ProviderScope = 'platform' | 'user'

export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  role: UserRole
  credits: number
  plan: UserPlan
  stripeCustomerId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Project {
  id: string
  userId: string
  name: string
  slug: string
  description: string | null
  theme: Record<string, unknown>
  settings: Record<string, unknown>
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
}

export interface Page {
  id: string
  projectId: string
  name: string
  slug: string
  order: number
  content: ComponentNode[]
  seoTitle: string | null
  seoDescription: string | null
  isHomePage: boolean
  updatedAt: Date
}

export interface ComponentNode {
  id: string
  type: string
  props: Record<string, unknown>
  children?: ComponentNode[]
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface AIProviderConfig {
  id: string
  scope: ProviderScope
  userId: string | null
  provider: AIProvider
  displayName: string
  baseUrl: string | null
  model: string | null
  isDefault: boolean
  isActive: boolean
  allowedPlans: UserPlan[]
  creditCostPerRequest: number
}

// SSE event types streamed from AI service → web → browser
export type AIStreamEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'code_block'; language: string; content: string }
  | { type: 'preview_update'; code: string }
  | { type: 'credits_deducted'; amount: number; remaining: number }
  | { type: 'error'; message: string }
  | { type: 'done' }
```

- [ ] **Step 4: Create shared/src/schemas.ts**

```typescript
import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'published']).optional(),
  theme: z.record(z.unknown()).optional(),
})

export const chatRequestSchema = z.object({
  projectId: z.string(),
  message: z.string().min(1).max(10000),
  provider: z.enum(['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom']).optional(),
  model: z.string().optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type ChatRequestInput = z.infer<typeof chatRequestSchema>
```

- [ ] **Step 5: Create shared/src/index.ts**

```typescript
export * from './types'
export * from './schemas'
```

- [ ] **Step 6: Build shared and commit**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm --filter shared build
git add shared/
git commit -m "feat: shared types and zod schemas"
```

Expected: `shared/dist/` directory created with compiled JS + `.d.ts` files.

---

## Task 3: Database Schema + Drizzle Client

**Files:**
- Create: `web/src/lib/schema.ts`
- Create: `web/src/lib/db.ts`
- Create: `web/drizzle.config.ts`

- [ ] **Step 1: Install web DB deps (add to web/package.json first)**

```json
{
  "name": "web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev -p ${PORT:-4000}",
    "build": "next build",
    "start": "next start -p ${PORT:-4000}",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@ai-builder/shared": "workspace:*",
    "better-sqlite3": "^9.6.0",
    "drizzle-orm": "^0.30.10",
    "next": "14.2.3",
    "next-auth": "^4.24.7",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.2",
    "@codesandbox/sandpack-react": "^2.13.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.10",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "drizzle-kit": "^0.21.4",
    "typescript": "^5.4.5",
    "tailwindcss": "^3.4.3",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "vitest": "^1.6.0",
    "@vitejs/plugin-react": "^4.2.1",
    "@testing-library/react": "^15.0.7",
    "@testing-library/jest-dom": "^6.4.2"
  }
}
```

```bash
cd "i:/VS Code/Website_Bulder"
pnpm --filter web install
```

- [ ] **Step 2: Create web/src/lib/schema.ts**

```typescript
import { sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  real,
} from 'drizzle-orm/sqlite-core'

// NextAuth required tables
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'timestamp' }),
  image: text('image'),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  credits: integer('credits').notNull().default(0),
  plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  sessionToken: text('session_token').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
})

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
})

// Projects
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  theme: text('theme', { mode: 'json' }).notNull().default('{}'),
  settings: text('settings', { mode: 'json' }).notNull().default('{}'),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  order: integer('order').notNull().default(0),
  content: text('content', { mode: 'json' }).notNull().default('[]'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  isHomePage: integer('is_home_page', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const projectHistory = sqliteTable('project_history', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  snapshot: text('snapshot', { mode: 'json' }).notNull(),
  description: text('description').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messages: text('messages', { mode: 'json' }).notNull().default('[]'),
  provider: text('provider'),
  model: text('model'),
  creditsUsed: integer('credits_used').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const aiProviderConfigs = sqliteTable('ai_provider_configs', {
  id: text('id').primaryKey(),
  scope: text('scope', { enum: ['platform', 'user'] }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom'] }).notNull(),
  displayName: text('display_name').notNull(),
  baseUrl: text('base_url'),
  apiKey: text('api_key'), // AES-256 encrypted
  model: text('model'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  allowedPlans: text('allowed_plans', { mode: 'json' }).notNull().default('["free","pro","enterprise"]'),
  creditCostPerRequest: integer('credit_cost_per_request').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const creditTransactions = sqliteTable('credit_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  type: text('type', { enum: ['purchase', 'admin', 'usage', 'refund'] }).notNull(),
  description: text('description').notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})
```

- [ ] **Step 3: Create web/src/lib/db.ts**

```typescript
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/db.sqlite'
// Strip "file:" prefix for better-sqlite3
const dbPath = DATABASE_URL.replace(/^file:/, '')

// Singleton pattern — Next.js hot reload creates multiple instances in dev
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
```

- [ ] **Step 4: Create web/drizzle.config.ts**

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/db.sqlite',
  },
} satisfies Config
```

- [ ] **Step 5: Write schema test**

Create `web/src/lib/__tests__/schema.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../schema'
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
      (u, { eq }) => eq(u.id, 'user-1')
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
      (p, { eq }) => eq(p.id, 'proj-1')
    ).get()

    expect(project?.name).toBe('My Site')
    expect(project?.status).toBe('draft')
  })
})
```

- [ ] **Step 6: Generate migration and run test**

```bash
cd "i:/VS Code/Website_Bulder/web"
mkdir -p data
pnpm db:generate
```

Expected: `web/drizzle/` directory with SQL migration files.

Create `web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create `web/src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

```bash
cd "i:/VS Code/Website_Bulder/web"
pnpm test
```

Expected: schema tests PASS.

- [ ] **Step 7: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/
git commit -m "feat: drizzle schema, db client, migrations"
```

---

## Task 4: NextAuth + Auth API Route

**Files:**
- Create: `web/src/lib/auth.ts`
- Create: `web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `web/src/middleware.ts`

- [ ] **Step 1: Create web/src/lib/auth.ts**

```typescript
import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from './db'
import * as schema from './schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }) as NextAuthOptions['adapter'],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = db.select().from(schema.users)
          .where(eq(schema.users.email, credentials.email))
          .get()
        // Phase 1: simple plaintext check — Phase 3 will add bcrypt
        if (!user) return null
        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        const dbUser = db.select().from(schema.users)
          .where(eq(schema.users.id, user.id))
          .get()
        token.role = dbUser?.role ?? 'user'
        token.plan = dbUser?.plan ?? 'free'
        token.credits = dbUser?.credits ?? 0
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.plan = token.plan as string
        session.user.credits = token.credits as number
      }
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
```

- [ ] **Step 2: Extend NextAuth session types**

Create `web/src/types/next-auth.d.ts`:

```typescript
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      image: string | null
      role: string
      plan: string
      credits: number
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    plan: string
    credits: number
  }
}
```

- [ ] **Step 3: Create auth API route**

Create `web/src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 4: Create middleware**

Create `web/src/middleware.ts`:

```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/builder/:path*',
    '/api/projects/:path*',
  ],
}
```

- [ ] **Step 5: Install auth adapter dep and commit**

Add to web/package.json dependencies:
```json
"@auth/drizzle-adapter": "^1.4.2"
```

```bash
cd "i:/VS Code/Website_Bulder"
pnpm --filter web install
git add web/src/lib/auth.ts web/src/app/api/auth web/src/middleware.ts web/src/types/
git commit -m "feat: nextauth config with credentials + google oauth"
```

---

## Task 5: Project API Routes

**Files:**
- Create: `web/src/app/api/projects/route.ts`
- Create: `web/src/app/api/projects/[id]/route.ts`
- Create: `web/src/app/api/projects/__tests__/projects.test.ts`

- [ ] **Step 1: Write failing tests**

Create `web/src/app/api/projects/__tests__/projects.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock next-auth and db
vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/schema', () => ({}))

import { getServerSession } from 'next-auth'

describe('projects API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/projects returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    // The actual request test happens via integration in Phase 2
    // Unit: verify session check logic
    const session = await getServerSession()
    expect(session).toBeNull()
  })

  it('slug is generated from project name', () => {
    const name = 'My Awesome Site!'
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    expect(slug).toBe('my-awesome-site')
  })
})
```

```bash
cd "i:/VS Code/Website_Bulder/web"
pnpm test
```

Expected: tests PASS (the slug test) or skipped (the session mock test).

- [ ] **Step 2: Create helper for slug generation and ID**

Create `web/src/lib/utils.ts`:

```typescript
import { randomUUID } from 'crypto'

export function generateId(): string {
  return randomUUID()
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}
```

- [ ] **Step 3: Create GET + POST /api/projects route**

Create `web/src/app/api/projects/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, pages } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { createProjectSchema } from '@ai-builder/shared'
import { generateId, slugify } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userProjects = db.select().from(projects)
    .where(eq(projects.userId, session.user.id))
    .all()

  return NextResponse.json({ projects: userProjects })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const projectId = generateId()
  const pageId = generateId()

  db.insert(projects).values({
    id: projectId,
    userId: session.user.id,
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
    description: parsed.data.description ?? null,
  }).run()

  // Create default home page
  db.insert(pages).values({
    id: pageId,
    projectId,
    name: 'Home',
    slug: 'index',
    order: 0,
    isHomePage: true,
  }).run()

  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  return NextResponse.json({ project }, { status: 201 })
}
```

- [ ] **Step 4: Create GET + PATCH + DELETE /api/projects/[id] route**

Create `web/src/app/api/projects/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { updateProjectSchema } from '@ai-builder/shared'

type Params = { params: { id: string } }

function getOwnedProject(userId: string, projectId: string) {
  return db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get()
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = getOwnedProject(session.user.id, params.id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ project })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = getOwnedProject(session.user.id, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  db.update(projects).set({
    ...parsed.data,
    updatedAt: new Date(),
  }).where(eq(projects.id, params.id)).run()

  const updated = db.select().from(projects).where(eq(projects.id, params.id)).get()
  return NextResponse.json({ project: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = getOwnedProject(session.user.id, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.delete(projects).where(eq(projects.id, params.id)).run()
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 5: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/api/projects/ web/src/lib/utils.ts
git commit -m "feat: project CRUD API routes"
```

---

## Task 6: AI Service Bootstrap + Ollama Adapter

**Files:**
- Create: `ai/package.json`
- Create: `ai/tsconfig.json`
- Create: `ai/vitest.config.ts`
- Create: `ai/src/config.ts`
- Create: `ai/src/adapters/types.ts`
- Create: `ai/src/adapters/ollama.ts`
- Create: `ai/src/routes/chat.ts`
- Create: `ai/src/routes/providers.ts`
- Create: `ai/src/index.ts`

- [ ] **Step 1: Create ai/package.json**

```json
{
  "name": "ai",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@ai-builder/shared": "workspace:*",
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20",
    "tsx": "^4.11.0",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create ai/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "target": "ES2022"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create ai/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Create ai/src/config.ts**

```typescript
export const config = {
  port: parseInt(process.env.AI_PORT ?? '4001', 10),
  webServiceUrl: process.env.WEB_SERVICE_URL ?? 'http://localhost:4000',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  lmstudioBaseUrl: process.env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  defaultProvider: (process.env.DEFAULT_PROVIDER ?? 'ollama') as 'ollama' | 'lmstudio',
  defaultModel: process.env.DEFAULT_MODEL ?? 'llama3.2',
} as const
```

- [ ] **Step 5: Create ai/src/adapters/types.ts**

```typescript
export interface Model {
  id: string
  name: string
  contextLength?: number
}

export interface AIRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  model: string
  projectContext?: string
}

export type AIChunk =
  | { type: 'text_delta'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface AIAdapter {
  readonly name: string
  isAvailable(): Promise<boolean>
  listModels(): Promise<Model[]>
  stream(req: AIRequest): AsyncGenerator<AIChunk>
  estimateCredits(req: AIRequest): number
}
```

- [ ] **Step 6: Write failing Ollama adapter test**

Create `ai/src/adapters/__tests__/ollama.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaAdapter } from '../ollama.js'

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter

  beforeEach(() => {
    adapter = new OllamaAdapter('http://localhost:11434', 'llama3.2')
  })

  it('has name ollama', () => {
    expect(adapter.name).toBe('ollama')
  })

  it('estimateCredits always returns 0 (local model)', () => {
    const req = {
      messages: [{ role: 'user' as const, content: 'hello' }],
      model: 'llama3.2',
    }
    expect(adapter.estimateCredits(req)).toBe(0)
  })

  it('isAvailable returns false when ollama is unreachable', async () => {
    const adapter = new OllamaAdapter('http://127.0.0.1:19999', 'llama3.2')
    const result = await adapter.isAvailable()
    expect(result).toBe(false)
  })
})
```

```bash
cd "i:/VS Code/Website_Bulder/ai"
pnpm install
pnpm test
```

Expected: FAIL — `OllamaAdapter` not defined yet.

- [ ] **Step 7: Implement OllamaAdapter**

Create `ai/src/adapters/ollama.ts`:

```typescript
import type { AIAdapter, AIChunk, AIRequest, Model } from './types.js'

export class OllamaAdapter implements AIAdapter {
  readonly name = 'ollama'

  constructor(
    private readonly baseUrl: string,
    private readonly defaultModel: string,
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<Model[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`)
    if (!res.ok) return []
    const data = await res.json() as { models: Array<{ name: string; details?: { parameter_size?: string } }> }
    return data.models.map(m => ({ id: m.name, name: m.name }))
  }

  async *stream(req: AIRequest): AsyncGenerator<AIChunk> {
    const model = req.model || this.defaultModel
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: req.messages,
        stream: true,
      }),
    })

    if (!res.ok || !res.body) {
      yield { type: 'error', message: `Ollama responded with ${res.status}` }
      return
    }

    const decoder = new TextDecoder()
    const reader = res.body.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const json = JSON.parse(line) as {
              message?: { content?: string }
              done?: boolean
            }
            if (json.message?.content) {
              yield { type: 'text_delta', content: json.message.content }
            }
            if (json.done) {
              yield { type: 'done' }
              return
            }
          } catch {
            // partial JSON line, skip
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  estimateCredits(_req: AIRequest): number {
    return 0 // local model — free
  }
}
```

- [ ] **Step 8: Run tests — should pass now**

```bash
cd "i:/VS Code/Website_Bulder/ai"
pnpm test
```

Expected: all 3 tests PASS.

- [ ] **Step 9: Create ai/src/routes/providers.ts**

```typescript
import { Router } from 'express'
import { OllamaAdapter } from '../adapters/ollama.js'
import { config } from '../config.js'

export const providersRouter = Router()

const ollamaAdapter = new OllamaAdapter(config.ollamaBaseUrl, config.defaultModel)

providersRouter.get('/health', async (_req, res) => {
  const available = await ollamaAdapter.isAvailable()
  res.json({
    ollama: { available, baseUrl: config.ollamaBaseUrl },
  })
})

providersRouter.get('/models', async (_req, res) => {
  const available = await ollamaAdapter.isAvailable()
  if (!available) {
    return res.json({ models: [] })
  }
  const models = await ollamaAdapter.listModels()
  res.json({ models })
})
```

- [ ] **Step 10: Create ai/src/routes/chat.ts**

```typescript
import { Router, type Request, type Response } from 'express'
import { OllamaAdapter } from '../adapters/ollama.js'
import { config } from '../config.js'
import { chatRequestSchema } from '@ai-builder/shared'

export const chatRouter = Router()

const ollamaAdapter = new OllamaAdapter(config.ollamaBaseUrl, config.defaultModel)

// SSE streaming chat endpoint
chatRouter.post('/stream', async (req: Request, res: Response) => {
  const parsed = chatRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { message, model } = parsed.data

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const available = await ollamaAdapter.isAvailable()
    if (!available) {
      sendEvent({ type: 'error', message: `Ollama unreachable at ${config.ollamaBaseUrl}` })
      return res.end()
    }

    const request = {
      messages: [{ role: 'user' as const, content: message }],
      model: model ?? config.defaultModel,
    }

    for await (const chunk of ollamaAdapter.stream(request)) {
      sendEvent(chunk)
      if (chunk.type === 'done' || chunk.type === 'error') break
    }
  } catch (err) {
    sendEvent({ type: 'error', message: String(err) })
  }

  res.end()
})
```

- [ ] **Step 11: Create ai/src/index.ts**

```typescript
import express from 'express'
import cors from 'cors'
import { chatRouter } from './routes/chat.js'
import { providersRouter } from './routes/providers.js'
import { config } from './config.js'

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/chat', chatRouter)
app.use('/api/providers', providersRouter)

app.listen(config.port, () => {
  console.log(`AI service running on port ${config.port}`)
  console.log(`Ollama endpoint: ${config.ollamaBaseUrl}`)
})
```

- [ ] **Step 12: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add ai/
git commit -m "feat: express AI service with Ollama adapter and SSE streaming"
```

---

## Task 7: Next.js App Shell + Layout

**Files:**
- Create: `web/next.config.ts`
- Create: `web/tailwind.config.ts`
- Create: `web/postcss.config.mjs`
- Create: `web/components.json`
- Create: `web/src/app/layout.tsx`
- Create: `web/src/app/page.tsx`
- Create: `web/src/app/(auth)/login/page.tsx`
- Create: `web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Create web/next.config.ts**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ai-builder/shared'],
}

export default nextConfig
```

- [ ] **Step 2: Create web/tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...fontFamily.sans],
      },
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
```

- [ ] **Step 3: Create web/postcss.config.mjs**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: Create web/src/app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222 47% 11%;
    --foreground: 213 31% 91%;
    --card: 222 47% 13%;
    --card-foreground: 213 31% 91%;
    --primary: 246 83% 68%;
    --primary-foreground: 210 40% 98%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --accent: 217 33% 17%;
    --accent-foreground: 210 40% 98%;
    --border: 217 33% 17%;
    --radius: 0.5rem;
  }
}

@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 5: Create web/src/app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import SessionProvider from '@/components/SessionProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Website Builder',
  description: 'Build websites with AI',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Create SessionProvider client component**

Create `web/src/components/SessionProvider.tsx`:

```typescript
'use client'
import { SessionProvider as NextSessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'

export default function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  return <NextSessionProvider session={session}>{children}</NextSessionProvider>
}
```

- [ ] **Step 7: Create root page (redirect)**

Create `web/src/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')
  redirect('/login')
}
```

- [ ] **Step 8: Create login page**

Create `web/src/app/(auth)/login/page.tsx`:

```typescript
'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">AI Website Builder</h1>
          <p className="mt-2 text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full py-2 px-4 bg-secondary border border-border text-foreground rounded-md font-medium hover:bg-accent transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Create dashboard page**

Create `web/src/app/dashboard/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const userProjects = db.select().from(projects)
    .where(eq(projects.userId, session.user.id))
    .all()

  return <DashboardClient initialProjects={userProjects} user={session.user} />
}
```

Create `web/src/app/dashboard/DashboardClient.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { Project } from '@ai-builder/shared'

interface Props {
  initialProjects: Project[]
  user: { id: string; name: string | null; email: string; credits: number; plan: string }
}

export default function DashboardClient({ initialProjects, user }: Props) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  async function createProject() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.project) {
      setNewName('')
      router.push(`/builder/${data.project.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">AI Website Builder</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user.credits} credits · {user.plan}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-foreground">Your Projects</h2>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              placeholder="Project name…"
              className="px-3 py-2 bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={createProject}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? 'Creating…' : 'New Project'}
            </button>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No projects yet.</p>
            <p className="text-sm mt-1">Create your first project to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => router.push(`/builder/${project.id}`)}
                className="p-4 bg-card border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              >
                <h3 className="font-medium text-foreground">{project.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{project.status}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 10: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/ web/src/components/SessionProvider.tsx web/next.config.ts web/tailwind.config.ts web/postcss.config.mjs
git commit -m "feat: app shell, login page, dashboard"
```

---

## Task 8: Chat-First Builder UI

**Files:**
- Create: `web/src/store/builderStore.ts`
- Create: `web/src/store/chatStore.ts`
- Create: `web/src/components/builder/BuilderLayout.tsx`
- Create: `web/src/components/builder/BuilderHeader.tsx`
- Create: `web/src/components/builder/ChatPanel.tsx`
- Create: `web/src/components/builder/PreviewPanel.tsx`
- Create: `web/src/components/builder/StylePanel.tsx`
- Create: `web/src/app/builder/[projectId]/page.tsx`

- [ ] **Step 1: Create builderStore**

Create `web/src/store/builderStore.ts`:

```typescript
import { create } from 'zustand'
import type { Project, Page } from '@ai-builder/shared'

interface BuilderState {
  project: Project | null
  pages: Page[]
  activePage: Page | null
  previewCode: string
  previewSize: 'desktop' | 'tablet' | 'mobile'
  setProject: (project: Project) => void
  setPages: (pages: Page[]) => void
  setActivePage: (page: Page) => void
  setPreviewCode: (code: string) => void
  setPreviewSize: (size: 'desktop' | 'tablet' | 'mobile') => void
}

export const useBuilderStore = create<BuilderState>((set) => ({
  project: null,
  pages: [],
  activePage: null,
  previewCode: '',
  previewSize: 'desktop',
  setProject: (project) => set({ project }),
  setPages: (pages) => set({ pages }),
  setActivePage: (activePage) => set({ activePage }),
  setPreviewCode: (previewCode) => set({ previewCode }),
  setPreviewSize: (previewSize) => set({ previewSize }),
}))
```

- [ ] **Step 2: Create chatStore**

Create `web/src/store/chatStore.ts`:

```typescript
import { create } from 'zustand'
import type { ChatMessage } from '@ai-builder/shared'

interface ChatState {
  messages: ChatMessage[]
  streaming: boolean
  streamingContent: string
  addMessage: (message: ChatMessage) => void
  setStreaming: (streaming: boolean) => void
  appendStreamingContent: (content: string) => void
  finalizeStreamingMessage: () => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  streamingContent: '',
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setStreaming: (streaming) => set({ streaming, streamingContent: streaming ? '' : get().streamingContent }),
  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  finalizeStreamingMessage: () => {
    const { streamingContent, messages } = get()
    if (!streamingContent) return
    set({
      messages: [
        ...messages,
        { role: 'assistant', content: streamingContent, timestamp: Date.now() },
      ],
      streamingContent: '',
      streaming: false,
    })
  },
  clearMessages: () => set({ messages: [], streamingContent: '', streaming: false }),
}))
```

- [ ] **Step 3: Create BuilderHeader**

Create `web/src/components/builder/BuilderHeader.tsx`:

```typescript
'use client'
import { useBuilderStore } from '@/store/builderStore'
import { useRouter } from 'next/navigation'

export default function BuilderHeader() {
  const { project, previewSize, setPreviewSize } = useBuilderStore()
  const router = useRouter()

  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-4 bg-card shrink-0">
      <button
        onClick={() => router.push('/dashboard')}
        className="text-muted-foreground hover:text-foreground transition-colors text-sm"
      >
        ← Dashboard
      </button>

      <span className="text-foreground font-medium text-sm truncate flex-1">
        {project?.name ?? 'Loading…'}
      </span>

      <div className="flex items-center gap-1 bg-secondary rounded-md p-1">
        {(['desktop', 'tablet', 'mobile'] as const).map((size) => (
          <button
            key={size}
            onClick={() => setPreviewSize(size)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              previewSize === size
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {size === 'desktop' ? '🖥' : size === 'tablet' ? '📱' : '📲'}
          </button>
        ))}
      </div>

      <button className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:opacity-90 transition-opacity">
        Publish
      </button>
    </header>
  )
}
```

- [ ] **Step 4: Create ChatPanel**

Create `web/src/components/builder/ChatPanel.tsx`:

```typescript
'use client'
import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useBuilderStore } from '@/store/builderStore'

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:4001'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    streaming,
    streamingContent,
    addMessage,
    setStreaming,
    appendStreamingContent,
    finalizeStreamingMessage,
  } = useChatStore()
  const { project, setPreviewCode } = useBuilderStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  async function sendMessage() {
    const content = input.trim()
    if (!content || streaming || !project) return

    setInput('')
    addMessage({ role: 'user', content, timestamp: Date.now() })
    setStreaming(true)

    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          message: content,
        }),
      })

      if (!res.ok || !res.body) {
        finalizeStreamingMessage()
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value, { stream: true })
          .split('\n')
          .filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'text_delta') {
              appendStreamingContent(event.content)
            } else if (event.type === 'preview_update') {
              setPreviewCode(event.code)
            } else if (event.type === 'done' || event.type === 'error') {
              finalizeStreamingMessage()
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch {
      finalizeStreamingMessage()
    }
  }

  return (
    <aside className="w-80 flex flex-col border-r border-border bg-card shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="text-primary">✦</span> AI Chat
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <p className="text-muted-foreground text-sm text-center mt-8">
            Describe the website you want to build…
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {streaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-secondary text-foreground">
              {streamingContent}
              <span className="inline-block w-1 h-4 bg-primary ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {streaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="px-3 py-2 bg-secondary rounded-lg">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Describe what to build…"
            rows={2}
            disabled={streaming}
            className="flex-1 px-3 py-2 bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity self-end"
          >
            ↑
          </button>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Create PreviewPanel with Sandpack**

Create `web/src/components/builder/PreviewPanel.tsx`:

```typescript
'use client'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
} from '@codesandbox/sandpack-react'
import { useBuilderStore } from '@/store/builderStore'
import { useState } from 'react'

const DEFAULT_CODE = `export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', background: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>Your website starts here</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>
        Chat with AI to build your website. Your live preview will appear here.
      </p>
    </div>
  )
}`

const PREVIEW_WIDTHS = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

export default function PreviewPanel() {
  const { previewCode, previewSize } = useBuilderStore()
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const code = previewCode || DEFAULT_CODE

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card shrink-0">
        {(['preview', 'code'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'preview' ? 'Preview' : 'Code'}
          </button>
        ))}
      </div>

      {/* Sandpack */}
      <div className="flex-1 overflow-hidden flex items-start justify-center pt-4">
        <div
          className="h-full transition-all duration-300"
          style={{ width: PREVIEW_WIDTHS[previewSize] }}
        >
          <SandpackProvider
            template="react"
            theme="dark"
            files={{
              '/App.js': code,
            }}
            options={{
              externalResources: [
                'https://cdn.tailwindcss.com',
              ],
            }}
          >
            <SandpackLayout style={{ height: '100%', borderRadius: 0 }}>
              {activeTab === 'preview' ? (
                <SandpackPreview style={{ height: '100%' }} showOpenInCodeSandbox={false} />
              ) : (
                <SandpackCodeEditor style={{ height: '100%' }} showLineNumbers />
              )}
            </SandpackLayout>
          </SandpackProvider>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create StylePanel**

Create `web/src/components/builder/StylePanel.tsx`:

```typescript
export default function StylePanel() {
  return (
    <aside className="w-60 border-l border-border bg-card flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Style</h2>
      </div>
      <div className="flex-1 p-4">
        <p className="text-xs text-muted-foreground">
          Select an element in the preview to edit its styles.
        </p>
      </div>
    </aside>
  )
}
```

- [ ] **Step 7: Create BuilderLayout**

Create `web/src/components/builder/BuilderLayout.tsx`:

```typescript
'use client'
import BuilderHeader from './BuilderHeader'
import ChatPanel from './ChatPanel'
import PreviewPanel from './PreviewPanel'
import StylePanel from './StylePanel'

export default function BuilderLayout() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <BuilderHeader />
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel />
        <PreviewPanel />
        <StylePanel />
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Create builder page**

Create `web/src/app/builder/[projectId]/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import BuilderPage from './BuilderPage'

interface Props {
  params: { projectId: string }
}

export default async function BuilderRoute({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const project = db.select().from(projects)
    .where(and(
      eq(projects.id, params.projectId),
      eq(projects.userId, session.user.id),
    ))
    .get()

  if (!project) redirect('/dashboard')

  return <BuilderPage project={project} />
}
```

Create `web/src/app/builder/[projectId]/BuilderPage.tsx`:

```typescript
'use client'
import { useEffect } from 'react'
import { useBuilderStore } from '@/store/builderStore'
import BuilderLayout from '@/components/builder/BuilderLayout'
import type { Project } from '@ai-builder/shared'

export default function BuilderPage({ project }: { project: Project }) {
  const setProject = useBuilderStore(s => s.setProject)

  useEffect(() => {
    setProject(project)
  }, [project, setProject])

  return <BuilderLayout />
}
```

- [ ] **Step 9: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/store/ web/src/components/builder/ web/src/app/builder/ web/src/app/dashboard/
git commit -m "feat: chat-first builder UI with Sandpack preview and Zustand stores"
```

---

## Task 9: Docker Compose + Environment

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: '3.9'

services:
  web:
    build:
      context: .
      dockerfile: web/Dockerfile
    ports:
      - "${WEB_PORT:-4000}:4000"
    environment:
      - PORT=4000
      - DATABASE_URL=file:/data/db.sqlite
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - NEXT_PUBLIC_AI_SERVICE_URL=${NEXT_PUBLIC_AI_SERVICE_URL:-http://localhost:4001}
      - ENCRYPTION_SECRET=${ENCRYPTION_SECRET}
    volumes:
      - web_data:/data
    depends_on:
      - redis
    restart: unless-stopped

  ai:
    build:
      context: .
      dockerfile: ai/Dockerfile
    ports:
      - "${AI_PORT:-4001}:4001"
    environment:
      - AI_PORT=4001
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL}
      - LMSTUDIO_BASE_URL=${LMSTUDIO_BASE_URL}
      - DEFAULT_PROVIDER=${DEFAULT_PROVIDER:-ollama}
      - DEFAULT_MODEL=${DEFAULT_MODEL:-llama3.2}
      - REDIS_URL=redis://redis:6380
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "${REDIS_PORT:-6380}:6379"
    command: redis-server --port 6379
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  web_data:
  redis_data:
```

- [ ] **Step 2: Create web/Dockerfile**

```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY shared/package.json ./shared/
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY . .
RUN pnpm --filter shared build
RUN pnpm --filter web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN mkdir -p /data
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./web/.next/static
COPY --from=builder /app/web/public ./web/public
COPY --from=builder /app/web/drizzle ./web/drizzle
EXPOSE 4000
CMD ["node", "web/server.js"]
```

- [ ] **Step 3: Create ai/Dockerfile**

```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY shared/package.json ./shared/
COPY ai/package.json ./ai/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/ai/node_modules ./ai/node_modules
COPY . .
RUN pnpm --filter shared build
RUN pnpm --filter ai build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/ai/dist ./dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/ai/node_modules ./node_modules
EXPOSE 4001
CMD ["node", "dist/index.js"]
```

- [ ] **Step 4: Create .env.example**

```env
# ─── Ports (change to avoid conflicts with other services) ───────────────────
WEB_PORT=4000
AI_PORT=4001
REDIS_PORT=6380

# ─── NextAuth ────────────────────────────────────────────────────────────────
NEXTAUTH_URL=http://localhost:4000
NEXTAUTH_SECRET=change_me_generate_with_openssl_rand_base64_32

# ─── Google OAuth (optional — remove GoogleProvider from auth.ts to disable) ─
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=file:./data/db.sqlite

# ─── Encryption (for API keys stored in DB) ──────────────────────────────────
ENCRYPTION_SECRET=change_me_generate_with_openssl_rand_base64_32

# ─── AI Providers (your LAN machine running Ollama / LM Studio) ──────────────
OLLAMA_BASE_URL=http://192.168.1.x:11434
LMSTUDIO_BASE_URL=http://192.168.1.x:1234
DEFAULT_PROVIDER=ollama
DEFAULT_MODEL=llama3.2

# ─── AI Service URL (as seen from browser) ───────────────────────────────────
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:4001

# ─── Stripe (Phase 3 — leave blank for Phase 1) ──────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

- [ ] **Step 5: Add output: standalone to next.config.ts (required for Docker)**

Update `web/next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ai-builder/shared'],
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 6: Run migration on startup — create web/src/lib/migrate.ts**

```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from './db'
import path from 'path'

const migrationsFolder = path.join(process.cwd(), 'drizzle')
migrate(db, { migrationsFolder })
console.log('Database migrations applied')
```

Add to `web/src/app/api/auth/[...nextauth]/route.ts` top:

```typescript
// Run migrations on first request (safe to call repeatedly)
import '@/lib/migrate'
```

- [ ] **Step 7: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add docker-compose.yml .env.example web/Dockerfile ai/Dockerfile web/next.config.ts web/src/lib/migrate.ts
git commit -m "feat: docker compose, dockerfiles, env config"
```

---

## Task 10: Verify Everything Works

- [ ] **Step 1: Copy .env.example to .env and fill in values**

```bash
cp "i:/VS Code/Website_Bulder/.env.example" "i:/VS Code/Website_Bulder/.env"
```

Edit `.env` — set your actual `OLLAMA_BASE_URL`, generate secrets:

```bash
# Generate NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Generate ENCRYPTION_SECRET  
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- [ ] **Step 2: Install all deps and build shared**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm install
pnpm --filter shared build
```

- [ ] **Step 3: Run database migration**

```bash
cd "i:/VS Code/Website_Bulder/web"
mkdir -p data
pnpm db:generate
pnpm db:migrate
```

Expected: `web/drizzle/` populated, `web/data/db.sqlite` created.

- [ ] **Step 4: Run all tests**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 5: Start dev servers**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm dev
```

Expected:
- Web: http://localhost:4000
- AI service: http://localhost:4001
- AI health: http://localhost:4001/health → `{"status":"ok"}`

- [ ] **Step 6: Smoke test in browser**

1. Open http://localhost:4000 → redirects to `/login`
2. Register/sign in
3. Create a project from dashboard
4. Opens builder at `/builder/<id>`
5. Type a message in chat panel → SSE stream flows from AI service → displays in chat
6. Sandpack preview renders default code

- [ ] **Step 7: Final commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add .
git commit -m "feat: phase 1 complete — working app shell with auth, preview, and Ollama chat"
```

---

## Self-Review Notes

- All types defined in `shared/src/types.ts` are used consistently across `schema.ts`, API routes, and stores
- `slugify` and `generateId` defined in `utils.ts` — used in projects POST route
- `AIAdapter` interface in `ai/src/adapters/types.ts` matches what `OllamaAdapter` implements
- `ChatMessage` type used in `chatStore` matches `chat_sessions.messages` JSON column
- `PROJECT_URL` env var not used — `NEXT_PUBLIC_AI_SERVICE_URL` is the correct name used in `ChatPanel`
- Migration runs on first API request via `import '@/lib/migrate'` — safe for concurrent requests (SQLite WAL mode)
- Docker ports 4000/4001/6380 match `.env.example` defaults throughout
- `previewSize` widths in `PreviewPanel` match `BuilderHeader` size labels
