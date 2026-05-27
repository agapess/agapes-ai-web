'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

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
          <Link href="/settings/providers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            AI Settings
          </Link>
          <Link href="/settings/billing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Billing
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
