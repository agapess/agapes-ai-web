'use client'
import { useState, useEffect } from 'react'
import { useBuilderStore } from '@/store/builderStore'

interface HistoryEntry {
  id: string
  description: string
  createdAt: number
  snapshot: { pageId?: string; content?: string } | string
}

interface Props {
  onClose: () => void
}

export default function HistoryPanel({ onClose }: Props) {
  const { project, activePage, setPreviewCode, updatePageContent, setSaveStatus } = useBuilderStore()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    if (!project) return
    fetch(`/api/history/${project.id}`)
      .then(r => r.json())
      .then(d => setEntries(d.history ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [project])

  async function restore(entry: HistoryEntry) {
    if (!project || !activePage) return
    // Snapshot stores { pageId, content } as JSON
    const snap = typeof entry.snapshot === 'string' ? JSON.parse(entry.snapshot) : entry.snapshot
    const content = snap?.content as string | undefined
    if (!content) return

    setRestoring(entry.id)
    setPreviewCode(content)
    updatePageContent(activePage.id, content)
    setSaveStatus('saving')
    try {
      await fetch(`/api/pages/${project.id}/${activePage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
    setRestoring(null)
    onClose()
  }

  function formatDate(ts: number): string {
    const d = new Date(ts * 1000)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="absolute top-10 right-0 z-50 w-80 bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <p className="text-sm font-semibold text-foreground">Version History</p>
          <p className="text-[10px] text-muted-foreground">Saved after each AI generation</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">×</button>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <p className="text-xs text-center text-muted-foreground py-8">Loading history…</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-2xl mb-2">⏱</p>
            <p className="text-xs text-muted-foreground">No history yet.</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">AI generations are automatically saved here so you can roll back.</p>
          </div>
        ) : (
          entries.map((entry, i) => (
            <div key={entry.id} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
              <div className="flex-1 min-w-0">
                {i === 0 && (
                  <span className="inline-block text-[10px] text-green-400 font-semibold bg-green-900/30 px-1.5 py-0.5 rounded mb-1">
                    Current
                  </span>
                )}
                <p className="text-xs text-foreground truncate leading-relaxed">{entry.description || 'AI generation'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(entry.createdAt)}</p>
              </div>
              {i > 0 && (
                <button
                  onClick={() => restore(entry)}
                  disabled={restoring === entry.id}
                  className="shrink-0 px-2.5 py-1 bg-secondary hover:bg-accent border border-border text-foreground rounded text-[10px] font-medium disabled:opacity-50 transition-colors"
                >
                  {restoring === entry.id ? '↻' : 'Restore'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
