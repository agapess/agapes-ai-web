export interface CreditPack {
  id: string
  name: string
  credits: number
  priceUsd: number
  stripePriceId: string
}

export interface Plan {
  id: 'free' | 'pro' | 'enterprise'
  name: string
  monthlyCredits: number
  maxProjects: number
  maxPages: number
  stripePriceId: string | null
  priceUsd: number
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 100,
    priceUsd: 5,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? '',
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    credits: 500,
    priceUsd: 20,
    stripePriceId: process.env.STRIPE_PRICE_PRO_PACK ?? '',
  },
  {
    id: 'power',
    name: 'Power Pack',
    credits: 1200,
    priceUsd: 40,
    stripePriceId: process.env.STRIPE_PRICE_POWER_PACK ?? '',
  },
]

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyCredits: 0,
    maxProjects: 3,
    maxPages: 5,
    stripePriceId: null,
    priceUsd: 0,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyCredits: 300,
    maxProjects: 20,
    maxPages: 50,
    stripePriceId: process.env.STRIPE_PRICE_PRO_SUB ?? '',
    priceUsd: 12,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyCredits: 1500,
    maxProjects: -1,
    maxPages: -1,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE_SUB ?? '',
    priceUsd: 49,
  },
]

export function getPlan(planId: string): Plan {
  return PLANS.find(p => p.id === planId) ?? PLANS[0]
}

export function getPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find(p => p.id === packId)
}
