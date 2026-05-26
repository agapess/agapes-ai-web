'use client'
import { useEffect, useState } from 'react'

interface ProviderConfig {
  id: string
  provider: string
  displayName: string
  baseUrl: string | null
  model: string | null
  isDefault: boolean
  isActive: boolean
  allowedPlans: string
  creditCostPerRequest: number
}

const PROVIDERS = ['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom'] as const

export default function AdminProvidersClient() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    provider: 'ollama',
    displayName: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    isDefault: false,
    allowedPlans: ['free', 'pro', 'enterprise'],
    creditCostPerRequest: 0,
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/providers')
    const data = await res.json()
    setConfigs(data.configs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    await fetch('/api/admin/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setShowForm(false)
    setForm({ provider: 'ollama', displayName: '', baseUrl: '', apiKey: '', model: '', isDefault: false, allowedPlans: ['free', 'pro', 'enterprise'], creditCostPerRequest: 0 })
    load()
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch(`/api/admin/providers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this provider?')) return
    await fetch(`/api/admin/providers/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Admin — AI Providers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add Provider
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">New Platform Provider</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Provider</label>
                <select
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
                <input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ollama (Local LAN)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Base URL</label>
                <input
                  value={form.baseUrl}
                  onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="http://192.168.1.x:11434"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">API Key (optional)</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Model</label>
                <input
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="llama3.2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Credit cost / request</label>
                <input
                  type="number"
                  min={0}
                  value={form.creditCostPerRequest}
                  onChange={e => setForm(f => ({ ...f, creditCostPerRequest: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={form.isDefault}
                onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
              />
              <label htmlFor="isDefault" className="text-sm text-foreground">Set as platform default</label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={save}
                disabled={saving || !form.displayName}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save Provider'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : configs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No platform providers configured.</p>
        ) : (
          <div className="space-y-3">
            {configs.map(cfg => (
              <div key={cfg.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">{cfg.displayName}</span>
                    {cfg.isDefault && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">default</span>}
                    {!cfg.isActive && <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">inactive</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {cfg.provider} · {cfg.model ?? 'default model'} · {cfg.creditCostPerRequest} credits/req
                  </div>
                  {cfg.baseUrl && <div className="text-xs text-muted-foreground">{cfg.baseUrl}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(cfg.id, cfg.isActive)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {cfg.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => remove(cfg.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
