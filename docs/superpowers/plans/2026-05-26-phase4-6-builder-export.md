# Phase 4-6 — Visual Builder, Export & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the product — persist generated code to DB, add page management, component library, project export, and a comprehensive setup guide so the platform is fully usable.

**Architecture:** Pages store their generated React code in `pages.content` (JSON string). The builder loads/saves via a new pages API. Export generates a clean Vite+React+Tailwind ZIP using jszip. The setup guide is a root-level README.md.

**Tech Stack:** jszip (ZIP export), existing Next.js/Drizzle/Sandpack stack.

---

## File Map

```
web/
  src/
    app/
      api/
        pages/
          [projectId]/route.ts       NEW — GET all pages, POST new page
          [projectId]/[pageId]/route.ts  NEW — PATCH content, DELETE page
        export/
          [projectId]/route.ts       NEW — GET: download ZIP of project
      builder/[projectId]/
        BuilderPage.tsx              MODIFY — load page content on mount
    components/
      builder/
        StylePanel.tsx               MODIFY — replace placeholder with tabs: Components + Pages
        ComponentLibrary.tsx         NEW — pre-built component snippets panel
        PageManager.tsx              NEW — add/switch/delete pages
        ChatPanel.tsx                MODIFY — save code to DB on preview_update
        PreviewPanel.tsx             MODIFY — accept external code prop
        BuilderHeader.tsx            MODIFY — add Export button
    store/
      builderStore.ts                MODIFY — add pages state + active page code
README.md                            NEW — comprehensive setup + usage guide
```

---

## Task 1: Pages API (Save/Load Code)

**Files:**
- Create: `web/src/app/api/pages/[projectId]/route.ts`
- Create: `web/src/app/api/pages/[projectId]/[pageId]/route.ts`

- [ ] **Step 1: Create `web/src/app/api/pages/[projectId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pages, projects } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { z } from 'zod'

type Params = { params: { projectId: string } }

async function getOwnedProject(userId: string, projectId: string) {
  return db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get()
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOwnedProject(session.user.id, params.projectId)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allPages = db.select().from(pages)
    .where(eq(pages.projectId, params.projectId))
    .all()
    .sort((a, b) => a.order - b.order)

  return NextResponse.json({ pages: allPages })
}

const createPageSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).optional(),
})

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOwnedProject(session.user.id, params.projectId)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = createPageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = db.select({ order: pages.order }).from(pages)
    .where(eq(pages.projectId, params.projectId))
    .all()
  const maxOrder = existing.length > 0 ? Math.max(...existing.map(p => p.order)) : -1

  const slug = parsed.data.slug ?? parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const pageId = generateId()

  db.insert(pages).values({
    id: pageId,
    projectId: params.projectId,
    name: parsed.data.name,
    slug,
    order: maxOrder + 1,
    isHomePage: false,
  }).run()

  const page = db.select().from(pages).where(eq(pages.id, pageId)).get()
  return NextResponse.json({ page }, { status: 201 })
}
```

- [ ] **Step 2: Create `web/src/app/api/pages/[projectId]/[pageId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pages, projects } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

type Params = { params: { projectId: string; pageId: string } }

async function getOwnedPage(userId: string, projectId: string, pageId: string) {
  const project = db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get()
  if (!project) return null
  return db.select().from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)))
    .get()
}

const updatePageSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  content: z.string().optional(),   // React code string
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const page = await getOwnedPage(session.user.id, params.projectId, params.pageId)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updatePageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  db.update(pages).set({
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(parsed.data.content !== undefined ? { content: parsed.data.content as unknown as [] } : {}),
    ...(parsed.data.seoTitle !== undefined ? { seoTitle: parsed.data.seoTitle } : {}),
    ...(parsed.data.seoDescription !== undefined ? { seoDescription: parsed.data.seoDescription } : {}),
    updatedAt: new Date(),
  }).where(eq(pages.id, params.pageId)).run()

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const page = await getOwnedPage(session.user.id, params.projectId, params.pageId)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (page.isHomePage) {
    return NextResponse.json({ error: 'Cannot delete the home page' }, { status: 400 })
  }

  db.delete(pages).where(eq(pages.id, params.pageId)).run()
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Update middleware to protect pages API**

Read `web/src/middleware.ts`, add `/api/pages/:path*` to matcher:

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
  ],
}
```

- [ ] **Step 4: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 17 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/api/pages/ web/src/middleware.ts
git commit -m "feat: pages CRUD API — save/load generated code per page"
```

---

## Task 2: Update Builder Store + Load Code on Open

**Files:**
- Modify: `web/src/store/builderStore.ts`
- Modify: `web/src/app/builder/[projectId]/BuilderPage.tsx`
- Modify: `web/src/app/builder/[projectId]/page.tsx`

- [ ] **Step 1: Read existing builderStore.ts and replace**

Read `web/src/store/builderStore.ts`, then replace entirely:

```typescript
import { create } from 'zustand'

export interface BuilderPage {
  id: string
  projectId: string
  name: string
  slug: string
  order: number
  content: string   // stored React code (empty string = no code yet)
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
  previewCode: string        // code currently shown in Sandpack
  previewSize: 'desktop' | 'tablet' | 'mobile'
  credits: number
  setProject: (project: Project) => void
  setPages: (pages: BuilderPage[]) => void
  setActivePage: (page: BuilderPage) => void
  setPreviewCode: (code: string) => void
  setPreviewSize: (size: 'desktop' | 'tablet' | 'mobile') => void
  setCredits: (credits: number) => void
  updatePageContent: (pageId: string, code: string) => void
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  project: null,
  pages: [],
  activePage: null,
  previewCode: '',
  previewSize: 'desktop',
  credits: 0,
  setProject: (project) => set({ project }),
  setPages: (pages) => {
    const activePage = get().activePage
    set({
      pages,
      // If no active page, default to home page
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
}))
```

- [ ] **Step 2: Update BuilderPage.tsx to load pages**

Read `web/src/app/builder/[projectId]/BuilderPage.tsx`, then replace:

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
}

interface Props {
  project: Project
  initialPages: BuilderPage[]
  initialCredits: number
}

export default function BuilderPage({ project, initialPages, initialCredits }: Props) {
  const { setProject, setPages, setCredits, setActivePage } = useBuilderStore()

  useEffect(() => {
    setProject(project)
    setCredits(initialCredits)
    setPages(initialPages)
    const homePage = initialPages.find(p => p.isHomePage) ?? initialPages[0]
    if (homePage) {
      setActivePage(homePage)
    }
  }, [project, initialPages, initialCredits, setProject, setPages, setCredits, setActivePage])

  return <BuilderLayout />
}
```

- [ ] **Step 3: Update builder page.tsx to load pages**

Read `web/src/app/builder/[projectId]/page.tsx`, then replace:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, pages, users } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import BuilderPage from './BuilderPage'

interface Props {
  params: { projectId: string }
}

export default async function BuilderRoute({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const project = db.select().from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()

  if (!project) redirect('/dashboard')

  const projectPages = db.select().from(pages)
    .where(eq(pages.projectId, params.projectId))
    .all()
    .sort((a, b) => a.order - b.order)
    .map(p => ({
      ...p,
      content: typeof p.content === 'string' ? p.content : '',
    }))

  const user = db.select({ credits: users.credits }).from(users)
    .where(eq(users.id, session.user.id))
    .get()

  return (
    <BuilderPage
      project={project}
      initialPages={projectPages}
      initialCredits={user?.credits ?? 0}
    />
  )
}
```

- [ ] **Step 4: Update ChatPanel to save code to DB on preview_update**

Read `web/src/components/builder/ChatPanel.tsx`. Find the `preview_update` handler:
```typescript
} else if (event.type === 'preview_update') {
  setPreviewCode(event.code)
}
```

Replace with:
```typescript
} else if (event.type === 'preview_update') {
  setPreviewCode(event.code)
  // Save to active page in DB (fire and forget)
  if (activePage) {
    updatePageContent(activePage.id, event.code)
    fetch(`/api/pages/${project.id}/${activePage.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: event.code }),
    }).catch(() => {})
  }
}
```

Also update the `useBuilderStore` destructuring to include `activePage` and `updatePageContent`:
```typescript
const { project, setPreviewCode, credits, setCredits, activePage, updatePageContent } = useBuilderStore()
```

- [ ] **Step 5: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 17 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/store/builderStore.ts web/src/app/builder/ web/src/components/builder/ChatPanel.tsx
git commit -m "feat: load/save page code to DB, multi-page store"
```

---

## Task 3: Page Manager + Component Library UI

**Files:**
- Create: `web/src/components/builder/PageManager.tsx`
- Create: `web/src/components/builder/ComponentLibrary.tsx`
- Modify: `web/src/components/builder/StylePanel.tsx`

- [ ] **Step 1: Create PageManager.tsx**

```typescript
'use client'
import { useState } from 'react'
import { useBuilderStore } from '@/store/builderStore'

export default function PageManager() {
  const { pages, activePage, setActivePage, project, setPages } = useBuilderStore()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  async function createPage() {
    if (!newName.trim() || !project) return
    setCreating(true)
    const res = await fetch(`/api/pages/${project.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.page) {
      setNewName('')
      setPages([...pages, { ...data.page, content: '' }])
      setActivePage({ ...data.page, content: '' })
    }
  }

  async function deletePage(pageId: string) {
    if (!project) return
    if (!confirm('Delete this page?')) return
    await fetch(`/api/pages/${project.id}/${pageId}`, { method: 'DELETE' })
    const remaining = pages.filter(p => p.id !== pageId)
    setPages(remaining)
    if (activePage?.id === pageId) {
      const home = remaining.find(p => p.isHomePage) ?? remaining[0]
      if (home) setActivePage(home)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {pages.map(page => (
        <div
          key={page.id}
          className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group ${
            activePage?.id === page.id ? 'bg-primary/20 text-primary' : 'hover:bg-secondary text-foreground'
          }`}
          onClick={() => setActivePage(page)}
        >
          <span className="text-xs truncate flex-1">{page.name}</span>
          {!page.isHomePage && (
            <button
              onClick={e => { e.stopPropagation(); deletePage(page.id) }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 text-xs transition-opacity"
            >
              ✕
            </button>
          )}
          {page.isHomePage && <span className="text-xs text-muted-foreground">home</span>}
        </div>
      ))}

      <div className="mt-2 flex gap-1">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createPage()}
          placeholder="New page…"
          className="flex-1 px-2 py-1 bg-secondary border border-border rounded text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={createPage}
          disabled={creating || !newName.trim()}
          className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs disabled:opacity-50"
        >
          +
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ComponentLibrary.tsx**

Pre-built components that set `previewCode` and save to DB with one click.

```typescript
'use client'
import { useBuilderStore } from '@/store/builderStore'

interface Component {
  name: string
  icon: string
  description: string
  code: string
}

const COMPONENTS: Component[] = [
  {
    name: 'Hero',
    icon: '🦸',
    description: 'Full-screen hero section',
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-6">
      <div className="text-center max-w-4xl">
        <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Build Something <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-yellow-400">Amazing</span>
        </h1>
        <p className="text-xl text-purple-200 mb-10 max-w-2xl mx-auto">
          The fastest way to launch your idea. No code required. Powered by AI.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-8 py-4 bg-white text-indigo-900 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl">
            Get Started Free
          </button>
          <button className="px-8 py-4 border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/10 transition-colors">
            Watch Demo
          </button>
        </div>
      </div>
    </div>
  )
}`,
  },
  {
    name: 'Navbar',
    icon: '🔲',
    description: 'Responsive navigation bar',
    code: `import { useState } from 'react'
export default function App() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-white font-bold text-xl">BrandName</span>
          <div className="hidden md:flex items-center gap-8">
            {['Home', 'Features', 'Pricing', 'About'].map(item => (
              <a key={item} href="#" className="text-gray-400 hover:text-white transition-colors text-sm">{item}</a>
            ))}
          </div>
          <button className="hidden md:block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            Get Started
          </button>
          <button className="md:hidden text-gray-400" onClick={() => setOpen(!open)}>
            {open ? '✕' : '☰'}
          </button>
        </div>
        {open && (
          <div className="md:hidden mt-4 pb-2 flex flex-col gap-3">
            {['Home', 'Features', 'Pricing', 'About'].map(item => (
              <a key={item} href="#" className="text-gray-400 hover:text-white transition-colors text-sm">{item}</a>
            ))}
          </div>
        )}
      </nav>
      <div className="p-8 text-gray-500 text-center">Page content here…</div>
    </div>
  )
}`,
  },
  {
    name: 'Pricing',
    icon: '💰',
    description: '3-tier pricing cards',
    code: `export default function App() {
  const plans = [
    { name: 'Starter', price: '$9', desc: 'Perfect for individuals', features: ['5 projects', '10GB storage', 'Basic support', 'API access'], highlight: false },
    { name: 'Pro', price: '$29', desc: 'Best for growing teams', features: ['Unlimited projects', '100GB storage', 'Priority support', 'Advanced analytics', 'Custom domain'], highlight: true },
    { name: 'Enterprise', price: '$99', desc: 'For large organizations', features: ['Everything in Pro', 'Unlimited storage', 'Dedicated support', 'SLA guarantee', 'Custom integrations'], highlight: false },
  ]
  return (
    <div className="min-h-screen bg-gray-950 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl font-bold text-white text-center mb-4">Simple Pricing</h2>
        <p className="text-gray-400 text-center mb-16">No hidden fees. Cancel anytime.</p>
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map(plan => (
            <div key={plan.name} className={\`rounded-2xl p-8 \${plan.highlight ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-900'}\`}>
              <h3 className="text-white font-bold text-xl mb-1">{plan.name}</h3>
              <p className={\`text-sm mb-6 \${plan.highlight ? 'text-indigo-200' : 'text-gray-400'}\`}>{plan.desc}</p>
              <div className="text-4xl font-bold text-white mb-8">{plan.price}<span className="text-lg font-normal text-gray-400">/mo</span></div>
              <ul className="space-y-3 mb-8">
                {plan.features.map(f => <li key={f} className={\`text-sm flex items-center gap-2 \${plan.highlight ? 'text-indigo-100' : 'text-gray-300'}\`}><span>✓</span>{f}</li>)}
              </ul>
              <button className={\`w-full py-3 rounded-xl font-semibold transition-colors \${plan.highlight ? 'bg-white text-indigo-600 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}\`}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}`,
  },
  {
    name: 'Features',
    icon: '✨',
    description: 'Feature grid with icons',
    code: `export default function App() {
  const features = [
    { icon: '⚡', title: 'Lightning Fast', desc: 'Optimized for performance with sub-second load times.' },
    { icon: '🔒', title: 'Secure by Default', desc: 'Enterprise-grade security built into every layer.' },
    { icon: '📱', title: 'Mobile First', desc: 'Responsive design that looks great on any device.' },
    { icon: '🤖', title: 'AI Powered', desc: 'Smart automation that learns from your workflow.' },
    { icon: '🌍', title: 'Global CDN', desc: 'Deploy worldwide with 99.9% uptime guarantee.' },
    { icon: '📊', title: 'Analytics', desc: 'Deep insights into user behavior and performance.' },
  ]
  return (
    <div className="min-h-screen bg-gray-950 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl font-bold text-white text-center mb-4">Everything You Need</h2>
        <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">Built for developers who want to move fast without breaking things.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map(f => (
            <div key={f.title} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-indigo-500 transition-colors">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}`,
  },
  {
    name: 'CTA',
    icon: '📣',
    description: 'Call-to-action section',
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-indigo-900 to-purple-900 rounded-3xl p-16 border border-indigo-500/30">
        <h2 className="text-5xl font-bold text-white mb-6">Ready to Get Started?</h2>
        <p className="text-indigo-200 text-xl mb-10">Join over 10,000 teams already building with us. Start your free trial today.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-10 py-4 bg-white text-indigo-900 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-2xl">
            Start Free Trial
          </button>
          <button className="px-10 py-4 border-2 border-white/50 text-white rounded-full font-semibold text-lg hover:border-white transition-colors">
            Talk to Sales
          </button>
        </div>
        <p className="text-indigo-300 text-sm mt-6">No credit card required · Cancel anytime</p>
      </div>
    </div>
  )
}`,
  },
  {
    name: 'Footer',
    icon: '📋',
    description: 'Multi-column footer',
    code: `export default function App() {
  const cols = [
    { title: 'Product', links: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
    { title: 'Company', links: ['About', 'Blog', 'Careers', 'Press'] },
    { title: 'Resources', links: ['Docs', 'API Reference', 'Guides', 'Community'] },
    { title: 'Legal', links: ['Privacy', 'Terms', 'Cookies', 'Licenses'] },
  ]
  return (
    <div className="bg-gray-950 min-h-screen flex flex-col">
      <div className="flex-1 bg-gray-900/50" />
      <footer className="bg-gray-900 border-t border-gray-800 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="text-white font-bold text-xl mb-3">Brand</div>
              <p className="text-gray-400 text-sm">Building the future of the web, one component at a time.</p>
            </div>
            {cols.map(col => (
              <div key={col.title}>
                <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map(link => <li key={link}><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">{link}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">© 2025 Brand Inc. All rights reserved.</p>
            <div className="flex gap-6">
              {['Twitter', 'GitHub', 'Discord', 'LinkedIn'].map(s => (
                <a key={s} href="#" className="text-gray-400 hover:text-white text-sm transition-colors">{s}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}`,
  },
  {
    name: 'Dashboard',
    icon: '📊',
    description: 'Admin dashboard layout',
    code: `import { useState } from 'react'
export default function App() {
  const stats = [
    { label: 'Total Users', value: '12,430', change: '+12%', up: true },
    { label: 'Revenue', value: '$48,200', change: '+8%', up: true },
    { label: 'Active Projects', value: '3,240', change: '-2%', up: false },
    { label: 'Conversion Rate', value: '3.6%', change: '+0.4%', up: true },
  ]
  return (
    <div className="min-h-screen bg-gray-950 flex">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 hidden md:flex flex-col gap-1">
        <div className="text-white font-bold text-lg mb-6 px-2">Dashboard</div>
        {['Overview', 'Analytics', 'Users', 'Revenue', 'Settings'].map(item => (
          <button key={item} className="text-left px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors">
            {item}
          </button>
        ))}
      </aside>
      <main className="flex-1 p-8">
        <h1 className="text-white text-2xl font-bold mb-8">Overview</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(s => (
            <div key={s.label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className="text-white text-2xl font-bold">{s.value}</p>
              <p className={\`text-xs mt-1 \${s.up ? 'text-green-400' : 'text-red-400'}\`}>{s.change} from last month</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-4">Recent Activity</h2>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-800 last:border-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white">U{i}</div>
              <div className="flex-1">
                <p className="text-gray-300 text-sm">User {i} completed an action</p>
                <p className="text-gray-500 text-xs">{i} hour{i > 1 ? 's' : ''} ago</p>
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
    name: 'Contact',
    icon: '✉️',
    description: 'Contact form',
    code: `import { useState } from 'react'
export default function App() {
  const [sent, setSent] = useState(false)
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full">
        <h2 className="text-4xl font-bold text-white mb-2">Get in Touch</h2>
        <p className="text-gray-400 mb-10">We'd love to hear from you. Send us a message.</p>
        {sent ? (
          <div className="bg-green-900/30 border border-green-700 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-white font-bold text-xl mb-2">Message Sent!</h3>
            <p className="text-green-300">We'll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={e => { e.preventDefault(); setSent(true) }}>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">First Name</label>
                <input className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors" placeholder="John" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Last Name</label>
                <input className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Doe" />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Email</label>
              <input type="email" className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors" placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Message</label>
              <textarea rows={5} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none" placeholder="Your message…" />
            </div>
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
              Send Message
            </button>
          </form>
        )}
      </div>
    </div>
  )
}`,
  },
]

export default function ComponentLibrary() {
  const { project, activePage, setPreviewCode, updatePageContent } = useBuilderStore()

  function insertComponent(component: Component) {
    setPreviewCode(component.code)
    if (activePage && project) {
      updatePageContent(activePage.id, component.code)
      fetch(`/api/pages/${project.id}/${activePage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: component.code }),
      }).catch(() => {})
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {COMPONENTS.map(comp => (
        <button
          key={comp.name}
          onClick={() => insertComponent(comp)}
          className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-secondary text-left group transition-colors"
        >
          <span className="text-base">{comp.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground">{comp.name}</div>
            <div className="text-xs text-muted-foreground truncate">{comp.description}</div>
          </div>
          <span className="opacity-0 group-hover:opacity-100 text-xs text-primary transition-opacity">Insert</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Replace StylePanel.tsx with tabbed Components + Pages panel**

Read `web/src/components/builder/StylePanel.tsx`, then replace:

```typescript
'use client'
import { useState } from 'react'
import ComponentLibrary from './ComponentLibrary'
import PageManager from './PageManager'

type Tab = 'components' | 'pages'

export default function StylePanel() {
  const [tab, setTab] = useState<Tab>('components')

  return (
    <aside className="w-60 border-l border-border bg-card flex flex-col shrink-0">
      <div className="flex border-b border-border">
        {(['components', 'pages'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors capitalize ${
              tab === t
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'components' ? <ComponentLibrary /> : <PageManager />}
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 17 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/components/builder/
git commit -m "feat: component library (8 templates), page manager, tabbed style panel"
```

---

## Task 4: Export as ZIP

**Files:**
- Create: `web/src/app/api/export/[projectId]/route.ts`
- Modify: `web/src/components/builder/BuilderHeader.tsx`

- [ ] **Step 1: Install jszip**

Add to `web/package.json` dependencies:
```json
"jszip": "^3.10.1"
```

```bash
pnpm --filter web install
```

- [ ] **Step 2: Create export API route**

Create `web/src/app/api/export/[projectId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, pages } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import JSZip from 'jszip'

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = db.select().from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const projectPages = db.select().from(pages)
    .where(eq(pages.projectId, params.projectId))
    .all()
    .sort((a, b) => a.order - b.order)

  const homePage = projectPages.find(p => p.isHomePage) ?? projectPages[0]
  const mainCode = typeof homePage?.content === 'string' && homePage.content
    ? homePage.content
    : `export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <h1 className="text-4xl font-bold">Welcome to ${project.name}</h1>
    </div>
  )
}`

  const zip = new JSZip()

  zip.file('package.json', JSON.stringify({
    name: project.slug,
    private: true,
    version: '0.0.1',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.2.1',
      autoprefixer: '^10.4.19',
      postcss: '^8.4.38',
      tailwindcss: '^3.4.3',
      vite: '^5.2.0',
    },
  }, null, 2))

  zip.file('index.html', `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${project.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`)

  zip.file('vite.config.js', `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`)

  zip.file('tailwind.config.js', `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}`)

  zip.file('postcss.config.js', `export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}`)

  const src = zip.folder('src')!

  src.file('main.jsx', `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`)

  src.file('index.css', `@tailwind base;
@tailwind components;
@tailwind utilities;`)

  src.file('App.jsx', mainCode)

  // Additional pages as separate components
  const otherPages = projectPages.filter(p => !p.isHomePage)
  for (const page of otherPages) {
    const code = typeof page.content === 'string' && page.content ? page.content : null
    if (code) {
      const componentName = page.name.replace(/[^a-zA-Z0-9]/g, '')
      const renamed = code.replace(/export default function App\(\)/, `export default function ${componentName}()`)
      src.file(`${componentName}.jsx`, renamed)
    }
  }

  zip.file('README.md', `# ${project.name}

Generated with AI Website Builder.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Build for Production

\`\`\`bash
npm run build
\`\`\`

Deploy the \`dist/\` folder to any static host (Vercel, Netlify, Cloudflare Pages, etc.).
`)

  const content = await zip.generateAsync({ type: 'nodebuffer' })
  const filename = `${project.slug}-export.zip`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 3: Add Export button to BuilderHeader**

Read `web/src/components/builder/BuilderHeader.tsx`. Replace the Publish button with Export + Publish:

```typescript
'use client'
import { useBuilderStore } from '@/store/builderStore'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function BuilderHeader() {
  const { project, previewSize, setPreviewSize, credits } = useBuilderStore()
  const router = useRouter()
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (!project) return
    setExporting(true)
    const res = await fetch(`/api/export/${project.id}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.slug}-export.zip`
      a.click()
      URL.revokeObjectURL(url)
    }
    setExporting(false)
  }

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

      <span className="text-xs text-muted-foreground">
        {credits} credits
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

      <button
        onClick={handleExport}
        disabled={exporting || !project}
        className="px-3 py-1.5 bg-secondary text-foreground border border-border rounded-md text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
      >
        {exporting ? 'Exporting…' : '↓ Export'}
      </button>
    </header>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 17 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/api/export/ web/src/components/builder/BuilderHeader.tsx \
  web/package.json pnpm-lock.yaml
git commit -m "feat: export project as clean Vite+React+Tailwind ZIP"
```

---

## Task 5: Create First Admin Account Helper + Final Polish

**Files:**
- Create: `web/src/app/api/admin/setup/route.ts`
- Modify: `web/src/app/(auth)/register/page.tsx`

Allow the very first registered user to automatically become admin (one-time setup).

- [ ] **Step 1: Create setup check API**

Create `web/src/app/api/admin/setup/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const adminExists = db.select({ id: users.id }).from(users)
    .where(eq(users.role, 'admin'))
    .get()
  return NextResponse.json({ adminExists: Boolean(adminExists) })
}
```

- [ ] **Step 2: Update register API to make first user admin**

Read `web/src/app/api/auth/register/route.ts`, then replace:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { generateId } from '@/lib/utils'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { email, password, name } = parsed.data

  const existing = db.select().from(users).where(eq(users.email, email)).get()
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  // First user ever gets admin role + 500 starter credits
  const anyUser = db.select({ id: users.id }).from(users).get()
  const isFirstUser = !anyUser
  const role = isFirstUser ? 'admin' : 'user'
  const initialCredits = isFirstUser ? 500 : 50

  const passwordHash = await bcrypt.hash(password, 12)
  const id = generateId()

  db.insert(users).values({
    id,
    email,
    name: name ?? null,
    passwordHash,
    role,
    credits: initialCredits,
  }).run()

  return NextResponse.json({ success: true, isAdmin: isFirstUser }, { status: 201 })
}
```

- [ ] **Step 3: Run final tests**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm test
```

Expected: ai: 31 + web: 17 = 48 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/api/admin/setup/ web/src/app/api/auth/register/route.ts
git commit -m "feat: first user becomes admin with 500 starter credits"
```

---

## Task 6: Comprehensive Setup Guide (README.md)

**Files:**
- Create: `README.md` (root of project)

- [ ] **Step 1: Create README.md**

```markdown
# AI Website Builder

A self-hosted, multi-user AI website builder — chat with AI to generate beautiful React+Tailwind websites instantly. Powered by local LLMs (Ollama) or cloud APIs.

---

## What's Included

| Feature | Status |
|---|---|
| Chat-first AI builder (Ollama, LM Studio, OpenAI, Claude) | ✅ |
| Live Sandpack preview | ✅ |
| Component library (Hero, Pricing, Dashboard, etc.) | ✅ |
| Multi-page projects | ✅ |
| Export as clean Vite+React+Tailwind ZIP | ✅ |
| Credit system + Stripe billing | ✅ |
| Admin panel (users, providers, credits) | ✅ |
| Redis rate limiting | ✅ |
| Docker Compose deployment | ✅ |

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | 20+ | Runtime |
| **pnpm** | 9+ | Package manager |
| **Docker** | 24+ | Containers |
| **Docker Compose** | v2+ | Orchestration |
| **Ollama** (recommended) | latest | Local LLM inference |

---

## Quick Start (Local Development)

### 1. Clone and install

```bash
git clone <your-repo>
cd ai-website-builder
pnpm install
pnpm --filter @ai-builder/shared build
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — the minimum required values:

```env
NEXTAUTH_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
ENCRYPTION_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
OLLAMA_BASE_URL=http://your-ollama-machine-ip:11434
DEFAULT_MODEL=llama3.2
```

### 3. Set up the database

```bash
cd web
mkdir -p data
pnpm db:migrate
cd ..
```

### 4. Start development servers

```bash
pnpm dev
```

This starts:
- **Web app**: http://localhost:4000
- **AI service**: http://localhost:4001

### 5. Create your admin account

1. Open http://localhost:4000
2. Click "Create account" on the login page
3. **The first registered account automatically becomes admin** with 500 starter credits
4. All subsequent accounts start as regular users with 50 credits

---

## Docker Deployment (Production)

### 1. Prepare the server

Requirements:
- Linux server (Ubuntu 22.04+ recommended)
- Docker + Docker Compose v2 installed
- Nginx Proxy Manager already running
- Ollama running on a separate machine on your LAN

### 2. Clone and configure

```bash
git clone <your-repo>
cd ai-website-builder
cp .env.example .env
nano .env
```

Required values for production:

```env
# Ports — change if 4000/4001/6380 conflict with other apps
WEB_PORT=4000
AI_PORT=4001
REDIS_PORT=6380

# Auth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<generate with openssl rand -base64 32>

# Security
ENCRYPTION_SECRET=<generate with openssl rand -base64 32>

# AI — your LAN machine running Ollama
OLLAMA_BASE_URL=http://192.168.1.xxx:11434
DEFAULT_MODEL=llama3.2

# AI service URL as seen from the browser
NEXT_PUBLIC_AI_SERVICE_URL=https://ai.yourdomain.com
# OR if AI service is behind same domain on different path, use:
# NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:4001 (only works for local dev)
```

### 3. Build and start

```bash
docker compose up -d --build
```

This starts three containers:
- `web` (Next.js) on port 4000
- `ai` (Express AI service) on port 4001  
- `redis` on port 6380

### 4. Configure Nginx Proxy Manager

Add two proxy hosts:

**Web App:**
- Domain: `builder.yourdomain.com`
- Forward Hostname: `localhost`
- Forward Port: `4000` (or your WEB_PORT)
- Enable SSL with Let's Encrypt

**AI Service** (needed for SSE streaming from browser):
- Domain: `ai.yourdomain.com`
- Forward Hostname: `localhost`
- Forward Port: `4001` (or your AI_PORT)
- Enable SSL with Let's Encrypt
- ⚠️ **Important**: In NPM's "Advanced" tab for the AI proxy, add:
  ```nginx
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
  proxy_buffering off;
  ```
  This is required for SSE streaming to work through the proxy.

### 5. Set NEXT_PUBLIC_AI_SERVICE_URL

After setting up the AI proxy, update your `.env`:
```env
NEXT_PUBLIC_AI_SERVICE_URL=https://ai.yourdomain.com
```

Then rebuild:
```bash
docker compose up -d --build web
```

### 6. First access

Visit `https://builder.yourdomain.com`, register — first account becomes admin.

---

## Configuring AI Providers

### Ollama (Default, Recommended)

1. On your AI machine, install Ollama: https://ollama.com
2. Pull a model: `ollama pull llama3.2`
3. Make sure Ollama listens on all interfaces: set `OLLAMA_HOST=0.0.0.0:11434` in your Ollama service
4. In your `.env`: `OLLAMA_BASE_URL=http://192.168.1.xxx:11434`

**Recommended models by task:**
- Fast/chat: `llama3.2`, `mistral`, `phi3`
- Best quality: `llama3.1:70b`, `qwen2.5:72b`
- Code generation: `deepseek-coder-v2`, `codellama`

### LM Studio

1. Open LM Studio → Local Server tab
2. Start server (default port 1234)
3. In `.env`: `LMSTUDIO_BASE_URL=http://192.168.1.xxx:1234`

### Cloud Providers (OpenAI, Claude, etc.)

Users can add their own API keys in **Settings → AI Providers**.

Admins can add platform-level shared keys in **Admin → AI Providers** — all users on eligible plans will use these.

---

## Admin Guide

### Accessing the Admin Panel

Log in as an admin user, then visit:
- `/admin/providers` — manage AI providers (add Ollama, cloud keys)
- `/admin/users` — manage users, adjust credits, change plans/roles

### Making a User Admin

In `/admin/users`, find the user and change their role dropdown to "admin".

### Adding Credits to a User

In `/admin/users`, click "Adjust Credits" next to the user. Enter a positive number to add, negative to remove.

### Setting Up Platform AI Providers

1. Go to `/admin/providers`
2. Click "+ Add Provider"
3. Fill in:
   - **Provider**: ollama
   - **Display Name**: Ollama Local (or anything descriptive)
   - **Base URL**: `http://192.168.1.xxx:11434`
   - **Model**: `llama3.2`
   - **Credit cost per request**: `0` (local models are free)
   - **Allowed plans**: select which plans get access
4. Check "Set as platform default"

---

## Stripe Billing Setup (Optional)

If you want to charge users for credits:

1. Create a Stripe account at https://stripe.com
2. Create products in Stripe Dashboard:
   - **Starter Pack** (one-time): 100 credits = $5
   - **Pro Pack** (one-time): 500 credits = $20
   - **Power Pack** (one-time): 1200 credits = $40
   - **Pro Plan** (recurring monthly): $12/month
   - **Enterprise Plan** (recurring monthly): $49/month
3. Copy the Price IDs and add to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_PRICE_STARTER=price_xxx
   STRIPE_PRICE_PRO_PACK=price_xxx
   STRIPE_PRICE_POWER_PACK=price_xxx
   STRIPE_PRICE_PRO_SUB=price_xxx
   STRIPE_PRICE_ENTERPRISE_SUB=price_xxx
   ```
4. Set up webhook in Stripe Dashboard → Webhooks:
   - Endpoint: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`

---

## Rate Limiting

By default: 5 AI requests per minute, 30 per hour per user.

Customize in `.env`:
```env
RATE_LIMIT_PER_MINUTE=10
RATE_LIMIT_PER_HOUR=60
```

Rate limiting requires Redis (included in Docker Compose). If Redis is unavailable, the rate limiter fails open (all requests allowed).

---

## Upgrading

```bash
git pull
pnpm install
pnpm --filter @ai-builder/shared build
cd web && pnpm db:migrate && cd ..
docker compose up -d --build
```

---

## Troubleshooting

### "No AI provider configured"

→ Add a platform provider in `/admin/providers` or set `OLLAMA_BASE_URL` in `.env`

### AI chat messages don't stream

→ Check Nginx Proxy Manager: make sure `proxy_buffering off` is set in Advanced config for the AI service proxy.

### Sandpack preview is blank

→ The AI needs to generate a valid React component. Try a specific prompt like: "Create a landing page for a SaaS product with hero, features, and pricing sections"

### Can't log in after fresh install

→ Visit `/register` to create the first account. The first account is automatically admin.

### Credits not deducting

→ For local LLMs (Ollama, LM Studio), credits cost 0 — this is intentional. Check `/admin/providers` to set credit costs if needed.

### Database migration errors

```bash
cd web
pnpm db:migrate
```

If that fails, check `web/data/db.sqlite` exists and is writable.

### Docker container won't start

```bash
docker compose logs web
docker compose logs ai
```

Common issues:
- Port conflicts: change WEB_PORT/AI_PORT in `.env`
- Missing NEXTAUTH_SECRET: generate and add to `.env`

---

## Architecture Overview

```
Browser
  ↕ HTTPS
Nginx Proxy Manager (SSL termination)
  ↕
┌─────────────────────────────────┐
│  Docker Compose                 │
│                                 │
│  web  (Next.js)    :4000        │
│  ai   (Express)    :4001        │
│  redis             :6380        │
└─────────────────────────────────┘
  ↕ HTTP (LAN)
Your AI Machine
  Ollama :11434 / LM Studio :1234
```

**web** handles: auth, projects, pages, billing, user management
**ai** handles: LLM orchestration, streaming, code extraction, validation
**redis** handles: rate limiting, session cache (BullMQ in future phases)

---

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Sandpack
- **Backend**: Express (AI service), Next.js API routes
- **Database**: SQLite via Drizzle ORM (Postgres-ready)
- **Auth**: NextAuth.js v4
- **Billing**: Stripe
- **AI**: Custom adapter layer (Ollama, LM Studio, OpenAI, Claude, OpenRouter)
- **Infra**: Docker Compose, pnpm workspaces

---

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add README.md
git commit -m "docs: comprehensive setup + deployment guide"
```

---

## Self-Review Notes

**Spec coverage (Phases 4-6):**
- ✅ Component registry with 8 templates (Hero, Navbar, Pricing, Features, CTA, Footer, Dashboard, Contact)
- ✅ Multi-page support with page manager
- ✅ Code persisted to DB (`pages.content`) on every AI generation
- ✅ Code loaded from DB on builder open
- ✅ Export ZIP (clean Vite+React+Tailwind)
- ✅ First user → admin setup
- ✅ Setup guide covering all deployment scenarios

**Type consistency:**
- `BuilderPage` interface exported from `builderStore.ts`, imported in `BuilderPage.tsx`
- `updatePageContent(pageId, code)` defined in store, called in `ChatPanel` and `ComponentLibrary`
- `activePage` from store used in both `ChatPanel` and `ComponentLibrary` for save calls
- Export API reads `pages.content` which is stored as string by PATCH route ✅

**Deferred (Phase 7):**
- Vercel/Netlify one-click deploy (requires OAuth tokens)
- Drag-and-drop visual editing (complex, Phase 7+)
- Real-time collaboration (WebSockets required)
