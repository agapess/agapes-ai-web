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

interface Model {
  id: string
  name: string
}

const PROVIDERS = ['ollama', 'lmstudio', 'openai', 'claude', 'openrouter', 'custom'] as const
type ProviderType = typeof PROVIDERS[number]

// Hardcoded fallback model lists for providers that don't need live fetch
const STATIC_MODELS: Partial<Record<ProviderType, Model[]>> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  claude: [
    { id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
  ],
}

function getProviderDefaults(provider: ProviderType) {
  switch (provider) {
    case 'ollama':    return { baseUrl: 'http://localhost:11434', needsKey: false }
    case 'lmstudio': return { baseUrl: 'http://localhost:1234',  needsKey: false }
    case 'openai':   return { baseUrl: '',                       needsKey: true  }
    case 'claude':   return { baseUrl: '',                       needsKey: true  }
    case 'openrouter': return { baseUrl: '',                     needsKey: true  }
    case 'custom':   return { baseUrl: '',                       needsKey: false }
  }
}

const PROVIDER_COLORS: Record<string, string> = {
  ollama:     'bg-purple-500/20 text-purple-300',
  lmstudio:   'bg-blue-500/20 text-blue-300',
  openai:     'bg-green-500/20 text-green-300',
  claude:     'bg-orange-500/20 text-orange-300',
  openrouter: 'bg-pink-500/20 text-pink-300',
  custom:     'bg-gray-500/20 text-gray-300',
}

const emptyForm = {
  provider: 'ollama' as ProviderType,
  displayName: '',
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  model: '',
  isDefault: false,
  allowedPlans: ['free', 'pro', 'enterprise'],
  creditCostPerRequest: 0,
}

export default function AdminProvidersClient() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  async function load() {
    const res = await fetch('/api/admin/providers')
    const data = await res.json()
    setConfigs(data.configs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleProviderChange(provider: ProviderType) {
    const defaults = getProviderDefaults(provider)
    setForm(f => ({ ...f, provider, baseUrl: defaults.baseUrl, apiKey: '', model: '' }))
    setModels(STATIC_MODELS[provider] ?? [])
    setTestStatus('idle')
  }

  async function fetchModels() {
    setFetchingModels(true)
    try {
      const res = await fetch('/api/providers/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: form.provider,
          baseUrl: form.baseUrl || undefined,
          apiKey: form.apiKey || undefined,
        }),
      })
      const data = await res.json()
      if (data.models?.length) setModels(data.models)
    } catch { /* ignore */ }
    setFetchingModels(false)
  }

  async function testConnection() {
    setTestStatus('testing')
    try {
      const res = await fetch('/api/providers/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: form.provider,
          baseUrl: form.baseUrl || undefined,
          apiKey: form.apiKey || undefined,
        }),
      })
      const data = await res.json()
      setTestStatus(data.available ? 'ok' : 'fail')
    } catch {
      setTestStatus('fail')
    }
  }

  async function save() {
    setSaving(true)
    await fetch('/api/admin/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    setModels([])
    setTestStatus('idle')
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

  async function setDefault(id: string) {
    await fetch(`/api/admin/providers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this provider?')) return
    await fetch(`/api/admin/providers/${id}`, { method: 'DELETE' })
    load()
  }

  const needsKey = getProviderDefaults(form.provider).needsKey
  const showBaseUrl = !['openai', 'claude', 'openrouter'].includes(form.provider)
  const canFetchModels = ['ollama', 'lmstudio', 'custom'].includes(form.provider)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Admin — AI Providers</h1>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setModels(STATIC_MODELS['ollama'] ?? [])
            setTestStatus('idle')
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showForm ? 'Cancel' : '+ Add Provider'}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-5">
            <h2 className="text-lg font-semibold text-foreground">New Platform Provider</h2>

            {/* Provider + Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Provider</label>
                <select
                  value={form.provider}
                  onChange={e => handleProviderChange(e.target.value as ProviderType)}
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
                  placeholder="e.g. My Ollama (Local)"
                />
              </div>
            </div>

            {/* Base URL */}
            {showBaseUrl && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Base URL</label>
                <input
                  value={form.baseUrl}
                  onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="http://192.168.x.x:11434"
                />
              </div>
            )}

            {/* API Key */}
            {needsKey && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">API Key</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="sk-..."
                />
              </div>
            )}

            {/* Model */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-foreground">Model</label>
                {canFetchModels && (
                  <button
                    type="button"
                    onClick={fetchModels}
                    disabled={fetchingModels}
                    className="text-xs text-primary hover:opacity-80 disabled:opacity-50 transition-opacity"
                  >
                    {fetchingModels ? 'Fetching…' : '↺ Fetch Models'}
                  </button>
                )}
              </div>
              {models.length > 0 ? (
                <select
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— select a model —</option>
                  {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              ) : (
                <input
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={canFetchModels ? 'Click ↺ Fetch Models or type manually' : 'e.g. gpt-4o'}
                />
              )}
            </div>

            {/* Credits + default */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Credits / request</label>
                <input
                  type="number"
                  min={0}
                  value={form.creditCostPerRequest}
                  onChange={e => setForm(f => ({ ...f, creditCostPerRequest: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                    className="rounded"
                  />
                  Set as platform default
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1 border-t border-border">
              <button
                type="button"
                onClick={testConnection}
                disabled={testStatus === 'testing' || !form.provider}
                className="px-3 py-2 bg-secondary border border-border text-foreground rounded-md text-sm hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
              </button>
              {testStatus === 'ok'   && <span className="text-sm text-green-400 font-medium">✓ Connected</span>}
              {testStatus === 'fail' && <span className="text-sm text-red-400 font-medium">✗ Unreachable</span>}

              <div className="flex-1" />

              <button
                onClick={() => { setShowForm(false); setForm(emptyForm); setModels([]); setTestStatus('idle') }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.displayName || (needsKey && !form.apiKey)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save Provider'}
              </button>
            </div>
          </div>
        )}

        {/* Provider list */}
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : configs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No platform providers configured.</p>
        ) : (
          <div className="space-y-3">
            {configs.map(cfg => (
              <div key={cfg.id} className={`bg-card border rounded-lg p-4 flex items-center justify-between transition-colors ${cfg.isDefault && cfg.isActive ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">{cfg.displayName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${PROVIDER_COLORS[cfg.provider] ?? 'bg-gray-500/20 text-gray-300'}`}>
                      {cfg.provider}
                    </span>
                    {cfg.isDefault && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">default</span>}
                    {!cfg.isActive && <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">inactive</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {cfg.model
                      ? <span className="font-mono">{cfg.model}</span>
                      : <span className="italic">no model set</span>}
                    {' · '}{cfg.creditCostPerRequest} credits/req
                  </div>
                  {cfg.baseUrl && (
                    <div className="text-xs text-muted-foreground truncate max-w-xs">{cfg.baseUrl}</div>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {!cfg.isDefault && (
                    <button
                      onClick={() => setDefault(cfg.id)}
                      className="text-xs text-primary hover:opacity-80 transition-opacity font-medium"
                      title="Make this the default provider for all users"
                    >
                      ★ Set Default
                    </button>
                  )}
                  <button
                    onClick={() => toggle(cfg.id, cfg.isActive)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {cfg.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => remove(cfg.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
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
