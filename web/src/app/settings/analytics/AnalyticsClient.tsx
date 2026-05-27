'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Analytics {
  currentCredits: number
  plan: string
  creditsSpent30d: number
  creditsSpentTotal: number
  totalMessages: number
  projectCount: number
  recentTransactions: Array<{
    id: string
    amount: number
    type: string
    description: string
    createdAt: string | null
  }>
}

const TYPE_COLORS: Record<string, string> = {
  usage: 'text-red-400',
  purchase: 'text-green-400',
  admin: 'text-blue-400',
  refund: 'text-yellow-400',
}

export default function AnalyticsClient() {
  const router = useRouter()
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics').then(r => r.json()).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  if (!data) return null

  const stats = [
    { label: 'Credits Remaining', value: data.currentCredits.toLocaleString(), sub: data.plan + ' plan' },
    { label: 'Credits Spent (30d)', value: data.creditsSpent30d.toLocaleString(), sub: 'last 30 days' },
    { label: 'All-Time Spent', value: data.creditsSpentTotal.toLocaleString(), sub: 'since registration' },
    { label: 'AI Messages', value: data.totalMessages.toLocaleString(), sub: 'total requests sent' },
    { label: 'Projects', value: data.projectCount.toString(), sub: 'created' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-muted-foreground hover:text-foreground text-sm transition-colors">← Dashboard</button>
        <h1 className="text-xl font-bold text-foreground">Usage Analytics</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs font-medium text-foreground mt-1">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4">Recent Transactions</h2>
          {data.recentTransactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No transactions yet.</p>
          ) : (
            <div>
              {data.recentTransactions.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                      {' · '}
                      <span className={TYPE_COLORS[t.type] ?? 'text-muted-foreground'}>{t.type}</span>
                    </p>
                  </div>
                  <span className={`text-sm font-medium ml-4 shrink-0 ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.amount > 0 ? '+' : ''}{t.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
