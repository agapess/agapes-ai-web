'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import TemplateGallery from './TemplateGallery'

interface Project {
  id: string
  name: string
  status: string
  createdAt: Date | null
}

interface Props {
  initialProjects: Project[]
  user: { id: string; name: string | null; email: string; credits: number; plan: string }
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">✦ Agapes AI Website</h1>
        <div className="flex items-center gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => router.push(`/builder/${project.id}`)}
                className="relative p-4 bg-card border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors group"
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
          </div>
        )}
      </main>
      {showTemplates && <TemplateGallery onClose={() => setShowTemplates(false)} />}
    </div>
  )
}
