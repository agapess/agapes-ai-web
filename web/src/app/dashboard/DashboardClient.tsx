'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import TemplateGallery from './TemplateGallery'
import ProjectThumbnail from './ProjectThumbnail'

// ── Clone prompt builder ──────────────────────────────────────────────────────
interface CloneAnalysis {
  url: string
  title: string
  description: string
  headings: string[]
  navLinks: string[]
  sections: Array<{ tag: string; id?: string; className?: string; textPreview: string }>
  colors: string[]
  fonts: string[]
  images: Array<{ src: string; alt: string }>
  textContent: string
  rawHtmlSnippet: string
}

function buildClonePrompt(analysis: CloneAnalysis): string {
  const parts: string[] = []
  parts.push(`Clone this website as closely as possible: ${analysis.url}`)
  parts.push('')
  parts.push('## Website Analysis')
  if (analysis.title) parts.push(`**Title:** ${analysis.title}`)
  if (analysis.description) parts.push(`**Description:** ${analysis.description}`)
  if (analysis.navLinks.length > 0) parts.push(`**Navigation:** ${analysis.navLinks.join(' | ')}`)
  if (analysis.headings.length > 0) parts.push(`**Headings:** ${analysis.headings.slice(0, 8).join(' / ')}`)
  if (analysis.colors.length > 0) parts.push(`**Colors found:** ${analysis.colors.slice(0, 6).join(', ')}`)
  if (analysis.fonts.length > 0) parts.push(`**Fonts:** ${analysis.fonts.join(', ')}`)
  if (analysis.images.length > 0) {
    parts.push(`**Images:** ${analysis.images.map(img => img.alt || img.src.split('/').pop()).join(', ')}`)
  }
  parts.push('')
  parts.push('## Page Structure')
  for (const sec of analysis.sections.slice(0, 8)) {
    parts.push(`- <${sec.tag}${sec.id ? ` id="${sec.id}"` : ''}> ${sec.textPreview}`)
  }
  parts.push('')
  parts.push('## Content')
  parts.push(analysis.textContent.slice(0, 2000))
  parts.push('')
  parts.push('## Instructions')
  parts.push('Recreate this website as a complete, pixel-accurate React + Tailwind component.')
  parts.push('- Match the exact layout, colors, fonts, spacing, and visual hierarchy.')
  parts.push('- Use the exact same text content, headings, and navigation links.')
  parts.push('- For images, use placeholder colored divs or inline SVG icons that match the context.')
  parts.push('- Make it fully responsive and interactive (hover states, transitions).')
  parts.push('- Match the color scheme as closely as possible using Tailwind utilities.')
  parts.push('- If the site has a dark theme, use dark backgrounds. If light, use light backgrounds.')
  return parts.join('\n')
}

interface Project {
  id: string
  name: string
  slug: string
  status: string
  createdAt: Date | null
  updatedAt: Date | null
  previewCode: string | null
}

interface Props {
  initialProjects: Project[]
  user: { id: string; name: string | null; email: string; credits: number; plan: string; role?: string }
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return ''
  const now = Date.now()
  const ts = date instanceof Date ? date.getTime() : Number(date) * 1000
  const diff = now - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

export default function DashboardClient({ initialProjects, user }: Props) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)

  async function deleteProject(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects(prev => prev.filter(p => p.id !== id))
  }

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

  // ── Clone website flow ──────────────────────────────────────────────────────
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState('')
  const [cloneStatus, setCloneStatus] = useState('')

  async function handleClone() {
    if (!cloneUrl.trim()) return
    setCloning(true)
    setCloneError('')
    setCloneStatus('Fetching website…')

    try {
      // 1. Analyze the website
      const analyzeRes = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cloneUrl }),
      })
      const analyzeData = await analyzeRes.json()
      if (!analyzeRes.ok) {
        setCloneError(analyzeData.error || 'Failed to analyze website')
        setCloning(false)
        return
      }

      setCloneStatus('Creating project…')

      // 2. Create a new project
      const siteName = analyzeData.analysis.title
        ? analyzeData.analysis.title.split(/[|–—\-]/)[0].trim().slice(0, 40)
        : new URL(cloneUrl.startsWith('http') ? cloneUrl : `https://${cloneUrl}`).hostname
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${siteName} (Clone)` }),
      })
      const createData = await createRes.json()
      if (!createData.project) {
        setCloneError('Failed to create project')
        setCloning(false)
        return
      }

      setCloneStatus('AI is rebuilding the website…')

      // 3. Build a detailed prompt from the analysis
      const analysis = analyzeData.analysis
      const clonePrompt = buildClonePrompt(analysis)

      // 4. Send to AI to generate the clone
      const aiRes = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: createData.project.id,
          message: clonePrompt,
        }),
      })

      if (!aiRes.ok || !aiRes.body) {
        setCloneError('AI failed to generate the clone')
        setCloning(false)
        return
      }

      // 5. Read the stream to extract generated code
      const reader = aiRes.body.getReader()
      const decoder = new TextDecoder()
      let generatedCode = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value, { stream: true })
          .split('\n')
          .filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'preview_update') {
              generatedCode = event.code
            }
          } catch { /* skip */ }
        }
      }

      if (generatedCode) {
        // Save the generated code to the home page
        const pagesRes = await fetch(`/api/pages/${createData.project.id}`)
        const pagesData = await pagesRes.json()
        const homePage = pagesData.pages?.find((p: { isHomePage: boolean }) => p.isHomePage) ?? pagesData.pages?.[0]
        if (homePage) {
          await fetch(`/api/pages/${createData.project.id}/${homePage.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: generatedCode }),
          })
        }
      }

      // Navigate to the builder
      setCloning(false)
      setShowCloneModal(false)
      setCloneUrl('')
      router.push(`/builder/${createData.project.id}`)

    } catch (err) {
      setCloneError(err instanceof Error ? err.message : 'Something went wrong')
      setCloning(false)
    }
  }

  // Sort by most recently updated
  const sortedProjects = useMemo(() =>
    [...projects].sort((a, b) => {
      const ta = a.updatedAt ? (a.updatedAt instanceof Date ? a.updatedAt.getTime() : Number(a.updatedAt) * 1000) : 0
      const tb = b.updatedAt ? (b.updatedAt instanceof Date ? b.updatedAt.getTime() : Number(b.updatedAt) * 1000) : 0
      return tb - ta
    })
  , [projects])

  // ── Admin panel state ───────────────────────────────────────────────────────
  const isAdmin = user.role === 'admin'
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; name: string | null; email: string; role: string; credits: number; plan: string; createdAt: number | null }>>([])
  const [adminProviders, setAdminProviders] = useState<Array<{ id: string; provider: string; displayName: string; model: string | null; isDefault: boolean; isActive: boolean }>>([])
  const [loadingAdmin, setLoadingAdmin] = useState(false)
  const [editingCredits, setEditingCredits] = useState<{ id: string; value: string } | null>(null)

  async function loadAdminData() {
    setLoadingAdmin(true)
    const [usersRes, providersRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/providers'),
    ])
    if (usersRes.ok) {
      const data = await usersRes.json()
      setAdminUsers(data.users ?? [])
    }
    if (providersRes.ok) {
      const data = await providersRes.json()
      setAdminProviders(data.configs ?? [])
    }
    setLoadingAdmin(false)
  }

  function toggleAdmin() {
    if (!showAdmin) loadAdminData()
    setShowAdmin(o => !o)
  }

  async function updateUserCredits(userId: string, credits: number) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credits }),
    })
    setEditingCredits(null)
    loadAdminData()
  }

  async function updateUserRole(userId: string, role: string) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    loadAdminData()
  }

  async function updateUserPlan(userId: string, plan: string) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    loadAdminData()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">✦ Agapes AI Website</h1>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <button
              onClick={toggleAdmin}
              className={`text-sm transition-colors ${showAdmin ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              ⚡ Admin
            </button>
          )}
          <button
            onClick={() => setShowCloneModal(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            🌐 Clone Website
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse Templates
          </button>
          <span className="text-sm text-muted-foreground">{user.credits} credits · {user.plan}</span>
          <Link href="/settings/providers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            AI Settings
          </Link>
          <Link href="/settings/billing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Billing
          </Link>
          <Link href="/settings/deploy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Deploy
          </Link>
          <Link href="/settings/analytics" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Analytics
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* ── Admin Panel ──────────────────────────────────────────────────── */}
        {isAdmin && showAdmin && (
          <div className="mb-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">⚡ Admin Panel</h2>
              <button onClick={() => setShowAdmin(false)} className="text-xs text-muted-foreground hover:text-foreground">Close ✕</button>
            </div>

            {loadingAdmin ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Users table */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-secondary/30">
                    <h3 className="text-sm font-semibold text-foreground">Users ({adminUsers.length})</h3>
                  </div>
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {adminUsers.map(u => (
                      <div key={u.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{u.name || u.email}</p>
                          <p className="text-[10px] text-muted-foreground">{u.email}</p>
                        </div>
                        {/* Role */}
                        <select
                          value={u.role}
                          onChange={e => updateUserRole(u.id, e.target.value)}
                          className="text-[10px] px-1.5 py-0.5 bg-secondary border border-border rounded text-foreground"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                        {/* Plan */}
                        <select
                          value={u.plan}
                          onChange={e => updateUserPlan(u.id, e.target.value)}
                          className="text-[10px] px-1.5 py-0.5 bg-secondary border border-border rounded text-foreground"
                        >
                          <option value="free">free</option>
                          <option value="pro">pro</option>
                          <option value="enterprise">enterprise</option>
                        </select>
                        {/* Credits */}
                        {editingCredits?.id === u.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editingCredits.value}
                              onChange={e => setEditingCredits({ id: u.id, value: e.target.value })}
                              className="w-16 px-1.5 py-0.5 bg-secondary border border-border rounded text-[10px] text-foreground"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') updateUserCredits(u.id, Number(editingCredits.value)) }}
                            />
                            <button onClick={() => updateUserCredits(u.id, Number(editingCredits.value))} className="text-[10px] text-green-400 hover:text-green-300">✓</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCredits({ id: u.id, value: String(u.credits) })}
                            className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                            title="Edit credits"
                          >
                            {u.credits} cr
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Providers table */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Platform Providers ({adminProviders.length})</h3>
                    <Link href="/admin/providers" className="text-[10px] text-primary hover:underline">Manage →</Link>
                  </div>
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {adminProviders.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs text-muted-foreground">No platform providers configured.</p>
                        <Link href="/admin/providers" className="text-xs text-primary hover:underline mt-1 inline-block">+ Add Provider</Link>
                      </div>
                    ) : adminProviders.map(p => (
                      <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{p.displayName}</p>
                          <p className="text-[10px] text-muted-foreground">{p.provider} · {p.model ?? 'default'}</p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {p.isDefault && <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">Default</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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

        {sortedProjects.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center gap-6">
            <div className="text-7xl select-none">✦</div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-foreground">Build your first website</h2>
              <p className="text-muted-foreground max-w-sm text-sm">
                Describe what you want and AI generates a complete, professional website in seconds — no coding needed.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {[
                { label: 'Landing page for my SaaS startup', name: 'SaaS Landing' },
                { label: 'Portfolio to showcase my design work', name: 'Portfolio' },
                { label: 'Restaurant with online menu', name: 'Restaurant' },
                { label: 'Blog for my travel adventures', name: 'Travel Blog' },
              ].map(({ label, name }) => (
                <button
                  key={label}
                  onClick={() => { setNewName(name) }}
                  className="px-4 py-3 text-sm text-left rounded-xl border border-border hover:border-primary/40 hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all"
                >
                  "{label}"
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">or type your own project name above ↑</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedProjects.map(project => (
              <div
                key={project.id}
                onClick={() => router.push(`/builder/${project.id}`)}
                className="relative bg-card border border-border rounded-xl cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group overflow-hidden"
              >
                {/* Thumbnail preview */}
                <div className="h-40 bg-zinc-900/50 border-b border-border overflow-hidden relative">
                  {project.previewCode ? (
                    <ProjectThumbnail code={project.previewCode} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-3xl text-muted-foreground/30 select-none">✦</span>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium px-3 py-1.5 bg-primary rounded-lg transition-opacity shadow-lg">
                      Open Project →
                    </span>
                  </div>
                </div>

                {/* Card footer */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{project.name}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          project.status === 'published'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                        }`}>
                          {project.status === 'published' ? '● Live' : '○ Draft'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(project.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteProject(project.id, project.name) }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all text-xs px-1.5 py-0.5 rounded hover:bg-red-400/10"
                      title="Delete project"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {showTemplates && <TemplateGallery onClose={() => setShowTemplates(false)} />}

      {/* Clone Website Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <span>🌐</span> Clone a Website
              </h3>
              <button
                onClick={() => { setShowCloneModal(false); setCloneError(''); setCloneStatus('') }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter any website URL and AI will analyze its design, layout, and content — then recreate it as a React + Tailwind component.
              </p>
              <div>
                <input
                  type="url"
                  value={cloneUrl}
                  onChange={e => setCloneUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !cloning && handleClone()}
                  placeholder="https://example.com"
                  disabled={cloning}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  autoFocus
                />
              </div>
              {cloneError && (
                <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{cloneError}</p>
              )}
              {cloning && cloneStatus && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex gap-1">
                    {[0, 150, 300].map(delay => (
                      <span key={delay} className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </span>
                  <span>{cloneStatus}</span>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => { setShowCloneModal(false); setCloneError(''); setCloneStatus('') }}
                  disabled={cloning}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClone}
                  disabled={cloning || !cloneUrl.trim()}
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {cloning ? 'Cloning…' : 'Clone Website'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
