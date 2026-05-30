'use client'
import { useState } from 'react'

interface Props {
  pageId: string
  projectId: string
  initialTitle: string
  initialDesc: string
  onClose: () => void
}

export default function SeoPanel({ pageId, projectId, initialTitle, initialDesc, onClose }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [desc, setDesc] = useState(initialDesc)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/pages/${projectId}/${pageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seoTitle: title, seoDescription: desc }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const titleOver = title.length > 60
  const descOver = desc.length > 160

  return (
    <div className="border border-border rounded-lg overflow-hidden mt-1">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/60 border-b border-border">
        <span className="text-[10px] font-semibold text-foreground uppercase tracking-wide">SEO Settings</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs transition-colors">✕</button>
      </div>
      <div className="p-3 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-muted-foreground">Page Title</label>
            <span className={`text-[10px] ${titleOver ? 'text-red-400' : 'text-muted-foreground/50'}`}>{title.length}/60</span>
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={80}
            placeholder="My Page | Brand Name"
            className={`w-full px-2 py-1.5 bg-secondary border rounded text-xs text-foreground focus:outline-none transition-colors ${titleOver ? 'border-red-500/50 focus:border-red-400' : 'border-border focus:border-primary'}`}
          />
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Ideal: 50-60 characters</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-muted-foreground">Meta Description</label>
            <span className={`text-[10px] ${descOver ? 'text-red-400' : 'text-muted-foreground/50'}`}>{desc.length}/160</span>
          </div>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Describe this page in 1-2 sentences for search engines and social sharing."
            className={`w-full px-2 py-1.5 bg-secondary border rounded text-xs text-foreground focus:outline-none resize-none transition-colors ${descOver ? 'border-red-500/50 focus:border-red-400' : 'border-border focus:border-primary'}`}
          />
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Ideal: 120-160 characters</p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save SEO'}
        </button>
      </div>
    </div>
  )
}
