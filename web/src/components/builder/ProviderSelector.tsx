'use client'
import { useState, useRef, useEffect } from 'react'
import { useBuilderStore, type ProviderOption } from '@/store/builderStore'

const PROVIDER_ICONS: Record<string, string> = {
  openai: '◎',
  claude: '◈',
  gemini: '◇',
  openrouter: '⬡',
  ollama: '○',
  lmstudio: '⬢',
  custom: '⚙',
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'text-green-400',
  claude: 'text-orange-400',
  gemini: 'text-blue-400',
  openrouter: 'text-purple-400',
  ollama: 'text-cyan-400',
  lmstudio: 'text-yellow-400',
  custom: 'text-zinc-400',
}

export default function ProviderSelector() {
  const { providers, selectedProviderId, setSelectedProviderId, setProviders } = useBuilderStore()
  const [open, setOpen] = useState(false)
  const [showAddKey, setShowAddKey] = useState(false)
  const [addForm, setAddForm] = useState({ provider: 'openrouter', displayName: '', apiKey: '', model: '', baseUrl: '' })
  const [saving, setSaving] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Load providers on mount
  useEffect(() => {
    fetch('/api/providers')
      .then(r => r.json())
      .then(data => setProviders(data.configs ?? []))
      .catch(() => {})
  }, [setProviders])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowAddKey(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = providers.find(p => p.id === selectedProviderId)
  const label = selected ? `${selected.displayName}` : 'Auto'
  const icon = selected ? PROVIDER_ICONS[selected.provider] ?? '⚙' : '✦'
  const color = selected ? PROVIDER_COLORS[selected.provider] ?? 'text-zinc-400' : 'text-primary'

  async function handleAddKey() {
    if (!addForm.displayName || !addForm.apiKey) return
    setSaving(true)
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          isDefault: providers.length === 0,
          allowedPlans: ['free', 'pro', 'enterprise'],
        }),
      })
      if (res.ok) {
        const { id } = await res.json()
        // Reload providers
        const listRes = await fetch('/api/providers')
        const data = await listRes.json()
        setProviders(data.configs ?? [])
        setSelectedProviderId(id)
        setShowAddKey(false)
        setAddForm({ provider: 'openrouter', displayName: '', apiKey: '', model: '', baseUrl: '' })
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleRemove(id: string) {
    await fetch(`/api/providers/${id}`, { method: 'DELETE' })
    const listRes = await fetch('/api/providers')
    const data = await listRes.json()
    setProviders(data.configs ?? [])
    if (selectedProviderId === id) setSelectedProviderId('')
  }

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs hover:bg-white/5 transition-colors border border-transparent hover:border-border"
        title="Select AI provider"
      >
        <span className={color}>{icon}</span>
        <span className="text-muted-foreground max-w-[80px] truncate">{label}</span>
        <span className="text-muted-foreground/50 text-[10px]">▼</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-64 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Provider list */}
          <div className="p-2 border-b border-border">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-2 py-1">AI Provider</p>
            {/* Auto option */}
            <button
              onClick={() => { setSelectedProviderId(''); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-xs transition-colors ${
                !selectedProviderId ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'
              }`}
            >
              <span className="text-primary">✦</span>
              <span className="flex-1">Auto (platform default)</span>
              {!selectedProviderId && <span className="text-primary text-[10px]">●</span>}
            </button>

            {providers.map(p => (
              <div key={p.id} className="group flex items-center">
                <button
                  onClick={() => { setSelectedProviderId(p.id); setOpen(false) }}
                  className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-left text-xs transition-colors ${
                    selectedProviderId === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  <span className={PROVIDER_COLORS[p.provider] ?? 'text-zinc-400'}>{PROVIDER_ICONS[p.provider] ?? '⚙'}</span>
                  <span className="flex-1 truncate">{p.displayName}</span>
                  <span className="text-[10px] text-muted-foreground">{p.model ?? p.provider}</span>
                  {selectedProviderId === p.id && <span className="text-primary text-[10px]">●</span>}
                </button>
                <button
                  onClick={() => handleRemove(p.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs px-1.5 transition-opacity"
                  title="Remove"
                >×</button>
              </div>
            ))}
          </div>

          {/* Add key section */}
          {!showAddKey ? (
            <button
              onClick={() => setShowAddKey(true)}
              className="w-full px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors text-left flex items-center gap-2"
            >
              <span>+</span> Add API Key
            </button>
          ) : (
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={addForm.provider}
                  onChange={e => setAddForm(f => ({ ...f, provider: e.target.value }))}
                  className="px-2 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                  <option value="gemini">Gemini</option>
                  <option value="ollama">Ollama</option>
                  <option value="lmstudio">LM Studio</option>
                  <option value="custom">Custom</option>
                </select>
                <input
                  value={addForm.displayName}
                  onChange={e => setAddForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder="Name"
                  className="px-2 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <input
                type="password"
                value={addForm.apiKey}
                onChange={e => setAddForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder="API Key (sk-...)"
                className="w-full px-2 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={addForm.model}
                  onChange={e => setAddForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="Model (optional)"
                  className="px-2 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={addForm.baseUrl}
                  onChange={e => setAddForm(f => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="Base URL (optional)"
                  className="px-2 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowAddKey(false)} className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">Cancel</button>
                <button
                  onClick={handleAddKey}
                  disabled={saving || !addForm.displayName || !addForm.apiKey}
                  className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-[10px] font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? '…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
