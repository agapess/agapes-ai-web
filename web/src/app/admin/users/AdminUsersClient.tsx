'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  plan: string
  credits: number
}

interface Props {
  currentUserId: string
}

export default function AdminUsersClient({ currentUserId }: Props) {
  const [userList, setUserList] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUserList(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function adjustCredits(userId: string) {
    const amount = parseInt(creditAmount, 10)
    if (isNaN(amount) || amount === 0) return
    setSaving(true)
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creditAdjustment: amount, creditReason: creditReason || undefined }),
    })
    setSaving(false)
    setCreditAmount('')
    setCreditReason('')
    setEditingId(null)
    load()
  }

  async function updateRole(userId: string, role: string) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    load()
  }

  async function updatePlan(userId: string, plan: string) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    load()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Link href="/admin/providers" className="text-muted-foreground hover:text-foreground text-sm transition-colors">← Providers</Link>
        <h1 className="text-xl font-bold text-foreground">Admin — Users</h1>
        <span className="ml-auto text-sm text-muted-foreground">{userList.length} users</span>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <div className="space-y-2">
            {userList.map(user => (
              <div key={user.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground text-sm truncate">{user.email}</span>
                      {user.name && <span className="text-xs text-muted-foreground">({user.name})</span>}
                      {user.id === currentUserId && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">you</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{user.credits} credits</span>
                      <select
                        value={user.role}
                        onChange={e => updateRole(user.id, e.target.value)}
                        disabled={user.id === currentUserId}
                        className="text-xs bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                      <select
                        value={user.plan}
                        onChange={e => updatePlan(user.id, e.target.value)}
                        className="text-xs bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none"
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                        <option value="enterprise">enterprise</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingId(editingId === user.id ? null : user.id)}
                    className="text-xs text-primary hover:opacity-80 transition-opacity"
                  >
                    Adjust Credits
                  </button>
                </div>

                {editingId === user.id && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      value={creditAmount}
                      onChange={e => setCreditAmount(e.target.value)}
                      placeholder="±amount"
                      className="w-24 px-2 py-1 bg-secondary border border-border rounded text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      value={creditReason}
                      onChange={e => setCreditReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="flex-1 min-w-32 px-2 py-1 bg-secondary border border-border rounded text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => adjustCredits(user.id)}
                      disabled={saving || !creditAmount}
                      className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {saving ? '…' : 'Apply'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
