'use client'
import { useBuilderStore } from '@/store/builderStore'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function BuilderHeader() {
  const { project, previewSize, setPreviewSize, credits } = useBuilderStore()
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [deploying, setDeploying] = useState(false)

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

  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-4 bg-card shrink-0">
      <button
        onClick={() => { router.push('/dashboard'); router.refresh() }}
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

      <button
        onClick={handleDeploy}
        disabled={deploying || !project}
        className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {deploying ? 'Deploying…' : '▲ Deploy'}
      </button>
    </header>
  )
}
