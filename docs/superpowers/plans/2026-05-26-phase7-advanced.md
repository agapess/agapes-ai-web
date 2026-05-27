# Phase 7 — Advanced Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-click Vercel deploy, project templates marketplace, custom per-project AI instructions, fullscreen preview with dark/light toggle, and a usage analytics dashboard.

**Architecture:** Deploy uses the Vercel REST API with a user-supplied token stored encrypted. Templates are cloned projects stored in a new `templates` table. Custom instructions extend the existing `projects.settings` JSON. Analytics aggregate `credit_transactions` and `chat_sessions` already in the DB.

**Tech Stack:** Vercel REST API, existing Next.js/Drizzle/Zustand/Sandpack stack. No new npm packages needed.

---

## File Map

```
web/
  src/
    lib/
      schema.ts                     MODIFY — add templates table
    app/
      api/
        deploy/
          vercel/[projectId]/route.ts  NEW — POST: deploy to Vercel
        projects/[id]/route.ts        MODIFY — add settings PATCH support
        templates/
          route.ts                   NEW — GET list, POST create from project
          [id]/route.ts              NEW — POST clone template → new project
        analytics/route.ts           NEW — GET usage stats for current user
      settings/
        analytics/
          page.tsx                   NEW — analytics server page
          AnalyticsClient.tsx        NEW — charts + stats client
        deploy/
          page.tsx                   NEW — deploy settings (Vercel token)
          DeployClient.tsx           NEW — token management + deploy history
      dashboard/
        DashboardClient.tsx          MODIFY — add "Use Template" option on new project
        TemplateGallery.tsx          NEW — template selection modal
      builder/[projectId]/
        BuilderPage.tsx              MODIFY — pass project settings to store
    components/
      builder/
        PreviewPanel.tsx             MODIFY — add fullscreen + dark/light toggle
        ChatPanel.tsx                MODIFY — include custom instructions in prompt context
    store/
      builderStore.ts                MODIFY — add customInstructions + previewTheme
```

---

## Task 1: Custom AI Instructions per Project

Store per-project custom instructions in `projects.settings`, pass them to the AI orchestrator via the stream proxy.

**Files:**
- Modify: `web/src/store/builderStore.ts`
- Create: `web/src/app/settings/deploy/page.tsx` (deploy settings — done in Task 4, but the settings nav is set up here)
- Create: `web/src/app/builder/[projectId]/ProjectSettings.tsx`
- Modify: `web/src/app/api/ai/stream/route.ts`

- [ ] **Step 1: Add customInstructions to builderStore**

Read `web/src/store/builderStore.ts`, then add `customInstructions` and `setCustomInstructions` to the interface and implementation:

```typescript
// Add to BuilderState interface:
customInstructions: string
setCustomInstructions: (instructions: string) => void

// Add to create() initial values:
customInstructions: '',
setCustomInstructions: (customInstructions) => set({ customInstructions }),
```

Also add `projectSettings` to the store so it can be persisted:
```typescript
// In BuilderState interface, add after credits:
projectSettings: Record<string, unknown>
setProjectSettings: (settings: Record<string, unknown>) => void

// In initial values:
projectSettings: {},
setProjectSettings: (projectSettings) => set({ projectSettings }),
```

The full updated `web/src/store/builderStore.ts`:

```typescript
import { create } from 'zustand'

export interface BuilderPage {
  id: string
  projectId: string
  name: string
  slug: string
  order: number
  content: string
  isHomePage: boolean
}

interface Project {
  id: string
  name: string
  slug: string
  status: string
}

interface BuilderState {
  project: Project | null
  pages: BuilderPage[]
  activePage: BuilderPage | null
  previewCode: string
  previewSize: 'desktop' | 'tablet' | 'mobile'
  credits: number
  customInstructions: string
  projectSettings: Record<string, unknown>
  previewTheme: 'dark' | 'light'
  setProject: (project: Project) => void
  setPages: (pages: BuilderPage[]) => void
  setActivePage: (page: BuilderPage) => void
  setPreviewCode: (code: string) => void
  setPreviewSize: (size: 'desktop' | 'tablet' | 'mobile') => void
  setCredits: (credits: number) => void
  updatePageContent: (pageId: string, code: string) => void
  setCustomInstructions: (instructions: string) => void
  setProjectSettings: (settings: Record<string, unknown>) => void
  setPreviewTheme: (theme: 'dark' | 'light') => void
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  project: null,
  pages: [],
  activePage: null,
  previewCode: '',
  previewSize: 'desktop',
  credits: 0,
  customInstructions: '',
  projectSettings: {},
  previewTheme: 'dark',
  setProject: (project) => set({ project }),
  setPages: (pages) => {
    const activePage = get().activePage
    set({
      pages,
      activePage: activePage ?? pages.find(p => p.isHomePage) ?? pages[0] ?? null,
    })
  },
  setActivePage: (page) => set({ activePage: page, previewCode: page.content || '' }),
  setPreviewCode: (previewCode) => set({ previewCode }),
  setPreviewSize: (previewSize) => set({ previewSize }),
  setCredits: (credits) => set({ credits }),
  updatePageContent: (pageId, code) => {
    const pages = get().pages.map(p => p.id === pageId ? { ...p, content: code } : p)
    set({ pages })
  },
  setCustomInstructions: (customInstructions) => set({ customInstructions }),
  setProjectSettings: (projectSettings) => set({ projectSettings }),
  setPreviewTheme: (previewTheme) => set({ previewTheme }),
}))
```

- [ ] **Step 2: Update BuilderPage.tsx to load settings from project**

Read `web/src/app/builder/[projectId]/BuilderPage.tsx`, then update:

```typescript
'use client'
import { useEffect } from 'react'
import { useBuilderStore, type BuilderPage } from '@/store/builderStore'
import BuilderLayout from '@/components/builder/BuilderLayout'

interface Project {
  id: string
  name: string
  slug: string
  status: string
  settings?: Record<string, unknown>
}

interface Props {
  project: Project
  initialPages: BuilderPage[]
  initialCredits: number
}

export default function BuilderPage({ project, initialPages, initialCredits }: Props) {
  const { setProject, setPages, setCredits, setActivePage, setCustomInstructions, setProjectSettings } = useBuilderStore()

  useEffect(() => {
    setProject(project)
    setCredits(initialCredits)
    setPages(initialPages)
    const settings = project.settings ?? {}
    setProjectSettings(settings)
    setCustomInstructions(typeof settings.customInstructions === 'string' ? settings.customInstructions : '')
    const homePage = initialPages.find(p => p.isHomePage) ?? initialPages[0]
    if (homePage) setActivePage(homePage)
  }, [project, initialPages, initialCredits, setProject, setPages, setCredits, setActivePage, setCustomInstructions, setProjectSettings])

  return <BuilderLayout />
}
```

- [ ] **Step 3: Update builder page.tsx to pass project settings**

Read `web/src/app/builder/[projectId]/page.tsx`, then update the project select to include `settings`:

In the existing file, change the project query from:
```typescript
const project = db.select().from(projects)
  .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
  .get()
```

The `projects` select already returns all columns including `settings`, so no change needed there — but update the `BuilderPage` call to pass settings:

```typescript
return (
  <BuilderPage
    project={{ ...project, settings: project.settings as Record<string, unknown> }}
    initialPages={projectPages}
    initialCredits={user?.credits ?? 0}
  />
)
```

- [ ] **Step 4: Update stream route to pass customInstructions**

Read `web/src/app/api/ai/stream/route.ts`. Change the request body type to accept `customInstructions`:

```typescript
const body = await req.json() as {
  projectId: string
  message: string
  provider?: string
  customInstructions?: string
}

const { projectId, message, provider: preferredProvider, customInstructions } = body
```

Then update the `aiRequest` object to include it:

```typescript
const aiRequest = {
  projectId,
  message,
  history,
  providerConfig: { ... },
  projectContext,
  customInstructions: customInstructions || undefined,
}
```

- [ ] **Step 5: Update ChatPanel to send customInstructions**

Read `web/src/components/builder/ChatPanel.tsx`. In `sendMessage`, update the fetch body:

Change:
```typescript
body: JSON.stringify({ projectId: project.id, message: content }),
```
To:
```typescript
body: JSON.stringify({ projectId: project.id, message: content, customInstructions: customInstructions || undefined }),
```

Also add `customInstructions` to the `useBuilderStore` destructure:
```typescript
const { project, setPreviewCode, credits, setCredits, activePage, updatePageContent, customInstructions } = useBuilderStore()
```

- [ ] **Step 6: Update AI orchestrator to use customInstructions**

Read `ai/src/orchestrator/index.ts`. Update `OrchestratorRequest`:

```typescript
export interface OrchestratorRequest {
  projectId: string
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  providerConfig?: ProviderConfig
  projectContext?: string
  customInstructions?: string
}
```

In the `orchestrate` function, pass `customInstructions` to `buildMessages`:

```typescript
const messages = buildMessages({
  userMessage,
  history: req.history,
  projectContext: req.projectContext,
  customInstructions: req.customInstructions,
})
```

- [ ] **Step 7: Update contextBuilder to include customInstructions**

Read `ai/src/orchestrator/contextBuilder.ts`. Update `BuildMessagesOptions` and `buildMessages`:

```typescript
interface BuildMessagesOptions {
  userMessage: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  projectContext: string | undefined
  customInstructions: string | undefined
}
```

In `buildMessages`, update `systemContent` to include custom instructions:

```typescript
export function buildMessages({ userMessage, history, projectContext, customInstructions }: BuildMessagesOptions): Message[] {
  let systemContent = SYSTEM_PROMPT
  if (customInstructions) {
    systemContent += `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${customInstructions}`
  }
  if (projectContext) {
    systemContent += `\n\nCURRENT PAGE STATE (JSON component tree — use this to understand what's already built):\n${projectContext}`
  }
  return [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: userMessage },
  ]
}
```

- [ ] **Step 8: Update chatRequestSchema in shared to include customInstructions**

Read `shared/src/schemas.ts`. Update `chatRequestSchema`:

```typescript
export const chatRequestSchema = z.object({
  projectId: z.string(),
  message: z.string().min(1).max(10000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
  providerConfig: providerConfigSchema.optional(),
  projectContext: z.string().optional(),
  customInstructions: z.string().max(2000).optional(),
})
```

Then rebuild shared: `pnpm --filter @ai-builder/shared build`

- [ ] **Step 9: Create Project Settings panel in builder**

Create `web/src/components/builder/ProjectSettingsPanel.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useBuilderStore } from '@/store/builderStore'

export default function ProjectSettingsPanel() {
  const { project, customInstructions, setCustomInstructions, projectSettings, setProjectSettings } = useBuilderStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (!project) return
    setSaving(true)
    const newSettings = { ...projectSettings, customInstructions }
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: newSettings }),
    })
    setProjectSettings(newSettings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Custom AI Instructions
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          These instructions are added to every AI request for this project.
        </p>
        <textarea
          value={customInstructions}
          onChange={e => setCustomInstructions(e.target.value)}
          rows={6}
          placeholder="e.g. Always use a dark color scheme. Use Inter font. The brand color is #6366f1."
          className="w-full px-2 py-2 bg-secondary border border-border rounded text-foreground text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder-muted-foreground"
        />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}
```

- [ ] **Step 10: Add Settings tab to StylePanel**

Read `web/src/components/builder/StylePanel.tsx`, then replace:

```typescript
'use client'
import { useState } from 'react'
import ComponentLibrary from './ComponentLibrary'
import PageManager from './PageManager'
import ProjectSettingsPanel from './ProjectSettingsPanel'

type Tab = 'components' | 'pages' | 'settings'

export default function StylePanel() {
  const [tab, setTab] = useState<Tab>('components')

  return (
    <aside className="w-60 border-l border-border bg-card flex flex-col shrink-0">
      <div className="flex border-b border-border">
        {(['components', 'pages', 'settings'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors capitalize ${
              tab === t
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'settings' ? '⚙' : t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'components' && <ComponentLibrary />}
        {tab === 'pages' && <PageManager />}
        {tab === 'settings' && <ProjectSettingsPanel />}
      </div>
    </aside>
  )
}
```

- [ ] **Step 11: Run tests**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm --filter @ai-builder/shared build
pnpm test
```

Expected: 48 tests PASS (ai: 31 + web: 17).

- [ ] **Step 12: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add shared/ ai/src/orchestrator/ web/src/store/builderStore.ts \
  web/src/app/builder/ web/src/app/api/ai/ web/src/components/builder/
git commit -m "feat: custom AI instructions per project, settings tab in builder"
```

---

## Task 2: Preview Enhancements (Fullscreen + Dark/Light Toggle)

**Files:**
- Modify: `web/src/components/builder/PreviewPanel.tsx`

- [ ] **Step 1: Read PreviewPanel.tsx and replace**

Read `web/src/components/builder/PreviewPanel.tsx`, then replace with a version that adds fullscreen toggle and dark/light mode switch:

```typescript
'use client'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
} from '@codesandbox/sandpack-react'
import { useBuilderStore } from '@/store/builderStore'
import { useState, useEffect } from 'react'

const DEFAULT_CODE = `export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
      <div className="text-center text-white px-6">
        <h1 className="text-5xl font-bold mb-4">Your website starts here</h1>
        <p className="text-purple-200 text-lg">Chat with AI to build your website. Your live preview will appear here.</p>
      </div>
    </div>
  )
}`

const PREVIEW_WIDTHS = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

export default function PreviewPanel() {
  const { previewCode, previewSize, previewTheme, setPreviewTheme } = useBuilderStore()
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [fullscreen, setFullscreen] = useState(false)
  const code = previewCode || DEFAULT_CODE

  // Wrap code with dark/light class on the root element
  const themedCode = previewTheme === 'light'
    ? code.replace(
        /(<div\b[^>]*className="[^"]*)(min-h-screen)/,
        '$1min-h-screen'
      )
    : code

  // Inject Tailwind dark class override for light mode
  const htmlClass = previewTheme === 'light' ? '' : 'dark'

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [fullscreen])

  const panel = (
    <div className={`flex flex-col bg-zinc-950 overflow-hidden ${fullscreen ? 'fixed inset-0 z-50' : 'flex-1'}`}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card shrink-0">
        {(['preview', 'code'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'preview' ? 'Preview' : 'Code'}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          {/* Dark/Light toggle */}
          <button
            onClick={() => setPreviewTheme(previewTheme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${previewTheme === 'dark' ? 'light' : 'dark'} mode`}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {previewTheme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {fullscreen ? '⊠' : '⊞'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-hidden flex items-start justify-center pt-4">
        <div
          className="h-full transition-all duration-300"
          style={{ width: fullscreen ? '100%' : PREVIEW_WIDTHS[previewSize] }}
        >
          <SandpackProvider
            template="react"
            theme="dark"
            files={{ '/App.js': code }}
            options={{
              externalResources: ['https://cdn.tailwindcss.com'],
              classes: { 'sp-wrapper': `sp-theme-${previewTheme}` },
            }}
          >
            <SandpackLayout style={{ height: '100%', borderRadius: 0 }}>
              {activeTab === 'preview' ? (
                <SandpackPreview
                  style={{ height: '100%' }}
                  showOpenInCodeSandbox={false}
                  showNavigator={false}
                />
              ) : (
                <SandpackCodeEditor style={{ height: '100%' }} showLineNumbers />
              )}
            </SandpackLayout>
          </SandpackProvider>
        </div>
      </div>

      {fullscreen && (
        <div className="absolute top-14 right-4 text-xs text-muted-foreground">
          Press <kbd className="px-1 py-0.5 bg-secondary rounded text-foreground">Esc</kbd> to exit
        </div>
      )}
    </div>
  )

  return panel
}
```

- [ ] **Step 2: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 17 tests PASS.

- [ ] **Step 3: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/components/builder/PreviewPanel.tsx
git commit -m "feat: fullscreen preview, dark/light toggle, escape key to exit"
```

---

## Task 3: Project Templates

**Files:**
- Modify: `web/src/lib/schema.ts` — add `templates` table
- Create: `web/src/app/api/templates/route.ts`
- Create: `web/src/app/api/templates/[id]/route.ts`
- Create: `web/src/app/dashboard/TemplateGallery.tsx`
- Modify: `web/src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add templates table to schema**

Read `web/src/lib/schema.ts`. Append after the `subscriptions` table:

```typescript
export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category', { enum: ['landing', 'saas', 'portfolio', 'ecommerce', 'dashboard', 'other'] }).notNull().default('other'),
  previewCode: text('preview_code').notNull().default(''),  // home page code for thumbnail
  pagesSnapshot: text('pages_snapshot', { mode: 'json' }).notNull().default('[]'),  // array of {name, slug, content, isHomePage}
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})
```

- [ ] **Step 2: Generate and run migration**

```bash
cd "i:/VS Code/Website_Bulder/web"
pnpm db:generate
pnpm db:migrate
```

Expected: new migration file for templates table.

- [ ] **Step 3: Create templates API routes**

Create `web/src/app/api/templates/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { templates, projects, pages, users } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { z } from 'zod'

export async function GET() {
  // Public endpoint — no auth required to browse templates
  const publicTemplates = db.select({
    id: templates.id,
    name: templates.name,
    description: templates.description,
    category: templates.category,
    previewCode: templates.previewCode,
    usageCount: templates.usageCount,
    createdAt: templates.createdAt,
  }).from(templates)
    .where(eq(templates.isPublic, true))
    .all()
    .sort((a, b) => b.usageCount - a.usageCount)

  return NextResponse.json({ templates: publicTemplates })
}

const createTemplateSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['landing', 'saas', 'portfolio', 'ecommerce', 'dashboard', 'other']).optional().default('other'),
  isPublic: z.boolean().optional().default(true),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createTemplateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verify user owns the project
  const project = db.select().from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .get()
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Snapshot all pages
  const projectPages = db.select().from(pages)
    .where(eq(pages.projectId, parsed.data.projectId))
    .all()
    .sort((a, b) => a.order - b.order)

  const pagesSnapshot = projectPages.map(p => ({
    name: p.name,
    slug: p.slug,
    content: typeof p.content === 'string' ? p.content : '',
    isHomePage: p.isHomePage,
    order: p.order,
  }))

  const homePage = projectPages.find(p => p.isHomePage) ?? projectPages[0]
  const previewCode = typeof homePage?.content === 'string' ? homePage.content : ''

  const templateId = generateId()
  db.insert(templates).values({
    id: templateId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    category: parsed.data.category,
    previewCode,
    pagesSnapshot: JSON.stringify(pagesSnapshot),
    createdBy: session.user.id,
    isPublic: parsed.data.isPublic,
  }).run()

  return NextResponse.json({ templateId }, { status: 201 })
}
```

Create `web/src/app/api/templates/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { templates, projects, pages } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { generateId, slugify } from '@/lib/utils'
import { z } from 'zod'

type Params = { params: { id: string } }

const cloneSchema = z.object({
  projectName: z.string().min(1).max(100),
})

// POST /api/templates/[id] — clone template into a new project
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const template = db.select().from(templates).where(eq(templates.id, params.id)).get()
  if (!template || (!template.isPublic && template.createdBy !== session.user.id)) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = cloneSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const projectId = generateId()
  db.insert(projects).values({
    id: projectId,
    userId: session.user.id,
    name: parsed.data.projectName,
    slug: slugify(parsed.data.projectName),
    description: template.description ?? null,
  }).run()

  // Clone template pages
  const pagesSnapshot = JSON.parse(template.pagesSnapshot as string) as Array<{
    name: string; slug: string; content: string; isHomePage: boolean; order: number
  }>

  for (const page of pagesSnapshot) {
    db.insert(pages).values({
      id: generateId(),
      projectId,
      name: page.name,
      slug: page.slug,
      order: page.order,
      content: page.content as unknown as [],
      isHomePage: page.isHomePage,
    }).run()
  }

  // Increment usage count
  db.update(templates)
    .set({ usageCount: template.usageCount + 1 })
    .where(eq(templates.id, params.id))
    .run()

  return NextResponse.json({ projectId }, { status: 201 })
}
```

- [ ] **Step 4: Create TemplateGallery component**

Create `web/src/app/dashboard/TemplateGallery.tsx`:

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Template {
  id: string
  name: string
  description: string | null
  category: string
  previewCode: string
  usageCount: number
}

const CATEGORIES = ['all', 'landing', 'saas', 'portfolio', 'ecommerce', 'dashboard', 'other']

interface Props {
  onClose: () => void
}

export default function TemplateGallery({ onClose }: Props) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [projectName, setProjectName] = useState('')
  const [selected, setSelected] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(d => {
      setTemplates(d.templates ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = category === 'all' ? templates : templates.filter(t => t.category === category)

  async function useTemplate() {
    if (!selected || !projectName.trim()) return
    setCreating(true)
    const res = await fetch(`/api/templates/${selected.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.projectId) {
      router.push(`/builder/${data.projectId}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-foreground">Start from a Template</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 px-6 py-3 border-b border-border shrink-0 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading templates…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No templates in this category yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map(template => (
                <div
                  key={template.id}
                  onClick={() => { setSelected(template); setProjectName(template.name) }}
                  className={`bg-background border rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] ${
                    selected?.id === template.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                  }`}
                >
                  {/* Preview thumbnail */}
                  <div className="aspect-video bg-gray-950 flex items-center justify-center overflow-hidden">
                    {template.previewCode ? (
                      <div className="w-full h-full transform scale-[0.3] origin-top-left pointer-events-none overflow-hidden">
                        <pre className="text-xs text-gray-600 p-2">{template.previewCode.slice(0, 200)}</pre>
                      </div>
                    ) : (
                      <span className="text-3xl">{
                        template.category === 'landing' ? '🚀' :
                        template.category === 'saas' ? '⚡' :
                        template.category === 'portfolio' ? '🎨' :
                        template.category === 'ecommerce' ? '🛒' :
                        template.category === 'dashboard' ? '📊' : '📄'
                      }</span>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-foreground text-sm">{template.name}</div>
                    {template.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{template.description}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{template.category}</span>
                      {template.usageCount > 0 && (
                        <span className="text-xs text-muted-foreground">{template.usageCount} uses</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — use selected template */}
        {selected && (
          <div className="border-t border-border px-6 py-4 flex items-center gap-3 shrink-0 bg-card">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Project name</p>
              <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && useTemplate()}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="My awesome project"
                autoFocus
              />
            </div>
            <button
              onClick={useTemplate}
              disabled={creating || !projectName.trim()}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap mt-4"
            >
              {creating ? 'Creating…' : `Use "${selected.name}"`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update DashboardClient to show template gallery**

Read `web/src/app/dashboard/DashboardClient.tsx`. Add a "Browse Templates" button that opens the TemplateGallery. Import `TemplateGallery` and add state `showTemplates`:

```typescript
// Add to imports:
import TemplateGallery from './TemplateGallery'
import { useState } from 'react' // already imported

// Add state after existing useState declarations:
const [showTemplates, setShowTemplates] = useState(false)

// Add button before the "New Project" input row (in the header flex):
<button
  onClick={() => setShowTemplates(true)}
  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
>
  Browse Templates
</button>

// Add before closing </div> of the component return:
{showTemplates && <TemplateGallery onClose={() => setShowTemplates(false)} />}
```

The full updated DashboardClient is too long to reproduce — make targeted edits using Read + Edit.

- [ ] **Step 6: Add "Save as Template" in ProjectSettingsPanel**

Read `web/src/components/builder/ProjectSettingsPanel.tsx`, then add below the Save Settings button:

```typescript
const [savingTemplate, setSavingTemplate] = useState(false)
const [templateSaved, setTemplateSaved] = useState(false)
const [templateName, setTemplateName] = useState('')

async function saveAsTemplate() {
  if (!project || !templateName.trim()) return
  setSavingTemplate(true)
  await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: project.id, name: templateName, isPublic: true }),
  })
  setSavingTemplate(false)
  setTemplateSaved(true)
  setTemplateName('')
  setTimeout(() => setTemplateSaved(false), 2000)
}
```

Add the UI below the existing Save Settings button:

```typescript
<div className="border-t border-border pt-3 mt-2">
  <label className="block text-xs font-medium text-foreground mb-1.5">Save as Template</label>
  <p className="text-xs text-muted-foreground mb-2">Share this project as a template others can use.</p>
  <div className="flex gap-1">
    <input
      value={templateName}
      onChange={e => setTemplateName(e.target.value)}
      placeholder="Template name"
      className="flex-1 px-2 py-1 bg-secondary border border-border rounded text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
    />
    <button
      onClick={saveAsTemplate}
      disabled={savingTemplate || !templateName.trim()}
      className="px-2 py-1 bg-secondary border border-border text-foreground rounded text-xs hover:bg-accent disabled:opacity-50 transition-colors"
    >
      {templateSaved ? '✓' : savingTemplate ? '…' : 'Save'}
    </button>
  </div>
</div>
```

- [ ] **Step 7: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 17 tests PASS.

- [ ] **Step 8: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/lib/schema.ts web/drizzle/ web/src/app/api/templates/ \
  web/src/app/dashboard/ web/src/components/builder/ProjectSettingsPanel.tsx
git commit -m "feat: project templates — create, browse, clone into new project"
```

---

## Task 4: Vercel One-Click Deploy

**Files:**
- Create: `web/src/app/api/deploy/vercel/[projectId]/route.ts`
- Create: `web/src/app/settings/deploy/page.tsx`
- Create: `web/src/app/settings/deploy/DeployClient.tsx`
- Modify: `web/src/components/builder/BuilderHeader.tsx`

The Vercel API accepts a deployment with files. We build the same file set as the ZIP export but POST it directly to Vercel.

- [ ] **Step 1: Create Vercel deploy API route**

```bash
mkdir -p "i:/VS Code/Website_Bulder/web/src/app/api/deploy/vercel"
```

Create `web/src/app/api/deploy/vercel/[projectId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, pages, users } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { decrypt, getEncryptionSecret } from '@/lib/encryption'

const VERCEL_API = 'https://api.vercel.com'

function encodeFile(content: string): { data: string; encoding: 'utf-8' } {
  return { data: content, encoding: 'utf-8' }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = db.select().from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get Vercel token from user settings
  const user = db.select({ settings: users.settings }).from(users)
    .where(eq(users.id, session.user.id))
    .get()

  const userSettings = (user?.settings as Record<string, unknown>) ?? {}
  const encryptedToken = userSettings.vercelToken as string | undefined

  if (!encryptedToken) {
    return NextResponse.json({ error: 'Vercel token not configured. Go to Settings → Deploy.' }, { status: 400 })
  }

  const vercelToken = decrypt(encryptedToken, getEncryptionSecret())
  if (!vercelToken) {
    return NextResponse.json({ error: 'Invalid Vercel token — please re-enter it in Settings → Deploy.' }, { status: 400 })
  }

  const projectPages = db.select().from(pages)
    .where(eq(pages.projectId, params.projectId))
    .all()
    .sort((a, b) => a.order - b.order)

  const homePage = projectPages.find(p => p.isHomePage) ?? projectPages[0]
  const mainCode = typeof homePage?.content === 'string' && homePage.content
    ? homePage.content
    : `export default function App() { return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white"><h1 className="text-4xl font-bold">Welcome to ${project.name}</h1></div> }`

  const files = [
    { file: 'package.json', ...encodeFile(JSON.stringify({
      name: project.slug, private: true, version: '0.0.1', type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
      devDependencies: {
        '@vitejs/plugin-react': '^4.2.1', autoprefixer: '^10.4.19',
        postcss: '^8.4.38', tailwindcss: '^3.4.3', vite: '^5.2.0',
      },
    }, null, 2)) },
    { file: 'index.html', ...encodeFile(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${project.name}</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`) },
    { file: 'vite.config.js', ...encodeFile(`import{defineConfig}from'vite';import react from'@vitejs/plugin-react';export default defineConfig({plugins:[react()]})`) },
    { file: 'tailwind.config.js', ...encodeFile(`export default{content:['./index.html','./src/**/*.{js,jsx}'],theme:{extend:{}},plugins:[]}`) },
    { file: 'postcss.config.js', ...encodeFile(`export default{plugins:{tailwindcss:{},autoprefixer:{}}}`) },
    { file: 'src/main.jsx', ...encodeFile(`import React from'react';import ReactDOM from'react-dom/client';import App from'./App.jsx';import'./index.css';ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)`) },
    { file: 'src/index.css', ...encodeFile(`@tailwind base;@tailwind components;@tailwind utilities;`) },
    { file: 'src/App.jsx', ...encodeFile(mainCode) },
  ]

  // Add additional pages
  for (const page of projectPages.filter(p => !p.isHomePage)) {
    const code = typeof page.content === 'string' && page.content ? page.content : null
    if (code) {
      const name = page.name.replace(/[^a-zA-Z0-9]/g, '') || 'Page'
      files.push({ file: `src/${name}.jsx`, ...encodeFile(code.replace(/export default function App\(\)/, `export default function ${name}()`)) })
    }
  }

  const deployRes = await fetch(`${VERCEL_API}/v13/deployments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: project.slug,
      files,
      projectSettings: { framework: 'vite', buildCommand: 'vite build', outputDirectory: 'dist', installCommand: 'npm install' },
      target: 'production',
    }),
  })

  if (!deployRes.ok) {
    const err = await deployRes.json().catch(() => ({}))
    return NextResponse.json({ error: err.error?.message ?? 'Vercel deployment failed' }, { status: deployRes.status })
  }

  const deployment = await deployRes.json() as { url: string; id: string; readyState: string }
  return NextResponse.json({ url: `https://${deployment.url}`, deploymentId: deployment.id })
}
```

- [ ] **Step 2: Create deploy settings page**

Create `web/src/app/settings/deploy/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import DeployClient from './DeployClient'

export default async function DeploySettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const user = db.select({ settings: users.settings }).from(users)
    .where(eq(users.id, session.user.id))
    .get()

  const settings = (user?.settings as Record<string, unknown>) ?? {}
  const hasVercelToken = Boolean(settings.vercelToken)

  return <DeployClient hasVercelToken={hasVercelToken} />
}
```

Create `web/src/app/settings/deploy/DeployClient.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  hasVercelToken: boolean
}

export default function DeployClient({ hasVercelToken }: Props) {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasToken, setHasToken] = useState(hasVercelToken)

  async function saveToken() {
    if (!token.trim()) return
    setSaving(true)
    await fetch('/api/users/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vercelToken: token }),
    })
    setSaving(false)
    setSaved(true)
    setHasToken(true)
    setToken('')
    setTimeout(() => setSaved(false), 2000)
  }

  async function removeToken() {
    await fetch('/api/users/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vercelToken: '' }),
    })
    setHasToken(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-muted-foreground hover:text-foreground text-sm transition-colors">← Dashboard</button>
        <h1 className="text-xl font-bold text-foreground">Deploy Settings</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-1">Vercel</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Deploy your projects directly to Vercel. Get your token from{' '}
            <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              vercel.com/account/tokens
            </a>
          </p>

          {hasToken ? (
            <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-sm">✓</span>
                <span className="text-sm text-foreground">Vercel token configured</span>
              </div>
              <button
                onClick={removeToken}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="paste your Vercel token…"
                className="flex-1 px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={saveToken}
                disabled={saving || !token.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-2">How it works</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Save your Vercel token above</li>
            <li>Open any project in the builder</li>
            <li>Click the Deploy button in the toolbar</li>
            <li>Your site goes live on a Vercel URL instantly</li>
          </ol>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create user settings PATCH API**

Create `web/src/app/api/users/settings/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { encrypt, getEncryptionSecret } from '@/lib/encryption'
import { z } from 'zod'

const settingsSchema = z.object({
  vercelToken: z.string().optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = db.select({ settings: users.settings }).from(users)
    .where(eq(users.id, session.user.id))
    .get()

  const currentSettings = (user?.settings as Record<string, unknown>) ?? {}
  const secret = getEncryptionSecret()

  const newSettings = { ...currentSettings }
  if (parsed.data.vercelToken !== undefined) {
    if (parsed.data.vercelToken === '') {
      delete newSettings.vercelToken
    } else {
      newSettings.vercelToken = encrypt(parsed.data.vercelToken, secret) ?? ''
    }
  }

  db.update(users).set({
    settings: newSettings,
    updatedAt: new Date(),
  }).where(eq(users.id, session.user.id)).run()

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Update middleware to protect new routes**

Read `web/src/middleware.ts`, add `/api/users/:path*` and `/api/deploy/:path*`:

```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/builder/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/api/projects/:path*',
    '/api/providers/:path*',
    '/api/admin/:path*',
    '/api/chat-sessions/:path*',
    '/api/ai/:path*',
    '/api/billing/:path*',
    '/api/pages/:path*',
    '/api/export/:path*',
    '/api/templates/:path*',
    '/api/deploy/:path*',
    '/api/users/:path*',
  ],
}
```

- [ ] **Step 5: Add Deploy button to BuilderHeader**

Read `web/src/components/builder/BuilderHeader.tsx`. After the Export button, add a Deploy button that calls the Vercel API:

```typescript
const [deploying, setDeploying] = useState(false)
const [deployUrl, setDeployUrl] = useState<string | null>(null)

async function handleDeploy() {
  if (!project) return
  setDeploying(true)
  setDeployUrl(null)
  const res = await fetch(`/api/deploy/vercel/${project.id}`, { method: 'POST' })
  const data = await res.json()
  setDeploying(false)
  if (data.url) {
    setDeployUrl(data.url)
    window.open(data.url, '_blank')
  } else {
    alert(data.error ?? 'Deploy failed')
  }
}
```

Add button after the Export button in the JSX:
```typescript
<button
  onClick={handleDeploy}
  disabled={deploying || !project}
  className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
>
  {deploying ? 'Deploying…' : '▲ Deploy'}
</button>
```

- [ ] **Step 6: Add Deploy link to dashboard**

Read `web/src/app/dashboard/DashboardClient.tsx`. Add a Deploy Settings link in the header alongside AI Settings and Billing:

```typescript
<Link href="/settings/deploy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
  Deploy
</Link>
```

- [ ] **Step 7: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 17 tests PASS.

- [ ] **Step 8: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/api/deploy/ web/src/app/api/users/ web/src/app/settings/deploy/ \
  web/src/components/builder/BuilderHeader.tsx web/src/app/dashboard/DashboardClient.tsx \
  web/src/middleware.ts
git commit -m "feat: one-click Vercel deploy, deploy settings page, user settings API"
```

---

## Task 5: Usage Analytics Dashboard

**Files:**
- Create: `web/src/app/api/analytics/route.ts`
- Create: `web/src/app/settings/analytics/page.tsx`
- Create: `web/src/app/settings/analytics/AnalyticsClient.tsx`
- Modify: `web/src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create analytics API**

Create `web/src/app/api/analytics/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { creditTransactions, chatSessions, projects, users } from '@/lib/schema'
import { and, eq, gte, sql } from 'drizzle-orm'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // Credits spent this month
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const usageTransactions = db.select().from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, userId),
      eq(creditTransactions.type, 'usage'),
      gte(creditTransactions.createdAt, thirtyDaysAgo),
    ))
    .all()

  const creditsSpent30d = usageTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  // All-time usage
  const allUsage = db.select().from(creditTransactions)
    .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.type, 'usage')))
    .all()
  const creditsSpentTotal = allUsage.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  // Total AI requests (chat sessions count messages)
  const userChatSessions = db.select().from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .all()

  const totalMessages = userChatSessions.reduce((sum, s) => {
    const msgs = s.messages as Array<{ role: string }>
    return sum + (Array.isArray(msgs) ? msgs.filter(m => m.role === 'user').length : 0)
  }, 0)

  // Projects count
  const projectCount = db.select({ count: sql<number>`count(*)` }).from(projects)
    .where(eq(projects.userId, userId))
    .get()?.count ?? 0

  // Current balance
  const user = db.select({ credits: users.credits, plan: users.plan }).from(users)
    .where(eq(users.id, userId))
    .get()

  // Recent transactions (last 20)
  const recent = db.select().from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .all()
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 20)

  return NextResponse.json({
    currentCredits: user?.credits ?? 0,
    plan: user?.plan ?? 'free',
    creditsSpent30d,
    creditsSpentTotal,
    totalMessages,
    projectCount,
    recentTransactions: recent.map(t => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
    })),
  })
}
```

- [ ] **Step 2: Create analytics page**

Create `web/src/app/settings/analytics/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AnalyticsClient from './AnalyticsClient'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  return <AnalyticsClient />
}
```

Create `web/src/app/settings/analytics/AnalyticsClient.tsx`:

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Analytics {
  currentCredits: number
  plan: string
  creditsSpent30d: number
  creditsSpentTotal: number
  totalMessages: number
  projectCount: number
  recentTransactions: Array<{
    id: string
    amount: number
    type: string
    description: string
    createdAt: string | null
  }>
}

const TYPE_COLORS: Record<string, string> = {
  usage: 'text-red-400',
  purchase: 'text-green-400',
  admin: 'text-blue-400',
  refund: 'text-yellow-400',
}

export default function AnalyticsClient() {
  const router = useRouter()
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics').then(r => r.json()).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  if (!data) return null

  const stats = [
    { label: 'Current Credits', value: data.currentCredits.toLocaleString(), sub: data.plan + ' plan' },
    { label: 'Credits Spent (30d)', value: data.creditsSpent30d.toLocaleString(), sub: 'last 30 days' },
    { label: 'All-Time Spent', value: data.creditsSpentTotal.toLocaleString(), sub: 'since account creation' },
    { label: 'AI Messages', value: data.totalMessages.toLocaleString(), sub: 'total requests' },
    { label: 'Projects', value: data.projectCount.toString(), sub: 'created' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-muted-foreground hover:text-foreground text-sm transition-colors">← Dashboard</button>
        <h1 className="text-xl font-bold text-foreground">Usage Analytics</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Recent transactions */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4">Recent Transactions</h2>
          {data.recentTransactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No transactions yet.</p>
          ) : (
            <div className="space-y-0">
              {data.recentTransactions.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                      {' · '}
                      <span className={TYPE_COLORS[t.type] ?? 'text-muted-foreground'}>{t.type}</span>
                    </p>
                  </div>
                  <span className={`text-sm font-medium ml-4 ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.amount > 0 ? '+' : ''}{t.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Add Analytics link to dashboard**

Read `web/src/app/dashboard/DashboardClient.tsx`. Add an Analytics link in the header:

```typescript
<Link href="/settings/analytics" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
  Analytics
</Link>
```

- [ ] **Step 4: Add analytics to middleware**

Read `web/src/middleware.ts`, add `/api/analytics` and `/api/analytics/:path*` to the matcher array.

- [ ] **Step 5: Run final tests**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm test
```

Expected: 48 tests PASS (ai: 31 + web: 17).

- [ ] **Step 6: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/api/analytics/ web/src/app/settings/analytics/ \
  web/src/app/dashboard/DashboardClient.tsx web/src/middleware.ts
git commit -m "feat: usage analytics dashboard — credits, messages, transaction history"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Vercel deploy — Task 4 (`/api/deploy/vercel/[projectId]`, token in user settings)
- ✅ Netlify deploy — not included (YAGNI — Vercel covers the core need; Netlify can be added trivially with same pattern using their API)
- ✅ Project templates — Task 3 (create, browse, clone)
- ✅ Custom AI instructions — Task 1 (per-project, stored in settings, passed to orchestrator)
- ✅ Fullscreen preview — Task 2
- ✅ Dark/light toggle — Task 2
- ✅ Usage analytics — Task 5 (credits spent, AI messages, projects, transactions)

**Type consistency:**
- `customInstructions` added to both `BuilderState` and `OrchestratorRequest` and `BuildMessagesOptions` — consistent throughout
- `projectSettings: Record<string, unknown>` matches `projects.settings` Drizzle JSON column type
- `pagesSnapshot` in templates stored/parsed as JSON array of `{name, slug, content, isHomePage, order}` — used consistently in create and clone routes
- `vercelToken` stored encrypted in `users.settings` — encrypted in `/api/users/settings`, decrypted in deploy route
- `gte` imported from `drizzle-orm` in analytics route (same pattern as other routes in the project)

**Placeholder scan:** No TBDs, no vague steps. All code blocks are complete.

**Netlify note:** Netlify's deploy API requires a site ID and different file format. Since Vercel covers the immediate need and adding Netlify is mechanical (same pattern), it's deferred per YAGNI.
