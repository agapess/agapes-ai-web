'use client'
import { useState, useEffect } from 'react'
import { useBuilderStore } from '@/store/builderStore'

interface Submission {
  id: string
  data: Record<string, string>
  submittedAt: number
  pageId: string | null
}

export default function ProjectSettingsPanel() {
  const { project, customInstructions, setCustomInstructions, projectSettings, setProjectSettings } = useBuilderStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [showSubs, setShowSubs] = useState(false)

  // Load form submissions when panel opens
  useEffect(() => {
    if (!project || !showSubs) return
    setSubsLoading(true)
    fetch(`/api/contact/${project.id}`)
      .then(r => r.json())
      .then(d => setSubmissions(d.submissions ?? []))
      .catch(() => {})
      .finally(() => setSubsLoading(false))
  }, [project, showSubs])

  async function save() {
    if (!project) return
    setSaving(true)
    const newSettings = { ...projectSettings, customInstructions }
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: newSettings }),
    })
    setProjectSettings(newSettings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveAsTemplate() {
    if (!project || !templateName.trim()) return
    setSavingTemplate(true)
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, name: templateName, isPublic: true }),
    })
    setSavingTemplate(false)
    setTemplateSaved(true)
    setTemplateName('')
    setTimeout(() => setTemplateSaved(false), 2000)
  }

  function exportSubmissionsCSV() {
    if (submissions.length === 0) return
    // Collect all field keys
    const keys = Array.from(new Set(submissions.flatMap(s => Object.keys(s.data ?? {}))))
    const header = ['Submitted At', ...keys].join(',')
    const rows = submissions.map(s => {
      const date = new Date((s.submittedAt ?? 0) * 1000).toLocaleString()
      const values = keys.map(k => `"${(s.data?.[k] ?? '').replace(/"/g, '""')}"`)
      return [date, ...values].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project?.name ?? 'submissions'}-forms.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Custom AI Instructions */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Custom AI Instructions</label>
        <p className="text-xs text-muted-foreground mb-2">Added to every AI request for this project.</p>
        <textarea
          value={customInstructions}
          onChange={e => setCustomInstructions(e.target.value)}
          rows={6}
          placeholder="e.g. Always use dark background. Brand color is #6366f1. Use Inter font."
          className="w-full px-2 py-2 bg-secondary border border-border rounded text-foreground text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder-muted-foreground"
        />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Instructions'}
      </button>

      {/* Save as Template */}
      <div className="border-t border-border pt-3">
        <label className="block text-xs font-medium text-foreground mb-1.5">Save as Template</label>
        <p className="text-xs text-muted-foreground mb-2">Share this project as a reusable template.</p>
        <div className="flex gap-1">
          <input
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            placeholder="Template name"
            className="flex-1 px-2 py-1 bg-secondary border border-border rounded text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={saveAsTemplate}
            disabled={savingTemplate || !templateName.trim()}
            className="px-2 py-1 bg-secondary border border-border text-foreground rounded text-xs hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {templateSaved ? '✓' : savingTemplate ? '…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Form Submissions */}
      <div className="border-t border-border pt-3">
        <button
          onClick={() => setShowSubs(o => !o)}
          className="flex items-center justify-between w-full text-xs font-medium text-foreground hover:text-primary transition-colors"
        >
          <span>📬 Form Submissions {submissions.length > 0 ? `(${submissions.length})` : ''}</span>
          <span className="text-muted-foreground text-[10px]">{showSubs ? '▲' : '▼'}</span>
        </button>

        {showSubs && (
          <div className="mt-2 space-y-2">
            {subsLoading ? (
              <p className="text-[10px] text-muted-foreground text-center py-3">Loading…</p>
            ) : submissions.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-[10px] text-muted-foreground">No submissions yet.</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Contact forms on your published site save here automatically.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
                  <button
                    onClick={exportSubmissionsCSV}
                    className="text-[10px] px-2 py-0.5 bg-secondary border border-border rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {submissions.map(sub => (
                    <div key={sub.id} className="bg-secondary/50 border border-border rounded-lg p-2.5 text-[10px]">
                      <p className="text-muted-foreground mb-1.5">
                        {new Date((sub.submittedAt ?? 0) * 1000).toLocaleString()}
                      </p>
                      {Object.entries(sub.data ?? {}).map(([k, v]) => (
                        <div key={k} className="flex gap-1.5 mb-1">
                          <span className="text-muted-foreground font-medium shrink-0 capitalize">{k}:</span>
                          <span className="text-foreground truncate">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
