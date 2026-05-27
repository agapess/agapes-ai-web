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
      const newPage = { ...data.page, content: '' }
      setNewName('')
      setPages([...pages, newPage])
      setActivePage(newPage)
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
          {!page.isHomePage ? (
            <button
              onClick={e => { e.stopPropagation(); deletePage(page.id) }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 text-xs transition-opacity ml-1"
            >
              ✕
            </button>
          ) : (
            <span className="text-xs text-muted-foreground ml-1">home</span>
          )}
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
