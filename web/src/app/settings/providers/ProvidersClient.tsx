'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProviderConfig {
  id: string
  provider: string
  displayName: string
  baseUrl: string | null
  model: string | null
  isDefault: boolean
  isActive: boolean
}

const PROVIDERS = ['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom'] as const

interface Props {
  user: { name: string | null; email: string; credits: number; plan: string }
}

export default function ProvidersClient({ user }: Props) {
  const router = useRouter()
  const [configs, setConfigs] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    provider: 'openai',
    displayName: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    isDefault: false,
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/providers')
    const data = await res.json()
    setConfigs(data.configs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, allowedPlans: ['free', 'pro', 'enterprise'] }),
    })
    setSaving(false)
    setShowForm(false)
    setForm({ provider: 'openai', displayName: '', baseUrl: '', apiKey: '', model: '', isDefault: false })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this provider?')) return
    await fetch(`/api/providers/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          ← Dashboard
        </button>
        <h1 className="text-xl font-bold text-foreground">My AI Providers</h1>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user.credits} credits · {user.plan}</span>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add Key
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <p className="text-sm text-muted-foreground">
          Add your own API keys to use your own LLM quota. If none are configured, platform providers are used automatically.
        </p>

        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Add API Key</h2>
            <div className="grid grid-cols-2 gap-3">
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
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="My OpenAI"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">API Key</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Base URL (optional)</label>
                <input
                  value={form.baseUrl}
                  onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://api.openai.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Model</label>
                <input
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="gpt-4o-mini"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={save}
                disabled={saving || !form.displayName || !form.apiKey}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No personal providers added.</p>
            <p className="text-xs mt-1">Platform providers are used by default.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map(cfg => (
              <div key={cfg.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">{cfg.displayName}</span>
                    {cfg.isDefault && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">default</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{cfg.provider} · {cfg.model ?? 'default model'}</div>
                </div>
                <button onClick={() => remove(cfg.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
