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

interface Model { id: string; name: string }

const PROVIDERS = ['ollama', 'lmstudio', 'openai', 'claude', 'openrouter', 'custom'] as const
type ProviderType = typeof PROVIDERS[number]

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

function providerMeta(provider: ProviderType) {
  switch (provider) {
    case 'ollama':      return { baseUrl: 'http://localhost:11434', needsKey: false, canFetch: true }
    case 'lmstudio':   return { baseUrl: 'http://localhost:1234',  needsKey: false, canFetch: true }
    case 'openai':     return { baseUrl: '',                       needsKey: true,  canFetch: false }
    case 'claude':     return { baseUrl: '',                       needsKey: true,  canFetch: false }
    case 'openrouter': return { baseUrl: '',                       needsKey: true,  canFetch: true  }
    case 'custom':     return { baseUrl: '',                       needsKey: false, canFetch: true  }
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

const INPUT = 'w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary'
const BTN_PRIMARY = 'px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity'
const BTN_GHOST = 'px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors'

// ── Shared model selector field ───────────────────────────────────────────────
function ModelField({
  provider,
  apiKey,
  baseUrl,
  existingId,     // when editing an existing provider — use stored key endpoint
  value,
  onChange,
}: {
  provider: ProviderType
  apiKey?: string
  baseUrl?: string
  existingId?: string
  value: string
  onChange: (v: string) => void
}) {
  const meta = providerMeta(provider)
  const staticList = STATIC_MODELS[provider] ?? []
  const [models, setModels] = useState<Model[]>(staticList)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')

  // Reset to static list when provider changes
  useEffect(() => { setModels(STATIC_MODELS[provider] ?? []) }, [provider])

  async function fetchModels() {
    setFetching(true)
    setFetchError('')
    try {
      let res: Response
      if (existingId) {
        // Use stored key server-side (avoids sending key to client)
        res = await fetch(`/api/admin/providers/${existingId}/models`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apiKey || undefined, baseUrl: baseUrl || undefined }),
        })
      } else {
        res = await fetch('/api/providers/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, baseUrl: baseUrl || undefined, apiKey: apiKey || undefined }),
        })
      }
      const data = await res.json()
      if (data.models?.length) {
        setModels(data.models)
      } else {
        setFetchError('No models returned — check API key / connection')
      }
    } catch {
      setFetchError('Could not reach AI service')
    }
    setFetching(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-foreground">Model</label>
        {meta.canFetch && (
          <button type="button" onClick={fetchModels} disabled={fetching}
            className="text-xs text-primary hover:opacity-80 disabled:opacity-50 transition-opacity">
            {fetching ? 'Fetching…' : '↺ Fetch available models'}
          </button>
        )}
      </div>
      {models.length > 0 ? (
        <select value={value} onChange={e => onChange(e.target.value)} className={INPUT}>
          <option value="">— select a model —</option>
          {models.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
        </select>
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} className={INPUT}
          placeholder={meta.canFetch ? 'Click ↺ Fetch models, or type model ID manually' : 'e.g. gpt-4o'} />
      )}
      {fetchError && <p className="text-xs text-red-400 mt-1">{fetchError}</p>}
    </div>
  )
}

// ── Inline edit panel for an existing card ────────────────────────────────────
function EditPanel({
  cfg,
  onSave,
  onCancel,
}: {
  cfg: ProviderConfig
  onSave: () => void
  onCancel: () => void
}) {
  const meta = providerMeta(cfg.provider as ProviderType)
  const [displayName, setDisplayName] = useState(cfg.displayName)
  const [baseUrl, setBaseUrl] = useState(cfg.baseUrl ?? '')
  const [apiKey, setApiKey] = useState('')          // never pre-filled (stored encrypted)
  const [model, setModel] = useState(cfg.model ?? '')
  const [credits, setCredits] = useState(cfg.creditCostPerRequest)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  async function testConnection() {
    setTestStatus('testing')
    try {
      const res = await fetch('/api/providers/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: cfg.provider,
          baseUrl: baseUrl || undefined,
          apiKey: apiKey || undefined,
        }),
      })
      const data = await res.json()
      setTestStatus(data.available ? 'ok' : 'fail')
    } catch { setTestStatus('fail') }
  }

  async function save() {
    setSaving(true)
    const body: Record<string, unknown> = { displayName, model, creditCostPerRequest: credits }
    if (baseUrl) body.baseUrl = baseUrl
    if (apiKey)  body.apiKey = apiKey   // only send if user typed a new one
    await fetch(`/api/admin/providers/${cfg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    onSave()
  }

  const showBaseUrl = !['openai', 'claude', 'openrouter'].includes(cfg.provider)

  return (
    <div className="mt-4 border-t border-border pt-4 space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={INPUT} />
      </div>

      {/* Base URL */}
      {showBaseUrl && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Base URL</label>
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className={INPUT}
            placeholder="http://192.168.x.x:11434" />
        </div>
      )}

      {/* API key */}
      {meta.needsKey && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            API Key <span className="text-muted-foreground/60">(leave blank to keep existing)</span>
          </label>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className={INPUT}
            placeholder="sk-… (leave blank to keep existing)" />
        </div>
      )}

      {/* Model — can fetch using stored key */}
      <ModelField
        provider={cfg.provider as ProviderType}
        apiKey={apiKey || undefined}
        baseUrl={baseUrl || undefined}
        existingId={cfg.id}
        value={model}
        onChange={setModel}
      />

      {/* Credits */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Credits / request</label>
        <input type="number" min={0} value={credits} onChange={e => setCredits(parseInt(e.target.value) || 0)} className={INPUT} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button type="button" onClick={testConnection} disabled={testStatus === 'testing'}
          className="px-3 py-1.5 bg-secondary border border-border text-foreground rounded-md text-xs hover:bg-accent disabled:opacity-50 transition-colors">
          {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
        </button>
        {testStatus === 'ok'   && <span className="text-xs text-green-400 font-medium">✓ Connected</span>}
        {testStatus === 'fail' && <span className="text-xs text-red-400 font-medium">✗ Unreachable</span>}
        <div className="flex-1" />
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        <button onClick={save} disabled={saving}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [editingId, setEditingId] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/admin/providers')
    const data = await res.json()
    setConfigs(data.configs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleProviderChange(provider: ProviderType) {
    const meta = providerMeta(provider)
    setForm(f => ({ ...f, provider, baseUrl: meta.baseUrl, apiKey: '', model: '' }))
    setTestStatus('idle')
  }

  async function testNewConnection() {
    setTestStatus('testing')
    try {
      const res = await fetch('/api/providers/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: form.provider, baseUrl: form.baseUrl || undefined, apiKey: form.apiKey || undefined }),
      })
      const data = await res.json()
      setTestStatus(data.available ? 'ok' : 'fail')
    } catch { setTestStatus('fail') }
  }

  async function saveNew() {
    setSaving(true)
    await fetch('/api/admin/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
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

  const newMeta = providerMeta(form.provider)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Admin — AI Providers</h1>
        <button onClick={() => { setShowForm(!showForm); setTestStatus('idle') }}
          className={BTN_PRIMARY}>
          {showForm ? 'Cancel' : '+ Add Provider'}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* ── Add new provider form ─────────────────────────────────────── */}
        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-5">
            <h2 className="text-lg font-semibold text-foreground">New Platform Provider</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Provider</label>
                <select value={form.provider} onChange={e => handleProviderChange(e.target.value as ProviderType)} className={INPUT}>
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
                <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className={INPUT} placeholder="e.g. OpenRouter (Main)" />
              </div>
            </div>

            {!['openai', 'claude', 'openrouter'].includes(form.provider) && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Base URL</label>
                <input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                  className={INPUT} placeholder="http://192.168.x.x:11434" />
              </div>
            )}

            {newMeta.needsKey && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">API Key</label>
                <input type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  className={INPUT} placeholder="sk-or-…" />
              </div>
            )}

            <ModelField
              provider={form.provider}
              apiKey={form.apiKey || undefined}
              baseUrl={form.baseUrl || undefined}
              value={form.model}
              onChange={v => setForm(f => ({ ...f, model: v }))}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Credits / request</label>
                <input type="number" min={0} value={form.creditCostPerRequest}
                  onChange={e => setForm(f => ({ ...f, creditCostPerRequest: parseInt(e.target.value) || 0 }))}
                  className={INPUT} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={form.isDefault}
                    onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
                  Set as platform default
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1 border-t border-border">
              <button type="button" onClick={testNewConnection} disabled={testStatus === 'testing'}
                className="px-3 py-2 bg-secondary border border-border text-foreground rounded-md text-sm hover:bg-accent disabled:opacity-50 transition-colors">
                {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
              </button>
              {testStatus === 'ok'   && <span className="text-sm text-green-400 font-medium">✓ Connected</span>}
              {testStatus === 'fail' && <span className="text-sm text-red-400 font-medium">✗ Unreachable</span>}
              <div className="flex-1" />
              <button onClick={() => { setShowForm(false); setForm(emptyForm); setTestStatus('idle') }} className={BTN_GHOST}>Cancel</button>
              <button onClick={saveNew} disabled={saving || !form.displayName || (newMeta.needsKey && !form.apiKey)}
                className={BTN_PRIMARY}>
                {saving ? 'Saving…' : 'Save Provider'}
              </button>
            </div>
          </div>
        )}

        {/* ── Provider cards ────────────────────────────────────────────── */}
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : configs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No platform providers configured.</p>
        ) : (
          <div className="space-y-3">
            {configs.map(cfg => (
              <div key={cfg.id}
                className={`bg-card border rounded-lg p-4 transition-colors ${cfg.isDefault && cfg.isActive ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border'}`}>

                {/* Card header row */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground text-sm">{cfg.displayName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${PROVIDER_COLORS[cfg.provider] ?? 'bg-gray-500/20 text-gray-300'}`}>
                        {cfg.provider}
                      </span>
                      {cfg.isDefault && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-medium">✓ default</span>}
                      {!cfg.isActive && <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">inactive</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      {cfg.model
                        ? <span className="font-mono bg-secondary px-1.5 py-0.5 rounded">{cfg.model}</span>
                        : <span className="italic text-red-400/80">no model set — click Edit</span>}
                      <span>·</span>
                      <span>{cfg.creditCostPerRequest} credits/req</span>
                      {cfg.baseUrl && <span className="truncate max-w-[200px] text-muted-foreground/60">{cfg.baseUrl}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    {!cfg.isDefault && (
                      <button onClick={() => setDefault(cfg.id)}
                        className="text-xs text-primary hover:opacity-80 transition-opacity font-medium"
                        title="Make this the default provider">
                        ★ Set Default
                      </button>
                    )}
                    <button
                      onClick={() => setEditingId(editingId === cfg.id ? null : cfg.id)}
                      className={`text-xs transition-colors font-medium ${editingId === cfg.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                      {editingId === cfg.id ? 'Close' : '✎ Edit'}
                    </button>
                    <button onClick={() => toggle(cfg.id, cfg.isActive)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {cfg.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => remove(cfg.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Inline edit panel */}
                {editingId === cfg.id && (
                  <EditPanel
                    cfg={cfg}
                    onSave={() => { setEditingId(null); load() }}
                    onCancel={() => setEditingId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
