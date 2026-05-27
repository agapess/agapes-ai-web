'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CreditPack, Plan } from '@/lib/plans'

interface Props {
  credits: number
  currentPlan: string
  hasStripeCustomer: boolean
  subscriptionStatus: string | null
  subscriptionEnd: string | null
  stripeEnabled: boolean
  creditPacks: CreditPack[]
  plans: Plan[]
}

export default function BillingClient({
  credits,
  currentPlan,
  hasStripeCustomer,
  subscriptionStatus,
  subscriptionEnd,
  stripeEnabled,
  creditPacks,
  plans,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function buyPack(packId: string) {
    setLoading(`pack-${packId}`)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pack', packId }),
    })
    const data = await res.json()
    setLoading(null)
    if (data.url) window.location.href = data.url
  }

  async function subscribe(planId: string) {
    setLoading(`sub-${planId}`)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'subscription', planId }),
    })
    const data = await res.json()
    setLoading(null)
    if (data.url) window.location.href = data.url
  }

  async function openPortal() {
    setLoading('portal')
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    setLoading(null)
    if (data.url) window.location.href = data.url
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-muted-foreground hover:text-foreground text-sm transition-colors">← Dashboard</button>
        <h1 className="text-xl font-bold text-foreground">Billing & Credits</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Current status */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-4">Current Status</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold text-foreground">{credits}</div>
              <div className="text-xs text-muted-foreground mt-1">Credits remaining</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground capitalize">{currentPlan}</div>
              <div className="text-xs text-muted-foreground mt-1">Current plan</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{subscriptionStatus ?? '—'}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {subscriptionEnd ? `Renews ${new Date(subscriptionEnd).toLocaleDateString()}` : 'No subscription'}
              </div>
            </div>
          </div>
          {stripeEnabled && hasStripeCustomer && (
            <button
              onClick={openPortal}
              disabled={loading === 'portal'}
              className="mt-4 text-sm text-primary hover:underline disabled:opacity-50"
            >
              {loading === 'portal' ? 'Opening…' : 'Manage subscription & invoices →'}
            </button>
          )}
        </div>

        {!stripeEnabled && (
          <div className="bg-secondary border border-border rounded-lg p-4 text-sm text-muted-foreground">
            Stripe billing is not configured on this instance. Contact your admin to add credits manually.
          </div>
        )}

        {stripeEnabled && (
          <>
            <div>
              <h2 className="font-semibold text-foreground mb-4">Buy Credits</h2>
              <div className="grid grid-cols-3 gap-4">
                {creditPacks.map(pack => (
                  <div key={pack.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
                    <div>
                      <div className="font-semibold text-foreground text-sm">{pack.name}</div>
                      <div className="text-2xl font-bold text-foreground mt-1">
                        {pack.credits}<span className="text-sm text-muted-foreground ml-1">credits</span>
                      </div>
                      <div className="text-primary font-medium text-sm mt-0.5">${pack.priceUsd}</div>
                    </div>
                    <button
                      onClick={() => buyPack(pack.id)}
                      disabled={Boolean(loading) || !pack.stripePriceId}
                      className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {loading === `pack-${pack.id}` ? 'Loading…' : 'Buy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-foreground mb-4">Subscription Plans</h2>
              <div className="grid grid-cols-3 gap-4">
                {plans.map(plan => (
                  <div key={plan.id} className={`bg-card border rounded-lg p-4 flex flex-col gap-3 ${plan.id === currentPlan ? 'border-primary' : 'border-border'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{plan.name}</span>
                        {plan.id === currentPlan && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">current</span>}
                      </div>
                      <div className="text-xl font-bold text-foreground mt-1">
                        {plan.priceUsd === 0 ? 'Free' : `$${plan.priceUsd}/mo`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {plan.monthlyCredits > 0 ? `${plan.monthlyCredits} credits/month` : 'Pay-as-you-go'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {plan.maxProjects === -1 ? 'Unlimited' : plan.maxProjects} projects
                      </div>
                    </div>
                    {plan.id !== currentPlan && plan.stripePriceId && (
                      <button
                        onClick={() => subscribe(plan.id as 'pro' | 'enterprise')}
                        disabled={Boolean(loading)}
                        className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {loading === `sub-${plan.id}` ? 'Loading…' : `Upgrade to ${plan.name}`}
                      </button>
                    )}
                    {plan.id === currentPlan && (
                      <div className="text-xs text-muted-foreground text-center py-2">Current plan</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
