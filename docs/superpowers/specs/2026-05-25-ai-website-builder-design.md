# AI Website Builder — Design Spec

**Date:** 2026-05-25  
**Status:** Approved  
**Project:** `i:/VS Code/Website_Bulder`

---

## 1. Product Goal

A self-hosted, multi-user AI-powered website builder where users chat with AI to create, edit, and deploy professional websites. Inspired by Lovable, Bolt.new, and v0. Optimised for local LLMs (Ollama, LM Studio) with full cloud provider support.

---

## 2. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | Split monorepo (Next.js + Express AI service) | Isolates AI workloads; clean domain boundary; swappable AI engine |
| User model | Multi-user platform | Multiple users, isolated projects |
| Auth | NextAuth.js | Self-hostable, OAuth-ready, Next.js native |
| Billing | Stripe + admin-assigned credits | Supports both real payments and manual credit top-ups |
| AI providers | Two-tier (platform-shared + user-owned) | Admin shares LLM access by plan; users can add own keys |
| Primary AI | Ollama (LAN, external to Docker) | Local-first; no GPU on server required |
| Preview engine | Sandpack (Phase 1–5) → custom Vite runtime (Phase 6+) | Fast to ship, clean abstraction for future swap |
| UI layout | Chat-first (Lovable-style) | AI chat left, preview centre, style panel right |
| Database | SQLite via Drizzle ORM → Postgres | Start simple; migration is trivial with Drizzle |
| Infra | Docker Compose + Nginx Proxy Manager (existing) | Linux server, 3 containers, no port conflicts |

---

## 3. Architecture

### 3.1 Network Topology

```
Users (Browser)
    ↕ HTTPS
Nginx Proxy Manager  (existing, handles SSL + domain routing)
    ↕ Docker internal network
┌─────────────────────────────────────────────┐
│  Docker Compose — Linux Server              │
│                                             │
│  web  (Next.js)   :4000                     │
│  ai   (Express)   :4001                     │
│  redis            :6380                     │
│                                             │
│  Volumes:                                   │
│    /data/db.sqlite  (SQLite)                │
│    /data/projects   (project files)         │
└─────────────────────────────────────────────┘
    ↕ HTTP over LAN (configurable base URL)
Your AI Machine (external, not in Docker)
    Ollama  :11434
    LM Studio :1234
```

All ports are configurable via `.env` (`WEB_PORT`, `AI_PORT`, `REDIS_PORT`). Nginx Proxy Manager routes `yourdomain.com` → `localhost:${WEB_PORT}`.

### 3.2 Monorepo Structure

```
/
├── web/          # Next.js 14 app (frontend + user API)
├── ai/           # Express AI orchestration service
├── shared/       # Shared TypeScript types, schemas, utils
├── docker-compose.yml
├── .env.example
└── package.json  # pnpm workspace root
```

### 3.3 Web Service (Next.js :4000)

Responsibilities:
- All UI pages and the builder workspace
- NextAuth.js session management
- Project CRUD API routes
- Stripe webhook handling
- Credit system (balance + transactions)
- Export / deployment triggers
- Proxies AI SSE streams from the AI service to the browser

### 3.4 AI Service (Express :4001)

Responsibilities:
- Provider abstraction layer (all LLM adapters)
- SSE streaming endpoint consumed by web service
- Code validation and auto-fix (up to 3 retries)
- Context/memory management per project
- BullMQ job queue for long-running tasks (export, full-page generation)
- Provider health checks

---

## 4. Data Model

### 4.1 Auth (NextAuth managed)

```
users
  id, email, name, image
  role: 'user' | 'admin'
  credits: integer          -- running balance
  plan: 'free' | 'pro' | 'enterprise'
  stripeCustomerId
  createdAt, updatedAt

accounts                    -- NextAuth OAuth accounts
sessions                    -- NextAuth sessions
```

### 4.2 Billing

```
subscriptions
  id, userId
  stripeSubscriptionId, stripePriceId
  status: 'active' | 'canceled' | 'past_due'
  currentPeriodEnd, cancelAtPeriodEnd

credit_transactions
  id, userId
  amount: integer           -- positive = credit, negative = debit
  type: 'purchase' | 'admin' | 'usage' | 'refund'
  description
  stripePaymentIntentId?
  createdAt

plans
  id, name, stripePriceId
  monthlyCredits, maxProjects, maxPages
  features: JSON
  isActive
```

### 4.3 Projects

```
projects
  id, userId
  name, slug, description
  theme: JSON               -- global theme tokens
  settings: JSON
  status: 'draft' | 'published'
  createdAt, updatedAt

pages
  id, projectId
  name, slug, order
  content: JSON             -- component tree (builder reads/writes this)
  seoTitle, seoDescription
  isHomePage
  updatedAt

project_history
  id, projectId
  snapshot: JSON            -- full project state (undo/redo source of truth)
  description
  createdBy (userId)
  createdAt
```

### 4.4 AI

```
chat_sessions
  id, projectId, userId
  messages: JSON            -- full message array
  provider, model
  creditsUsed
  updatedAt

ai_jobs
  id, userId, projectId
  type: 'generate' | 'edit' | 'export' | 'deploy'
  status: 'queued' | 'running' | 'done' | 'failed'
  input: JSON, output: JSON
  creditsCharged
  error?, createdAt

ai_provider_configs
  id
  scope: 'platform' | 'user'
  userId?                   -- null when scope = platform
  provider: 'ollama' | 'lmstudio' | 'openai' | 'claude' | 'gemini' | 'openrouter' | 'custom'
  displayName, baseUrl
  apiKey (AES-256 encrypted)
  model, isDefault, isActive
  allowedPlans: JSON        -- platform scope only, e.g. ['free','pro','enterprise']
  creditCostPerRequest: integer  -- 0 for local LLMs
```

---

## 5. AI Provider Layer

### 5.1 Adapter Interface

Every provider implements:

```typescript
interface AIAdapter {
  name: string
  isAvailable(): Promise<boolean>
  listModels(): Promise<Model[]>
  stream(req: AIRequest): AsyncGenerator<AIChunk>
  estimateCredits(req: AIRequest): number
}
```

### 5.2 Provider Adapters

| Adapter | Base URL | Auth | Notes |
|---|---|---|---|
| OllamaAdapter | Configurable (LAN) | None | Default platform provider; `/api/chat` streaming |
| LMStudioAdapter | Configurable (LAN) | None | OpenAI-compatible `/v1/chat/completions` |
| OpenAIAdapter | api.openai.com | apiKey | Official SDK; GPT-4o, o1 |
| ClaudeAdapter | api.anthropic.com | apiKey | Anthropic SDK; Sonnet, Opus |
| GeminiAdapter | generativelanguage.googleapis.com | apiKey | Google SDK |
| OpenRouterAdapter | openrouter.ai | apiKey | OpenAI-compat; 100+ models |

### 5.3 Two-Tier Provider Config

**Platform tier** (admin-managed):
- Admin adds providers with any base URL and optional API key
- Controls which plans can access each provider (`allowedPlans`)
- Sets credit cost per request (0 for local LLMs)
- Toggle on/off without deleting config
- Usage stats per provider

**User tier** (self-managed, optional):
- Users can add their own API keys (encrypted at rest)
- Always available regardless of plan
- Users without own keys fall through to platform providers

**Resolution order per request:**
1. User's explicitly selected provider
2. User's own provider configs (matched by type)
3. Platform providers available to user's plan
4. Failover / error if none available

### 5.4 Orchestrator Pipeline

Per AI request:
1. **Provider Resolver** — picks adapter per resolution order above
2. **Context Builder** — assembles system prompt from project state + page content + chat history
3. **Credit Gate** — checks balance before call; deducts after success; refunds on failure
4. **Adapter call** — streams response as SSE chunks
5. **Code Validator** — parses generated code; auto-fixes common errors; retries up to 3×
6. **Stream to client** — chunks forwarded via SSE: `text_delta`, `code_block`, `preview_update`, `credits_deducted`, `done`

---

## 6. UI Layout

**Chat-first** (Lovable/Bolt style):

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo | Project name | Preview size | Publish btn   │
├──────────────────┬──────────────────────────┬───────────────┤
│  AI Chat Panel   │   Live Preview (Sandpack) │  Style Panel  │
│  (left, ~300px)  │   (centre, flex)          │  (right,~240) │
│                  │                           │               │
│  Chat history    │   iframe sandbox          │  Typography   │
│  ─────────────   │   ───────────────────     │  Spacing      │
│  Prompt input    │   Layers tab | Code tab   │  Colors       │
│  Provider badge  │                           │  Layout       │
│  Credits left    │                           │  Animation    │
└──────────────────┴──────────────────────────┴───────────────┘
```

Left panel tabs: Chat | Pages | Components  
Centre tabs: Preview | Layers | Code  
Right panel tabs: Style | SEO | Settings  

---

## 7. Phase Map

### Phase 1 — Foundation (App Shell + Auth + Preview)
- pnpm monorepo scaffold (`web/`, `ai/`, `shared/`)
- Docker Compose: web:4000 + ai:4001 + redis:6380
- Next.js 14 app shell with chat-first layout (Tailwind + shadcn/ui)
- NextAuth.js (email/password + Google OAuth)
- Sandpack preview integration
- Basic Ollama connectivity (configurable base URL)
- Project CRUD (create, rename, delete)
- SQLite + Drizzle ORM schema (all tables)
- `.env.example` with all required vars

**Deliverable:** Working app shell — log in, create a project, see preview panel, send a message to Ollama.

### Phase 2 — AI Core (Chat + Provider Abstraction + Streaming)
- AI service (Express) with adapter interface
- All provider adapters: Ollama, LM Studio, OpenAI, Claude, Gemini, OpenRouter
- SSE streaming pipeline (ai → web → browser)
- Code validator + auto-fix (AST-level, up to 3 retries)
- Project context memory (page content + chat history in prompt)
- Admin UI: provider config (platform tier), base URL + API key management
- User UI: personal provider settings
- Two-tier provider resolution
- Credit gate (check → call → deduct/refund)

**Deliverable:** Chat with Ollama to generate a full landing page; streaming response renders live in Sandpack.

### Phase 3 — Billing (Credits + Stripe + Admin Panel)
- Credit ledger (`credit_transactions`, running balance on `users.credits`)
- Stripe Checkout integration (one-time credit purchase + subscriptions)
- Stripe webhook handler (payment success → credit grant)
- Admin-assigned credits (admin panel → top up any user manually)
- Plan management (free/pro/enterprise, feature gates)
- Admin panel: users list, credit management, provider stats, plan editor
- Rate limiting (per user, per minute/hour via Redis)
- Credit display in chat panel

**Deliverable:** Users can buy credits; admin can assign credits; usage deducted per AI call.

### Phase 4 — Visual Builder (Drag-and-Drop + Components)
- Layer panel (component tree, select/reorder/delete)
- Drag-and-drop section blocks
- Properties inspector (spacing, typography, color, border)
- Component registry: Navbar, Hero, Features, Pricing, Testimonials, Gallery, CTA, Forms, Dashboard widgets, Footer
- Theme engine: global color palette, typography presets, spacing tokens
- Desktop / tablet / mobile preview switcher
- Dark/light mode toggle for generated sites
- Page manager (add, rename, reorder, delete pages)

**Deliverable:** Users can visually edit any AI-generated page without touching the chat.

### Phase 5 — Advanced AI (Inline Edits + Suggestions)
- Click-to-edit: click any element in preview → AI prompt overlay
- Proactive suggestions: AI analyses page, surfaces UX/accessibility/SEO issues
- Undo/redo with project history snapshots
- Multi-page AI awareness (AI knows all pages in context)
- Animation generation (Framer Motion presets via AI)
- Mobile optimisation suggestions
- SEO metadata generation

**Deliverable:** AI acts as a co-pilot — suggests improvements unprompted, edits individual elements on click.

### Phase 6 — Export + Deployment
- Export ZIP (clean React 18 + Tailwind project, production-ready)
- GitHub push (OAuth, commit to repo)
- Vercel deploy (via Vercel API)
- Netlify deploy (via Netlify API)
- Docker export (Dockerfile + nginx config)
- BullMQ export jobs (async, progress via SSE)
- Replace Sandpack with custom Vite HMR runtime
- SEO metadata in exported HTML

**Deliverable:** One-click deploy to Vercel/Netlify or download a production-ready zip.

### Phase 7 — Polish + Advanced
- Framer Motion animation system
- Project template marketplace
- Custom domain management
- Advanced analytics (usage per user/project)
- Plugin system (extensible component registry)
- Performance optimisations (lazy loading, incremental rendering)

---

## 8. Security

- **Preview sandbox:** Sandpack runs in isolated iframe with `sandbox` attribute; no access to parent DOM or cookies
- **API key encryption:** AES-256-GCM with server-side `ENCRYPTION_SECRET` env var; keys never returned to client in plaintext
- **CSP headers:** Strict Content-Security-Policy on all Next.js responses
- **Rate limiting:** Redis-backed, per-user, per-minute and per-hour limits on AI endpoints
- **Credit gate:** Credits checked atomically before any AI call; refunded on failure
- **Auth:** All API routes protected by NextAuth session middleware; admin routes check `role === 'admin'`
- **No arbitrary server code execution:** AI generates React + Tailwind only; executed in sandboxed iframe, never on server

---

## 9. Environment Variables

```env
# Ports (defaults, override to avoid conflicts)
WEB_PORT=4000
AI_PORT=4001
REDIS_PORT=6380

# Auth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=

# Database
DATABASE_URL=file:/data/db.sqlite

# Encryption (for API keys at rest)
ENCRYPTION_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Default platform AI provider
OLLAMA_BASE_URL=http://192.168.x.x:11434
LMSTUDIO_BASE_URL=http://192.168.x.x:1234

# Optional cloud providers (platform defaults)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

---

## 10. Open Questions / Future Decisions

- **Collaboration:** Real-time multi-user editing (Phase 7+) — will require WebSockets and operational transforms or CRDTs. Out of scope for Phases 1–6.
- **Postgres migration:** When user base grows, run `drizzle-kit migrate` against a Postgres `DATABASE_URL`. No code changes required.
- **Custom Vite runtime (Phase 6):** Vite dev server runs as a child process inside the AI service; files written to `/data/projects/<id>/`; HMR pushes to iframe via WebSocket.
