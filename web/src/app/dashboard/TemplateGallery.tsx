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
const CATEGORY_ICONS: Record<string, string> = {
  landing: '🚀', saas: '⚡', portfolio: '🎨', ecommerce: '🛒', dashboard: '📊', other: '📄',
}

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
    if (data.projectId) router.push(`/builder/${data.projectId}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-foreground">Start from a Template</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg">✕</button>
        </div>

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

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading templates…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">No templates yet in this category.</p>
              <p className="text-xs text-muted-foreground mt-1">Build a project and save it as a template from the builder settings.</p>
            </div>
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
                  <div className="aspect-video bg-gray-950 flex items-center justify-center">
                    <span className="text-4xl">{CATEGORY_ICONS[template.category] ?? '📄'}</span>
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-foreground text-sm">{template.name}</div>
                    {template.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{template.description}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded capitalize">{template.category}</span>
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
