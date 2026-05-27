'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  hasVercelToken: boolean
}

export default function DeployClient({ hasVercelToken }: Props) {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasToken, setHasToken] = useState(hasVercelToken)

  async function saveToken() {
    if (!token.trim()) return
    setSaving(true)
    await fetch('/api/users/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vercelToken: token }),
    })
    setSaving(false)
    setSaved(true)
    setHasToken(true)
    setToken('')
    setTimeout(() => setSaved(false), 2000)
  }

  async function removeToken() {
    await fetch('/api/users/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vercelToken: '' }),
    })
    setHasToken(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-muted-foreground hover:text-foreground text-sm transition-colors">← Dashboard</button>
        <h1 className="text-xl font-bold text-foreground">Deploy Settings</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-1">Vercel</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Deploy projects directly to Vercel. Get your token from{' '}
            <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              vercel.com/account/tokens
            </a>{' '}(full access token).
          </p>

          {hasToken ? (
            <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-sm text-foreground">Vercel token configured</span>
              </div>
              <button onClick={removeToken} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveToken()}
                placeholder="Paste your Vercel token…"
                className="flex-1 px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={saveToken}
                disabled={saving || !token.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-3">How to Deploy</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Save your Vercel token above</li>
            <li>Open any project in the builder</li>
            <li>Click the <strong className="text-foreground">▲ Deploy</strong> button in the header toolbar</li>
            <li>Your site goes live on a Vercel URL in seconds</li>
          </ol>
        </div>
      </main>
    </div>
  )
}
