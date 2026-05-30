'use client'
import { useBuilderStore } from '@/store/builderStore'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import HistoryPanel from './HistoryPanel'

export default function BuilderHeader() {
  const { project, previewSize, setPreviewSize, credits, saveStatus } = useBuilderStore()
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(project?.status === 'published')
  const [showCopyUrl, setShowCopyUrl] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Sync published state when project loads
  if (project && project.status === 'published' && !published) setPublished(true)
  if (project && project.status !== 'published' && published && !publishing) setPublished(false)

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

  async function handleDeploy() {
    if (!project) return
    setDeploying(true)
    const res = await fetch(`/api/deploy/vercel/${project.id}`, { method: 'POST' })
    const data = await res.json()
    setDeploying(false)
    if (data.url) {
      window.open(data.url, '_blank')
    } else {
      alert(data.error ?? 'Deploy failed. Check Settings → Deploy for Vercel token.')
    }
  }

  async function handlePublish() {
    if (!project) return
    setPublishing(true)
    const newStatus = published ? 'draft' : 'published'
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setPublished(!published)
    if (!published) setShowCopyUrl(true)
    setPublishing(false)
  }

  const siteUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${project?.slug}` : ''

  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-3 bg-card shrink-0">
      <button
        onClick={() => { router.push('/dashboard'); router.refresh() }}
        className="text-muted-foreground hover:text-foreground transition-colors text-sm shrink-0"
      >
        ← Dashboard
      </button>

      <span className="text-foreground font-medium text-sm truncate max-w-[180px]">
        {project?.name ?? 'Loading…'}
      </span>

      {/* Autosave status */}
      {saveStatus !== 'idle' && (
        <span className={`text-xs shrink-0 ${
          saveStatus === 'saving' ? 'text-muted-foreground animate-pulse'
          : saveStatus === 'saved' ? 'text-green-400'
          : 'text-red-400'
        }`}>
          {saveStatus === 'saving' ? '↻ Saving…' : saveStatus === 'saved' ? '✓ Saved' : '⚠ Save failed'}
        </span>
      )}

      <span className="text-xs text-muted-foreground shrink-0 ml-auto">
        {credits} credits
      </span>

      {/* History */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowHistory(o => !o)}
          className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
            showHistory ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
          title="Version history"
        >
          ⏱ History
        </button>
        {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
      </div>

      <button
        onClick={handleExport}
        disabled={exporting || !project}
        className="px-2.5 py-1.5 bg-secondary text-foreground border border-border rounded text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors shrink-0"
      >
        {exporting ? '…' : '↓ Export'}
      </button>

      <button
        onClick={handleDeploy}
        disabled={deploying || !project}
        className="px-2.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
      >
        {deploying ? '…' : '▲ Deploy'}
      </button>

      {/* Publish */}
      <div className="relative shrink-0">
        <button
          onClick={handlePublish}
          disabled={publishing || !project}
          className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
            published
              ? 'bg-green-700 hover:bg-green-600 text-white'
              : 'bg-primary text-primary-foreground hover:opacity-90'
          }`}
        >
          {publishing ? '…' : published ? '🌐 Published' : '🚀 Publish'}
        </button>

        {/* Copy URL popover */}
        {showCopyUrl && published && (
          <div className="absolute top-10 right-0 z-50 bg-card border border-border rounded-xl p-4 shadow-2xl w-72">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">🎉 Your site is live!</p>
              <button onClick={() => setShowCopyUrl(false)} className="text-muted-foreground hover:text-foreground text-sm">×</button>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Share this URL with anyone:</p>
            <div className="flex gap-1.5">
              <input
                readOnly
                value={siteUrl}
                className="flex-1 px-2 py-1.5 bg-secondary rounded text-xs text-foreground focus:outline-none font-mono"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(siteUrl); setShowCopyUrl(false) }}
                className="px-2.5 py-1.5 bg-primary text-white rounded text-xs font-medium hover:opacity-90 transition-opacity"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => window.open(siteUrl, '_blank')}
              className="mt-2 w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Open in new tab →
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
