# AI Fixes + Admin Model Selection + Seed Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix silent AI errors in chat, add model fetch + test-connection to admin provider panel, seed 5 starter templates on startup, and add project delete from the dashboard.

**Architecture:** Four independent change sets — (1) one-liner chat error display fix + stream route customInstructions fix, (2) two new admin-only proxy API routes + full AdminProvidersClient rewrite, (3) seedDefaultTemplates() added to seed.ts called from the NextAuth route, (4) delete button wired into DashboardClient against the existing DELETE API endpoint.

**Tech Stack:** Next.js 14 App Router, TypeScript, Drizzle ORM (SQLite), Zustand, Tailwind CSS, next-auth

---

## File Map

| File | Action |
|---|---|
| `web/src/app/api/ai/stream/route.ts` | Modify — forward `customInstructions` |
| `web/src/components/builder/ChatPanel.tsx` | Modify — show error events as chat messages |
| `web/src/app/api/providers/models/route.ts` | Create — admin proxy to AI service models endpoint |
| `web/src/app/api/providers/health/route.ts` | Create — admin proxy to AI service health endpoint |
| `web/src/app/admin/providers/AdminProvidersClient.tsx` | Rewrite — model dropdown, test button, better UX |
| `web/src/lib/seed.ts` | Modify — add `seedDefaultTemplates(userId)` |
| `web/src/app/api/auth/[...nextauth]/route.ts` | Modify — call seedDefaultTemplates at startup |
| `web/src/app/dashboard/DashboardClient.tsx` | Modify — add delete project button |

---

## Task 1: Delete Project from Dashboard

**Files:**
- Modify: `web/src/app/dashboard/DashboardClient.tsx`

The API route `DELETE /api/projects/[id]` already exists and returns 204. We just need the UI.

- [ ] **Step 1: Add deleteProject function and confirmation**

Open `web/src/app/dashboard/DashboardClient.tsx`. Add this function inside the component, after `createProject`:

```tsx
async function deleteProject(id: string, name: string) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
  await fetch(`/api/projects/${id}`, { method: 'DELETE' })
  setProjects(prev => prev.filter(p => p.id !== id))
}
```

- [ ] **Step 2: Add delete button to each project card**

Find the project card `<div>` inside the `.map()`. Replace it with a version that has a delete button in the top-right corner:

```tsx
{projects.map(project => (
  <div
    key={project.id}
    className="relative p-4 bg-card border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors group"
    onClick={() => router.push(`/builder/${project.id}`)}
  >
    <button
      onClick={e => { e.stopPropagation(); deleteProject(project.id, project.name) }}
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all text-xs px-1.5 py-0.5 rounded hover:bg-red-400/10"
      title="Delete project"
    >
      ✕
    </button>
    <h3 className="font-medium text-foreground pr-6">{project.name}</h3>
    <p className="text-xs text-muted-foreground mt-1">{project.status}</p>
  </div>
))}
```

- [ ] **Step 3: Manual verification**

Start the dev server (`pnpm dev` from repo root). Go to `/dashboard`. Hover over a project card — a small ✕ should appear in the top right. Click it — confirm dialog appears. Confirm — card disappears.

- [ ] **Step 4: Commit**

```bash
cd "I:/VS Code/Website_Bulder"
git add web/src/app/dashboard/DashboardClient.tsx
git commit -m "feat: delete project from dashboard card"
```

---

## Task 2: Fix AI Error Visibility + customInstructions Forwarding

**Files:**
- Modify: `web/src/app/api/ai/stream/route.ts`
- Modify: `web/src/components/builder/ChatPanel.tsx`

- [ ] **Step 1: Fix stream route to forward customInstructions**

Open `web/src/app/api/ai/stream/route.ts`. Find the body destructuring line:

```ts
const { projectId, message, provider: preferredProvider } = body
```

Replace it with:

```ts
const { projectId, message, provider: preferredProvider, customInstructions } = body
```

Then find the `aiRequest` object and add `customInstructions`:

```ts
const aiRequest = {
  projectId,
  message,
  history,
  providerConfig: {
    provider: resolved.provider,
    baseUrl: resolved.baseUrl,
    apiKey: resolved.apiKey,
    model: resolved.model,
  },
  projectContext,
  customInstructions,
}
```

- [ ] **Step 2: Fix ChatPanel to show error events**

Open `web/src/components/builder/ChatPanel.tsx`. Find this block inside the SSE loop:

```ts
} else if (event.type === 'error') {
  finalizeStreamingMessage()
}
```

Replace it with:

```ts
} else if (event.type === 'error') {
  addMessage({ role: 'assistant', content: `⚠️ ${event.message}`, timestamp: Date.now() })
  finalizeStreamingMessage()
}
```

- [ ] **Step 3: Manual verification**

With the dev server running, go to the builder on any project. Type a message and send. If the AI provider is unreachable, you should now see a red ⚠️ message in the chat instead of a disappearing spinner. (To force the error: temporarily set `OLLAMA_BASE_URL` to `http://localhost:9999` in `web/.env.local`, restart, send a message — expect `⚠️ Provider "ollama" is not reachable`.)

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/ai/stream/route.ts web/src/components/builder/ChatPanel.tsx
git commit -m "fix: show AI stream errors in chat + forward customInstructions"
```

---

## Task 3: Admin Proxy Routes (Models + Health)

**Files:**
- Create: `web/src/app/api/providers/models/route.ts`
- Create: `web/src/app/api/providers/health/route.ts`

Both routes require an admin session and proxy POST requests to the AI service.

- [ ] **Step 1: Create the models proxy route**

Create `web/src/app/api/providers/models/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const AI_INTERNAL_URL = process.env.AI_SERVICE_INTERNAL_URL ?? 'http://localhost:4001'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })

  try {
    const res = await fetch(`${AI_INTERNAL_URL}/api/providers/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ models: [] })
  }
}
```

- [ ] **Step 2: Create the health proxy route**

Create `web/src/app/api/providers/health/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const AI_INTERNAL_URL = process.env.AI_SERVICE_INTERNAL_URL ?? 'http://localhost:4001'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })

  try {
    const res = await fetch(`${AI_INTERNAL_URL}/api/providers/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ available: false })
  }
}
```

- [ ] **Step 3: Add routes to middleware matcher**

Open `web/src/middleware.ts`. The middleware currently doesn't protect `/api/providers/*`. These routes do their own session check, so no middleware change is needed — but verify the existing middleware matcher doesn't block them. Current matchers are fine (no `/api/providers` entry means they go through unprotected by middleware, which is fine since the route handlers check admin session themselves).

- [ ] **Step 4: Manual verification**

With both services running (`pnpm dev`), test via browser console or curl while logged in as admin:

```bash
# From browser console on the admin page:
fetch('/api/providers/models', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider: 'ollama', baseUrl: 'http://192.168.4.220:11434' })
}).then(r => r.json()).then(console.log)
# Expected: { models: [...] } or { models: [] } if Ollama unreachable
```

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/providers/models/route.ts web/src/app/api/providers/health/route.ts
git commit -m "feat: admin proxy routes for provider models + health check"
```

---

## Task 4: Rewrite AdminProvidersClient with Model Selection + Test Button

**Files:**
- Rewrite: `web/src/app/admin/providers/AdminProvidersClient.tsx`

This is a full replacement of the file. The key additions: provider-aware defaults, model fetch dropdown, test-connection button.

- [ ] **Step 1: Write the new AdminProvidersClient**

Replace the entire content of `web/src/app/admin/providers/AdminProvidersClient.tsx` with:

```tsx
'use client'
import { useEffect, useState } from 'react'

interface ProviderConfig {
  id: string
  provider: string
  displayName: string
  baseUrl: string | null
  model: string | null
  isDefault: boolean
  isActive: boolean
  allowedPlans: string
  creditCostPerRequest: number
}

interface Model {
  id: string
  name: string
}

const PROVIDERS = ['ollama', 'lmstudio', 'openai', 'claude', 'openrouter', 'custom'] as const
type ProviderType = typeof PROVIDERS[number]

// Hardcoded fallback model lists for providers that don't need live fetch
const STATIC_MODELS: Partial<Record<ProviderType, Model[]>> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  claude: [
    { id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
  ],
}

// Provider defaults when switching provider type
function getProviderDefaults(provider: ProviderType) {
  switch (provider) {
    case 'ollama': return { baseUrl: 'http://localhost:11434', needsKey: false }
    case 'lmstudio': return { baseUrl: 'http://localhost:1234', needsKey: false }
    case 'openai': return { baseUrl: '', needsKey: true }
    case 'claude': return { baseUrl: '', needsKey: true }
    case 'openrouter': return { baseUrl: '', needsKey: true }
    case 'custom': return { baseUrl: '', needsKey: false }
  }
}

const PROVIDER_COLORS: Record<string, string> = {
  ollama: 'bg-purple-500/20 text-purple-300',
  lmstudio: 'bg-blue-500/20 text-blue-300',
  openai: 'bg-green-500/20 text-green-300',
  claude: 'bg-orange-500/20 text-orange-300',
  openrouter: 'bg-pink-500/20 text-pink-300',
  custom: 'bg-gray-500/20 text-gray-300',
}

const emptyForm = {
  provider: 'ollama' as ProviderType,
  displayName: '',
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  model: '',
  isDefault: false,
  allowedPlans: ['free', 'pro', 'enterprise'],
  creditCostPerRequest: 0,
}

export default function AdminProvidersClient() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  async function load() {
    const res = await fetch('/api/admin/providers')
    const data = await res.json()
    setConfigs(data.configs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleProviderChange(provider: ProviderType) {
    const defaults = getProviderDefaults(provider)
    setForm(f => ({ ...f, provider, baseUrl: defaults.baseUrl, apiKey: '', model: '' }))
    setModels(STATIC_MODELS[provider] ?? [])
    setTestStatus('idle')
  }

  async function fetchModels() {
    setFetchingModels(true)
    try {
      const res = await fetch('/api/providers/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: form.provider, baseUrl: form.baseUrl || undefined, apiKey: form.apiKey || undefined }),
      })
      const data = await res.json()
      if (data.models?.length) {
        setModels(data.models)
      }
    } catch { /* ignore */ }
    setFetchingModels(false)
  }

  async function testConnection() {
    setTestStatus('testing')
    try {
      const res = await fetch('/api/providers/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: form.provider, baseUrl: form.baseUrl || undefined, apiKey: form.apiKey || undefined }),
      })
      const data = await res.json()
      setTestStatus(data.available ? 'ok' : 'fail')
    } catch {
      setTestStatus('fail')
    }
  }

  async function save() {
    setSaving(true)
    await fetch('/api/admin/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    setModels([])
    setTestStatus('idle')
    load()
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch(`/api/admin/providers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this provider?')) return
    await fetch(`/api/admin/providers/${id}`, { method: 'DELETE' })
    load()
  }

  const needsKey = getProviderDefaults(form.provider).needsKey
  const showBaseUrl = form.provider !== 'openai' && form.provider !== 'claude' && form.provider !== 'openrouter'
  const canFetchModels = form.provider === 'ollama' || form.provider === 'lmstudio' || form.provider === 'custom'

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Admin — AI Providers</h1>
        <button
          onClick={() => { setShowForm(!showForm); setModels(STATIC_MODELS['ollama'] ?? []); setTestStatus('idle') }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showForm ? 'Cancel' : '+ Add Provider'}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-5">
            <h2 className="text-lg font-semibold text-foreground">New Platform Provider</h2>

            {/* Provider + Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Provider</label>
                <select
                  value={form.provider}
                  onChange={e => handleProviderChange(e.target.value as ProviderType)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
                <input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. My Ollama (Local)"
                />
              </div>
            </div>

            {/* Base URL (not shown for hosted providers) */}
            {showBaseUrl && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Base URL</label>
                <input
                  value={form.baseUrl}
                  onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="http://192.168.x.x:11434"
                />
              </div>
            )}

            {/* API Key */}
            {needsKey && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">API Key</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="sk-..."
                />
              </div>
            )}

            {/* Model selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-foreground">Model</label>
                {canFetchModels && (
                  <button
                    type="button"
                    onClick={fetchModels}
                    disabled={fetchingModels}
                    className="text-xs text-primary hover:opacity-80 disabled:opacity-50 transition-opacity"
                  >
                    {fetchingModels ? 'Fetching…' : '↺ Fetch Models'}
                  </button>
                )}
              </div>
              {models.length > 0 ? (
                <select
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— select a model —</option>
                  {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              ) : (
                <input
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={canFetchModels ? 'Click ↺ Fetch Models or type manually' : 'e.g. gpt-4o'}
                />
              )}
            </div>

            {/* Credit cost + default */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Credits / request</label>
                <input
                  type="number"
                  min={0}
                  value={form.creditCostPerRequest}
                  onChange={e => setForm(f => ({ ...f, creditCostPerRequest: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                    className="rounded"
                  />
                  Set as platform default
                </label>
              </div>
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-3 pt-1">
              {/* Test connection */}
              <button
                type="button"
                onClick={testConnection}
                disabled={testStatus === 'testing' || !form.provider}
                className="px-3 py-2 bg-secondary border border-border text-foreground rounded-md text-sm hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
              </button>
              {testStatus === 'ok' && <span className="text-sm text-green-400">✓ Connected</span>}
              {testStatus === 'fail' && <span className="text-sm text-red-400">✗ Unreachable</span>}

              <div className="flex-1" />

              <button
                onClick={() => { setShowForm(false); setForm(emptyForm); setModels([]); setTestStatus('idle') }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.displayName || (needsKey && !form.apiKey)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save Provider'}
              </button>
            </div>
          </div>
        )}

        {/* Provider list */}
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : configs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No platform providers configured.</p>
        ) : (
          <div className="space-y-3">
            {configs.map(cfg => (
              <div key={cfg.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">{cfg.displayName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${PROVIDER_COLORS[cfg.provider] ?? 'bg-gray-500/20 text-gray-300'}`}>
                      {cfg.provider}
                    </span>
                    {cfg.isDefault && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">default</span>}
                    {!cfg.isActive && <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">inactive</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {cfg.model ? <span className="font-mono">{cfg.model}</span> : <span className="italic">no model set</span>}
                    {' · '}{cfg.creditCostPerRequest} credits/req
                  </div>
                  {cfg.baseUrl && <div className="text-xs text-muted-foreground truncate max-w-xs">{cfg.baseUrl}</div>}
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <button onClick={() => toggle(cfg.id, cfg.isActive)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {cfg.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => remove(cfg.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Go to `/admin/providers`. Click "+ Add Provider". Change provider to `openai` — API key field appears, base URL hides, model dropdown shows GPT models. Change to `ollama` — base URL shows, no API key, model shows a text input with a "↺ Fetch Models" button. Click "Test Connection" — shows ✓ or ✗. Click "Save Provider" — card appears in list with colored badge and model name.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/admin/providers/AdminProvidersClient.tsx
git commit -m "feat: admin provider panel with model fetch, test connection, and provider-aware form"
```

---

## Task 5: Seed Default Templates

**Files:**
- Modify: `web/src/lib/seed.ts`
- Modify: `web/src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Add seedDefaultTemplates to seed.ts**

Open `web/src/lib/seed.ts`. Replace the entire file with:

```ts
import { eq } from 'drizzle-orm'
import { db } from './db'
import { aiProviderConfigs, templates, users } from './schema'
import { generateId } from './utils'

export function seedDefaultProviders(): void {
  const existing = db.select().from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.scope, 'platform'))
    .get()

  if (existing) return

  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  const defaultModel = process.env.DEFAULT_MODEL ?? 'llama3.2'

  db.insert(aiProviderConfigs).values({
    id: generateId(),
    scope: 'platform',
    provider: 'ollama',
    displayName: 'Ollama (Local)',
    baseUrl: ollamaUrl,
    model: defaultModel,
    isDefault: true,
    isActive: true,
    allowedPlans: JSON.stringify(['free', 'pro', 'enterprise']),
    creditCostPerRequest: 0,
  }).run()
}

const SEED_TEMPLATES = [
  {
    name: 'Landing Page',
    description: 'Hero section with gradient background, features grid, and call-to-action',
    category: 'landing' as const,
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <span className="font-bold text-xl">Brand</span>
        <div className="flex gap-6 text-sm text-gray-400">
          {['Features','Pricing','Docs'].map(item => (
            <a key={item} href="#" className="hover:text-white transition-colors">{item}</a>
          ))}
        </div>
        <button className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-700">Get Started</button>
      </nav>
      <section className="text-center py-28 px-6 bg-gradient-to-b from-indigo-950 to-gray-950">
        <div className="inline-block bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full mb-6">Now in Beta</div>
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Build faster with AI</h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-10">The all-in-one platform to design, build, and launch your product in record time.</p>
        <div className="flex gap-4 justify-center">
          <button className="px-8 py-4 bg-indigo-600 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors">Start for free</button>
          <button className="px-8 py-4 border border-gray-700 rounded-xl font-semibold text-lg hover:border-gray-500 transition-colors">Watch demo →</button>
        </div>
      </section>
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16">Everything you need</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: '⚡', title: 'Lightning Fast', desc: 'Ship features in minutes, not weeks.' },
            { icon: '🔒', title: 'Secure by Default', desc: 'Enterprise-grade security out of the box.' },
            { icon: '📊', title: 'Built-in Analytics', desc: 'Understand your users from day one.' },
          ].map(f => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-xl mb-2">{f.title}</h3>
              <p className="text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="py-24 px-6 text-center bg-gradient-to-t from-indigo-950 to-gray-950">
        <h2 className="text-4xl font-bold mb-4">Ready to launch?</h2>
        <p className="text-gray-400 mb-8">Join 10,000+ teams building with us.</p>
        <button className="px-10 py-4 bg-white text-gray-950 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity">Get started free</button>
      </section>
    </div>
  )
}`,
  },
  {
    name: 'SaaS App',
    description: 'Navigation, hero with social proof, and a 3-tier pricing section',
    category: 'saas' as const,
    code: `export default function App() {
  const plans = [
    { name: 'Starter', price: '$9', features: ['5 projects', '10GB storage', 'Email support'], highlight: false },
    { name: 'Pro', price: '$29', features: ['Unlimited projects', '100GB storage', 'Priority support', 'Analytics'], highlight: true },
    { name: 'Enterprise', price: '$99', features: ['Everything in Pro', 'SSO', 'SLA', 'Dedicated manager'], highlight: false },
  ]
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="px-8 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <span className="font-black text-2xl tracking-tight">Acme<span className="text-indigo-400">.</span></span>
        <div className="hidden md:flex gap-8 text-sm text-gray-400">
          {['Product','Pricing','Blog','Careers'].map(i => <a key={i} href="#" className="hover:text-white">{i}</a>)}
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-sm text-gray-300 hover:text-white">Sign in</button>
          <button className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-700">Start free trial</button>
        </div>
      </nav>
      <section className="text-center pt-20 pb-16 px-6">
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1,2,3,4,5].map(s => <span key={s} className="text-yellow-400 text-lg">★</span>)}
          <span className="text-gray-400 text-sm ml-1">Loved by 3,000+ teams</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">The SaaS platform<br/><span className="text-indigo-400">that grows with you</span></h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-10">Automate your workflow, delight your customers, and scale without limits.</p>
        <button className="px-10 py-4 bg-indigo-600 rounded-2xl font-bold text-lg hover:bg-indigo-700">Start free — no credit card</button>
      </section>
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Simple pricing</h2>
        <p className="text-gray-400 text-center mb-12">Cancel anytime. No hidden fees.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div key={plan.name} className={\`rounded-2xl p-8 border \${plan.highlight ? 'bg-indigo-600 border-indigo-400 scale-105' : 'bg-gray-900 border-gray-800'}\`}>
              <h3 className="font-bold text-xl mb-1">{plan.name}</h3>
              <div className="text-4xl font-black mb-6">{plan.price}<span className="text-base font-normal opacity-60">/mo</span></div>
              <ul className="space-y-3 mb-8">{plan.features.map(f => <li key={f} className="flex items-center gap-2 text-sm"><span className="text-green-400">✓</span>{f}</li>)}</ul>
              <button className={\`w-full py-3 rounded-xl font-semibold \${plan.highlight ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}\`}>Get started</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}`,
  },
  {
    name: 'Portfolio',
    description: 'Personal portfolio with bio, skills, and project showcase grid',
    category: 'portfolio' as const,
    code: `export default function App() {
  const projects = [
    { title: 'E-commerce Platform', tag: 'React · Node', desc: 'Full-stack marketplace with payments and real-time inventory.' },
    { title: 'AI Dashboard', tag: 'Next.js · OpenAI', desc: 'Analytics platform powered by GPT for automated insights.' },
    { title: 'Mobile Banking App', tag: 'React Native', desc: 'Fintech app with biometric auth and instant transfers.' },
    { title: 'Design System', tag: 'Figma · Storybook', desc: 'Component library used by 50+ products across the org.' },
  ]
  const skills = ['React','Next.js','TypeScript','Node.js','PostgreSQL','AWS','Figma','Python']
  return (
    <div className="min-h-screen bg-gray-950 text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-6 mb-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-3xl font-black">A</div>
          <div>
            <h1 className="text-3xl font-bold">Alex Chen</h1>
            <p className="text-indigo-400 font-medium">Full-Stack Engineer & Designer</p>
            <p className="text-gray-400 text-sm mt-1">San Francisco, CA · Open to work</p>
          </div>
        </div>
        <p className="text-gray-300 text-lg leading-relaxed mb-10">
          I build products people love. 5+ years turning complex problems into clean, scalable software.
          Previously at Stripe, Vercel, and two startups I co-founded.
        </p>
        <div className="mb-12">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {skills.map(s => <span key={s} className="bg-gray-800 border border-gray-700 px-3 py-1 rounded-full text-sm text-gray-300">{s}</span>)}
          </div>
        </div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">Selected Work</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map(p => (
            <div key={p.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-indigo-500 transition-colors cursor-pointer">
              <div className="text-xs text-indigo-400 font-mono mb-2">{p.tag}</div>
              <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
              <p className="text-gray-400 text-sm">{p.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-6 text-sm text-gray-400">
          {['GitHub','LinkedIn','Twitter','Email'].map(l => <a key={l} href="#" className="hover:text-white transition-colors">{l}</a>)}
        </div>
      </div>
    </div>
  )
}`,
  },
  {
    name: 'E-commerce Store',
    description: 'Product grid with hero banner, category filters, and add-to-cart buttons',
    category: 'ecommerce' as const,
    code: `import { useState } from 'react'
export default function App() {
  const [cart, setCart] = useState(0)
  const [category, setCategory] = useState('All')
  const products = [
    { id: 1, name: 'Wireless Headphones', price: 129, category: 'Electronics', emoji: '🎧' },
    { id: 2, name: 'Running Shoes', price: 89, category: 'Fashion', emoji: '👟' },
    { id: 3, name: 'Coffee Maker', price: 79, category: 'Home', emoji: '☕' },
    { id: 4, name: 'Mechanical Keyboard', price: 149, category: 'Electronics', emoji: '⌨️' },
    { id: 5, name: 'Yoga Mat', price: 45, category: 'Sports', emoji: '🧘' },
    { id: 6, name: 'Leather Wallet', price: 55, category: 'Fashion', emoji: '👜' },
  ]
  const cats = ['All', 'Electronics', 'Fashion', 'Home', 'Sports']
  const filtered = category === 'All' ? products : products.filter(p => p.category === category)
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-black text-xl">ShopAI</span>
        <button className="relative px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium">
          🛒 Cart {cart > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{cart}</span>}
        </button>
      </header>
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-16 text-center">
        <h1 className="text-4xl font-black mb-3">Summer Sale — Up to 40% off</h1>
        <p className="text-indigo-200 mb-6">Free shipping on orders over $50</p>
        <button className="px-8 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:opacity-90">Shop now</button>
      </div>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {cats.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={\`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors \${category === c ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}\`}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col">
              <div className="bg-gray-50 rounded-xl aspect-square flex items-center justify-center text-5xl mb-4">{p.emoji}</div>
              <div className="text-xs text-gray-400 mb-1">{p.category}</div>
              <h3 className="font-semibold mb-2 flex-1">{p.name}</h3>
              <div className="flex items-center justify-between mt-2">
                <span className="font-bold text-lg">\${p.price}</span>
                <button onClick={() => setCart(c => c + 1)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}`,
  },
  {
    name: 'Admin Dashboard',
    description: 'Sidebar navigation, KPI stat cards, and a recent activity data table',
    category: 'dashboard' as const,
    code: `import { useState } from 'react'
export default function App() {
  const [active, setActive] = useState('Overview')
  const nav = ['Overview','Analytics','Users','Revenue','Settings']
  const stats = [
    { label: 'Monthly Revenue', value: '$48,290', change: '+12.5%', up: true },
    { label: 'Active Users', value: '12,430', change: '+8.2%', up: true },
    { label: 'Conversion Rate', value: '3.6%', change: '+0.4%', up: true },
    { label: 'Churn Rate', value: '1.2%', change: '-0.3%', up: false },
  ]
  const rows = [
    { user: 'Alice Johnson', action: 'Upgraded to Pro', time: '2m ago', status: 'success' },
    { user: 'Bob Smith', action: 'Submitted support ticket', time: '15m ago', status: 'warning' },
    { user: 'Carol White', action: 'New signup', time: '1h ago', status: 'success' },
    { user: 'Dan Brown', action: 'Payment failed', time: '2h ago', status: 'error' },
    { user: 'Eve Davis', action: 'Exported report', time: '3h ago', status: 'info' },
  ]
  const statusStyle: Record<string, string> = {
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
  }
  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 hidden md:flex shrink-0">
        <div className="font-black text-xl mb-8 px-2">Dash<span className="text-indigo-400">.</span></div>
        {nav.map(item => (
          <button key={item} onClick={() => setActive(item)}
            className={\`text-left px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors \${active === item ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'}\`}>
            {item}
          </button>
        ))}
        <div className="mt-auto pt-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">A</div>
            <div><div className="text-sm font-medium">Admin</div><div className="text-xs text-gray-500">admin@app.com</div></div>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">{active}</h1>
          <button className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-700">Export</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className="text-2xl font-bold mb-1">{s.value}</p>
              <p className={\`text-xs font-medium \${s.up ? 'text-green-400' : 'text-red-400'}\`}>{s.change} vs last month</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold">Recent Activity</h2>
            <span className="text-xs text-gray-400">{rows.length} events</span>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="text-left px-6 py-3">User</th>
              <th className="text-left px-6 py-3">Action</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-right px-6 py-3">Time</th>
            </tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                <td className="px-6 py-3 font-medium">{r.user}</td>
                <td className="px-6 py-3 text-gray-400">{r.action}</td>
                <td className="px-6 py-3"><span className={\`px-2 py-0.5 rounded-full text-xs font-medium \${statusStyle[r.status]}\`}>{r.status}</span></td>
                <td className="px-6 py-3 text-right text-gray-500">{r.time}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </main>
    </div>
  )
}`,
  },
]

export function seedDefaultTemplates(userId: string): void {
  // Check if any templates exist; skip if already seeded
  const existing = db.select({ id: templates.id }).from(templates).get()
  if (existing) return

  for (const t of SEED_TEMPLATES) {
    const pagesSnapshot = JSON.stringify([{
      name: 'Home',
      slug: 'index',
      content: t.code,
      isHomePage: true,
      order: 0,
    }])

    db.insert(templates).values({
      id: generateId(),
      name: t.name,
      description: t.description,
      category: t.category,
      previewCode: t.code,
      pagesSnapshot,
      createdBy: userId,
      isPublic: true,
      usageCount: 0,
    }).run()
  }
}
```

- [ ] **Step 2: Call seedDefaultTemplates from the NextAuth route**

Open `web/src/app/api/auth/[...nextauth]/route.ts`. Replace the file content with:

```ts
import '@/lib/migrate'
import { seedDefaultProviders, seedDefaultTemplates } from '@/lib/seed'
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

seedDefaultProviders()

// Seed starter templates using the first admin user as author.
// Safe to call every startup — seedDefaultTemplates is idempotent.
const firstAdmin = db.select({ id: users.id })
  .from(users)
  .where(eq(users.role, 'admin'))
  .get()
if (firstAdmin) {
  seedDefaultTemplates(firstAdmin.id)
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 3: Manual verification**

Stop the dev server. Delete the SQLite database to simulate a fresh install:

```bash
# Windows PowerShell
Remove-Item "I:\VS Code\Website_Bulder\web\data\db.sqlite" -ErrorAction SilentlyContinue
```

Start the dev server (`pnpm dev`). Register a new user, make them admin via the DB or the admin panel. Stop + restart the server (so the startup code runs with an admin user present). Go to `/dashboard` → click "Browse Templates". You should now see 5 templates: Landing Page, SaaS App, Portfolio, E-commerce Store, Admin Dashboard.

If you don't want to wipe the DB: open `/api/auth/session` in the browser after logging in as admin, then stop+restart — the next server start will call `seedDefaultTemplates` with your admin user id and insert the 5 templates.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/seed.ts web/src/app/api/auth/[...nextauth]/route.ts
git commit -m "feat: seed 5 starter templates on startup (landing, saas, portfolio, ecommerce, dashboard)"
```

---

## Self-Review

**Spec coverage check:**
- ✅ AI error visibility — Task 2 (ChatPanel error branch + stream route customInstructions)
- ✅ Admin model selection + fetch — Task 4 (AdminProvidersClient rewrite with model dropdown + fetch button)
- ✅ OpenAI/Claude in admin panel — Task 4 (STATIC_MODELS, provider-aware defaults, API key field)
- ✅ Test connection button — Task 4 (testConnection + health proxy)
- ✅ Proxy routes — Task 3 (models + health routes)
- ✅ Seed templates — Task 5 (seedDefaultTemplates in seed.ts)
- ✅ Delete project — Task 1 (dashboard card + deleteProject function)

**Placeholder scan:** No TBDs, no "similar to above", all code blocks complete.

**Type consistency:**
- `seedDefaultTemplates(userId: string)` defined in Task 5 Step 1, called in Task 5 Step 2 ✅
- `Model` interface `{ id, name }` matches what `/api/providers/models` returns (same shape as `AIAdapter.listModels()`) ✅
- `ProviderType` used throughout Task 4 consistently ✅
- `deleteProject(id, name)` defined and called in same task ✅
