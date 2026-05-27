'use client'
import { useState } from 'react'
import { useBuilderStore } from '@/store/builderStore'

export default function ProjectSettingsPanel() {
  const { project, customInstructions, setCustomInstructions, projectSettings, setProjectSettings } = useBuilderStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)

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

  return (
    <div className="flex flex-col gap-4">
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
    </div>
  )
}
