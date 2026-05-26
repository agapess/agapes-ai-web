# Phase 3 — Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full Stripe billing (one-time credit packs + subscriptions), admin user management, Redis rate limiting, and user-facing billing settings so the platform can charge for AI usage.

**Architecture:** Stripe is the payment source of truth; the DB is the credit source of truth. Webhooks update the DB when Stripe events fire. The web service does all billing — the AI service stays stateless. Rate limiting uses ioredis connected to the existing Redis container.

**Tech Stack:** stripe SDK, ioredis, Next.js API routes, Drizzle ORM, Vitest.

---

## File Map

```
web/
  src/
    lib/
      stripe.ts              NEW — Stripe client singleton + helpers
      plans.ts               NEW — static plan/pack definitions (prices, credits, limits)
      rateLimiter.ts         NEW — Redis sliding-window rate limiter
    app/
      api/
        billing/
          checkout/route.ts  NEW — POST: create Stripe Checkout session
          portal/route.ts    NEW — POST: create Stripe customer portal session
        webhooks/
          stripe/route.ts    NEW — POST: raw-body Stripe webhook handler
        admin/
          users/
            route.ts         NEW — GET all users
            [id]/route.ts    NEW — PATCH user (credits, plan, role)
        ai/
          stream/route.ts    MODIFY — add rate-limit check before proxy
      admin/
        users/
          page.tsx           NEW — admin user list server page
          AdminUsersClient.tsx  NEW — client component
      settings/
        billing/
          page.tsx           NEW — user billing server page
          BillingClient.tsx  NEW — client component
      components/
        builder/
          BuilderHeader.tsx  MODIFY — show live credit balance
    lib/
      schema.ts              MODIFY — add subscriptions table
      credits.ts             MODIFY — add grantCredits() for Stripe/admin use
      migrate.ts             no change (auto-runs on boot)
```

---

## Task 1: Install Packages + Schema + Plans Config

**Files:**
- Modify: `web/package.json`
- Modify: `web/src/lib/schema.ts`
- Create: `web/src/lib/plans.ts`
- Create: `web/src/lib/stripe.ts`

- [ ] **Step 1: Add stripe and ioredis to web/package.json**

In `web/package.json` dependencies add:
```json
"stripe": "^14.25.0",
"ioredis": "^5.3.2"
```
In devDependencies add:
```json
"@types/ioredis": "^5.0.0"
```

```bash
cd "i:/VS Code/Website_Bulder"
pnpm --filter web install
```

Expected: packages resolved, no errors.

- [ ] **Step 2: Add subscriptions table to web/src/lib/schema.ts**

Read the file, then append after the `creditTransactions` table:

```typescript
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  stripePriceId: text('stripe_price_id').notNull(),
  status: text('status', { enum: ['active', 'canceled', 'past_due', 'trialing'] }).notNull().default('active'),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }).notNull(),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})
```

- [ ] **Step 3: Generate and run new migration**

```bash
cd "i:/VS Code/Website_Bulder/web"
pnpm db:generate
pnpm db:migrate
```

Expected: new migration file in `web/drizzle/` for the subscriptions table. `web/data/db.sqlite` updated.

- [ ] **Step 4: Create web/src/lib/plans.ts**

```typescript
export interface CreditPack {
  id: string
  name: string
  credits: number
  priceUsd: number          // display only
  stripePriceId: string     // from env
}

export interface Plan {
  id: 'free' | 'pro' | 'enterprise'
  name: string
  monthlyCredits: number    // granted on each billing cycle
  maxProjects: number
  maxPages: number
  stripePriceId: string | null  // null = free, no Stripe sub needed
  priceUsd: number          // display only, 0 for free
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
    maxProjects: -1,     // unlimited
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
```

- [ ] **Step 5: Create web/src/lib/stripe.ts**

```typescript
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    _stripe = new Stripe(key, { apiVersion: '2024-04-10' })
  }
  return _stripe
}

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/** Ensure a Stripe customer exists for this user and return their customer ID. */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name: string | null,
  existingCustomerId: string | null,
): Promise<string> {
  const stripe = getStripe()

  if (existingCustomerId) {
    return existingCustomerId
  }

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  })

  return customer.id
}
```

- [ ] **Step 6: Add grantCredits to web/src/lib/credits.ts**

Read the existing file and append:

```typescript
/** Grant credits to user (for purchases, admin top-up, or subscription refresh). */
export function grantCredits(
  db: DB,
  userId: string,
  amount: number,
  type: 'purchase' | 'admin',
  description: string,
  stripePaymentIntentId?: string,
): void {
  if (amount <= 0) return
  db.update(schema.users)
    .set({ credits: sql`${schema.users.credits} + ${amount}` })
    .where(eq(schema.users.id, userId))
    .run()
  db.insert(schema.creditTransactions).values({
    id: generateId(),
    userId,
    amount,
    type,
    description,
    stripePaymentIntentId: stripePaymentIntentId ?? null,
  }).run()
}
```

- [ ] **Step 7: Write test for grantCredits**

Add to `web/src/lib/__tests__/credits.test.ts` (append after existing tests, inside the same describe block):

```typescript
import { grantCredits } from '../credits'

// Add inside the describe block after the refundCredits test:
it('grantCredits increases balance and creates purchase transaction', () => {
  grantCredits(db, 'u1', 50, 'purchase', 'Starter pack')
  const user = db.select().from(schema.users).where(eq(schema.users.id, 'u1')).get()
  expect(user?.credits).toBe(59)  // 9 (after previous tests) + 50
})
```

- [ ] **Step 8: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 15 tests PASS.

- [ ] **Step 9: Update .env.example**

Append to `.env.example`:
```env
# ─── Stripe ──────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# ─── Stripe Price IDs (create these in Stripe Dashboard) ─────────────────────
STRIPE_PRICE_STARTER=price_xxx        # one-time: 100 credits = $5
STRIPE_PRICE_PRO_PACK=price_xxx       # one-time: 500 credits = $20
STRIPE_PRICE_POWER_PACK=price_xxx     # one-time: 1200 credits = $40
STRIPE_PRICE_PRO_SUB=price_xxx        # recurring: Pro plan $12/mo
STRIPE_PRICE_ENTERPRISE_SUB=price_xxx # recurring: Enterprise $49/mo

# ─── Redis (for rate limiting in web service) ─────────────────────────────────
REDIS_URL=redis://localhost:6380
```

- [ ] **Step 10: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/package.json web/src/lib/schema.ts web/src/lib/plans.ts \
  web/src/lib/stripe.ts web/src/lib/credits.ts \
  web/src/lib/__tests__/credits.test.ts web/drizzle/ .env.example pnpm-lock.yaml
git commit -m "feat: stripe + ioredis setup, subscriptions schema, credit packs, grantCredits"
```

---

## Task 2: Stripe Checkout + Portal APIs

**Files:**
- Create: `web/src/app/api/billing/checkout/route.ts`
- Create: `web/src/app/api/billing/portal/route.ts`

- [ ] **Step 1: Create web/src/app/api/billing/checkout/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getStripe, getOrCreateStripeCustomer, isStripeEnabled } from '@/lib/stripe'
import { getPack, getPlan, CREDIT_PACKS, PLANS } from '@/lib/plans'
import { z } from 'zod'

const checkoutSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pack'), packId: z.string() }),
  z.object({ type: z.literal('subscription'), planId: z.enum(['pro', 'enterprise']) }),
])

export async function POST(req: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = db.select().from(users).where(eq(users.id, session.user.id)).get()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const stripe = getStripe()
  const customerId = await getOrCreateStripeCustomer(
    user.id, user.email, user.name, user.stripeCustomerId,
  )

  // Save customerId if newly created
  if (!user.stripeCustomerId) {
    db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id)).run()
  }

  const origin = req.headers.get('origin') ?? process.env.NEXTAUTH_URL ?? 'http://localhost:4000'

  if (parsed.data.type === 'pack') {
    const pack = getPack(parsed.data.packId)
    if (!pack || !pack.stripePriceId) {
      return NextResponse.json({ error: 'Invalid pack or price not configured' }, { status: 400 })
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: pack.stripePriceId, quantity: 1 }],
      success_url: `${origin}/settings/billing?success=1`,
      cancel_url: `${origin}/settings/billing?canceled=1`,
      metadata: {
        userId: user.id,
        packId: pack.id,
        credits: String(pack.credits),
        type: 'pack',
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  }

  // Subscription
  const plan = getPlan(parsed.data.planId)
  if (!plan.stripePriceId) {
    return NextResponse.json({ error: 'Price not configured for this plan' }, { status: 400 })
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?success=1`,
    cancel_url: `${origin}/settings/billing?canceled=1`,
    metadata: {
      userId: user.id,
      planId: plan.id,
      type: 'subscription',
    },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
```

- [ ] **Step 2: Create web/src/app/api/billing/portal/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getStripe, isStripeEnabled } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = db.select().from(users).where(eq(users.id, session.user.id)).get()
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const origin = req.headers.get('origin') ?? process.env.NEXTAUTH_URL ?? 'http://localhost:4000'
  const stripe = getStripe()

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/settings/billing`,
  })

  return NextResponse.json({ url: portalSession.url })
}
```

- [ ] **Step 3: Update middleware to protect billing routes**

Read `web/src/middleware.ts`, add `/api/billing/:path*` to the matcher array:

```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/builder/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/api/projects/:path*',
    '/api/providers/:path*',
    '/api/admin/:path*',
    '/api/chat-sessions/:path*',
    '/api/ai/:path*',
    '/api/billing/:path*',
  ],
}
```

- [ ] **Step 4: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 15 tests PASS (no new tests — Stripe routes are integration-level).

- [ ] **Step 5: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/api/billing/ web/src/middleware.ts
git commit -m "feat: Stripe checkout (packs + subscriptions) and billing portal"
```

---

## Task 3: Stripe Webhook Handler

**Files:**
- Create: `web/src/app/api/webhooks/stripe/route.ts`

The webhook handler verifies Stripe signatures, processes events, and updates the DB. It MUST read the raw body (not parsed JSON) for signature verification.

- [ ] **Step 1: Create web/src/app/api/webhooks/stripe/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, subscriptions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe'
import { grantCredits } from '@/lib/credits'
import { getPlan } from '@/lib/plans'
import { generateId } from '@/lib/utils'
import type Stripe from 'stripe'

// Disable Next.js body parsing — Stripe needs the raw body for signature verification
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const rawBody = Buffer.from(await req.arrayBuffer())
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature invalid: ${String(err)}` }, { status: 400 })
  }

  try {
    await handleStripeEvent(event)
  } catch (err) {
    console.error('Stripe webhook handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      await handleCheckoutCompleted(session)
      break
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      await handleInvoicePaymentSucceeded(invoice)
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      await handleSubscriptionUpdated(sub)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await handleSubscriptionDeleted(sub)
      break
    }
    default:
      // Unhandled event type — ignore silently
      break
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId
  if (!userId) return

  if (session.metadata?.type === 'pack') {
    // One-time credit pack purchase
    const credits = parseInt(session.metadata.credits ?? '0', 10)
    if (credits > 0) {
      grantCredits(db, userId, credits, 'purchase',
        `Credit pack: ${session.metadata.packId}`,
        session.payment_intent as string ?? undefined,
      )
    }
  }
  // Subscription checkout completion is handled by invoice.payment_succeeded
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.subscription || invoice.billing_reason !== 'subscription_cycle') return

  const stripe = getStripe()
  const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
  const userId = sub.metadata?.userId ?? getUserIdByCustomer(sub.customer as string)
  if (!userId) return

  const planId = sub.metadata?.planId
  if (!planId) return

  const plan = getPlan(planId)
  if (plan.monthlyCredits > 0) {
    grantCredits(db, userId, plan.monthlyCredits, 'purchase',
      `Monthly credits: ${plan.name} plan`,
    )
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.userId ?? getUserIdByCustomer(sub.customer as string)
  if (!userId) return

  const priceId = sub.items.data[0]?.price.id
  if (!priceId) return

  const plan = getPlan(sub.metadata?.planId ?? '')

  // Upsert subscription record
  const existing = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get()
  const currentPeriodEnd = new Date((sub.current_period_end ?? 0) * 1000)

  if (existing) {
    db.update(subscriptions).set({
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      status: sub.status as 'active' | 'canceled' | 'past_due' | 'trialing',
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      updatedAt: new Date(),
    }).where(eq(subscriptions.userId, userId)).run()
  } else {
    db.insert(subscriptions).values({
      id: generateId(),
      userId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      status: sub.status as 'active' | 'canceled' | 'past_due' | 'trialing',
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    }).run()
  }

  // Update user plan
  db.update(users)
    .set({ plan: plan.id as 'free' | 'pro' | 'enterprise', updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run()

  // Grant monthly credits on new subscription activation
  if (sub.status === 'active' && plan.monthlyCredits > 0) {
    const isNew = !existing
    if (isNew) {
      grantCredits(db, userId, plan.monthlyCredits, 'purchase', `Welcome credits: ${plan.name} plan`)
    }
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.userId ?? getUserIdByCustomer(sub.customer as string)
  if (!userId) return

  db.update(subscriptions).set({
    status: 'canceled',
    updatedAt: new Date(),
  }).where(eq(subscriptions.userId, userId)).run()

  db.update(users)
    .set({ plan: 'free', updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run()
}

function getUserIdByCustomer(customerId: string): string | null {
  const user = db.select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .get()
  return user?.id ?? null
}
```

- [ ] **Step 2: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 15 tests PASS.

- [ ] **Step 3: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/api/webhooks/
git commit -m "feat: Stripe webhook handler (checkout, subscription, invoice events)"
```

---

## Task 4: Admin User Management API + UI

**Files:**
- Create: `web/src/app/api/admin/users/route.ts`
- Create: `web/src/app/api/admin/users/[id]/route.ts`
- Create: `web/src/app/admin/users/page.tsx`
- Create: `web/src/app/admin/users/AdminUsersClient.tsx`

- [ ] **Step 1: Create web/src/app/api/admin/users/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, subscriptions, creditTransactions } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const allUsers = db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    plan: users.plan,
    credits: users.credits,
    createdAt: users.createdAt,
  }).from(users).all()

  return NextResponse.json({ users: allUsers })
}
```

- [ ] **Step 2: Create web/src/app/api/admin/users/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { grantCredits, deductCredits } from '@/lib/credits'
import { z } from 'zod'

const updateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  creditAdjustment: z.number().int().optional(),   // positive = add, negative = remove
  creditReason: z.string().optional(),
})

type Params = { params: { id: string } }

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const adminSession = await requireAdmin()
  if (!adminSession) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const target = db.select().from(users).where(eq(users.id, params.id)).get()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { role, plan, creditAdjustment, creditReason } = parsed.data

  if (role || plan) {
    db.update(users).set({
      ...(role ? { role } : {}),
      ...(plan ? { plan } : {}),
      updatedAt: new Date(),
    }).where(eq(users.id, params.id)).run()
  }

  if (creditAdjustment !== undefined && creditAdjustment !== 0) {
    const reason = creditReason ?? (creditAdjustment > 0 ? 'Admin credit grant' : 'Admin credit removal')
    if (creditAdjustment > 0) {
      grantCredits(db, params.id, creditAdjustment, 'admin', reason)
    } else {
      deductCredits(db, params.id, Math.abs(creditAdjustment), reason)
    }
  }

  const updated = db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    plan: users.plan,
    credits: users.credits,
  }).from(users).where(eq(users.id, params.id)).get()

  return NextResponse.json({ user: updated })
}
```

- [ ] **Step 3: Create web/src/app/admin/users/page.tsx**

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminUsersClient from './AdminUsersClient'

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'admin') redirect('/dashboard')
  return <AdminUsersClient currentUserId={session.user.id} />
}
```

- [ ] **Step 4: Create web/src/app/admin/users/AdminUsersClient.tsx**

```typescript
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
  createdAt: Date | null
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

                      {/* Role selector */}
                      <select
                        value={user.role}
                        onChange={e => updateRole(user.id, e.target.value)}
                        disabled={user.id === currentUserId}
                        className="text-xs bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>

                      {/* Plan selector */}
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

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingId(editingId === user.id ? null : user.id)}
                      className="text-xs text-primary hover:opacity-80 transition-opacity"
                    >
                      Adjust Credits
                    </button>
                  </div>
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
```

- [ ] **Step 5: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 15 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/api/admin/users/ web/src/app/admin/users/
git commit -m "feat: admin user management API + UI (credits, plan, role)"
```

---

## Task 5: Redis Rate Limiter

**Files:**
- Create: `web/src/lib/rateLimiter.ts`
- Create: `web/src/lib/__tests__/rateLimiter.test.ts`
- Modify: `web/src/app/api/ai/stream/route.ts`

Sliding-window rate limiter: 5 AI requests per minute per user, 30 per hour per user.

- [ ] **Step 1: Write failing test**

Create `web/src/lib/__tests__/rateLimiter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildRateLimitKey, parseRateLimitConfig } from '../rateLimiter'

describe('rateLimiter utilities', () => {
  it('buildRateLimitKey formats correctly', () => {
    expect(buildRateLimitKey('user-123', 'minute')).toBe('rl:user-123:minute')
    expect(buildRateLimitKey('user-abc', 'hour')).toBe('rl:user-abc:hour')
  })

  it('parseRateLimitConfig returns defaults', () => {
    const cfg = parseRateLimitConfig()
    expect(cfg.minuteLimit).toBeGreaterThan(0)
    expect(cfg.hourLimit).toBeGreaterThan(cfg.minuteLimit)
  })
})
```

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: FAIL — functions not defined.

- [ ] **Step 2: Create web/src/lib/rateLimiter.ts**

```typescript
import Redis from 'ioredis'

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
    _redis.on('error', () => {
      // Redis unavailable — rate limiter degrades gracefully (allow all)
    })
  }
  return _redis
}

export interface RateLimitConfig {
  minuteLimit: number
  hourLimit: number
}

export function parseRateLimitConfig(): RateLimitConfig {
  return {
    minuteLimit: parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '5', 10),
    hourLimit: parseInt(process.env.RATE_LIMIT_PER_HOUR ?? '30', 10),
  }
}

export function buildRateLimitKey(userId: string, window: 'minute' | 'hour'): string {
  return `rl:${userId}:${window}`
}

export interface RateLimitResult {
  allowed: boolean
  remainingMinute: number
  remainingHour: number
  resetMinute: number  // unix timestamp seconds
  resetHour: number
}

/**
 * Check and increment rate limit counters using Redis INCR + EXPIRE.
 * Returns allowed=true if under both limits.
 * Degrades gracefully: returns allowed=true when Redis is unavailable.
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const redis = getRedis()
  const cfg = parseRateLimitConfig()
  const now = Math.floor(Date.now() / 1000)

  if (!redis) {
    return {
      allowed: true,
      remainingMinute: cfg.minuteLimit,
      remainingHour: cfg.hourLimit,
      resetMinute: now + 60,
      resetHour: now + 3600,
    }
  }

  try {
    const minuteKey = buildRateLimitKey(userId, 'minute')
    const hourKey = buildRateLimitKey(userId, 'hour')

    const pipeline = redis.pipeline()
    pipeline.incr(minuteKey)
    pipeline.expire(minuteKey, 60)
    pipeline.incr(hourKey)
    pipeline.expire(hourKey, 3600)
    const results = await pipeline.exec()

    const minuteCount = (results?.[0]?.[1] as number) ?? 0
    const hourCount = (results?.[2]?.[1] as number) ?? 0

    const allowed = minuteCount <= cfg.minuteLimit && hourCount <= cfg.hourLimit

    return {
      allowed,
      remainingMinute: Math.max(0, cfg.minuteLimit - minuteCount),
      remainingHour: Math.max(0, cfg.hourLimit - hourCount),
      resetMinute: now + 60,
      resetHour: now + 3600,
    }
  } catch {
    // Redis error — fail open
    return {
      allowed: true,
      remainingMinute: cfg.minuteLimit,
      remainingHour: cfg.hourLimit,
      resetMinute: now + 60,
      resetHour: now + 3600,
    }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 17 tests PASS (15 old + 2 new).

- [ ] **Step 4: Add rate limit check to ai/stream route**

Read `web/src/app/api/ai/stream/route.ts`. Add rate limit check right after the session check, before the provider resolution. Insert after `if (!session?.user?.id)` block:

```typescript
import { checkRateLimit } from '@/lib/rateLimiter'

// After session check, before resolveProvider:
const rateLimit = await checkRateLimit(session.user.id)
if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. Please wait before sending another message.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Remaining-Minute': String(rateLimit.remainingMinute),
        'X-RateLimit-Remaining-Hour': String(rateLimit.remainingHour),
        'Retry-After': '60',
      },
    },
  )
}
```

The full updated `web/src/app/api/ai/stream/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pages, chatSessions } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { resolveProvider } from '@/lib/providerResolver'
import { hasCredits } from '@/lib/credits'
import { checkRateLimit } from '@/lib/rateLimiter'

const AI_INTERNAL_URL = process.env.AI_SERVICE_INTERNAL_URL ?? 'http://localhost:4001'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimit = await checkRateLimit(session.user.id)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before sending another message.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining-Minute': String(rateLimit.remainingMinute),
          'X-RateLimit-Remaining-Hour': String(rateLimit.remainingHour),
          'Retry-After': '60',
        },
      },
    )
  }

  const body = await req.json() as {
    projectId: string
    message: string
    provider?: string
  }

  const { projectId, message, provider: preferredProvider } = body

  const resolved = resolveProvider(session.user.id, session.user.plan, preferredProvider)
  if (!resolved) {
    return NextResponse.json(
      { error: 'No AI provider configured. Ask your admin to set up a provider.' },
      { status: 503 },
    )
  }

  if (!hasCredits(db, session.user.id, resolved.creditCost)) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  const chatSession = db.select().from(chatSessions)
    .where(and(eq(chatSessions.projectId, projectId), eq(chatSessions.userId, session.user.id)))
    .get()
  const history = chatSession
    ? (chatSession.messages as Array<{ role: 'user' | 'assistant'; content: string }>)
    : []

  const homePage = db.select({ content: pages.content }).from(pages)
    .where(and(eq(pages.projectId, projectId), eq(pages.isHomePage, true)))
    .get()
  const projectContext = homePage?.content ? JSON.stringify(homePage.content) : undefined

  const aiRequest = {
    projectId,
    message,
    history,
    providerConfig: {
      provider: resolved.provider,
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
      model: resolved.model,
    },
    projectContext,
  }

  const aiRes = await fetch(`${AI_INTERNAL_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aiRequest),
  })

  if (!aiRes.ok || !aiRes.body) {
    return NextResponse.json({ error: 'AI service error' }, { status: 502 })
  }

  return new NextResponse(aiRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Credit-Cost': String(resolved.creditCost),
    },
  })
}
```

- [ ] **Step 5: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 17 tests PASS.

- [ ] **Step 6: Add REDIS_URL to docker-compose.yml web service**

Read `docker-compose.yml`. In the `web` service `environment` section, add:
```yaml
- REDIS_URL=redis://redis:6379
```

Also add rate limit env vars to `.env.example`:
```env
# ─── Rate Limiting ────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6380
RATE_LIMIT_PER_MINUTE=5
RATE_LIMIT_PER_HOUR=30
```

- [ ] **Step 7: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/lib/rateLimiter.ts web/src/lib/__tests__/rateLimiter.test.ts \
  web/src/app/api/ai/stream/route.ts docker-compose.yml .env.example
git commit -m "feat: Redis sliding-window rate limiter (5/min, 30/hr per user)"
```

---

## Task 6: Billing Settings Page

**Files:**
- Create: `web/src/app/settings/billing/page.tsx`
- Create: `web/src/app/settings/billing/BillingClient.tsx`
- Modify: `web/src/app/dashboard/DashboardClient.tsx` (add Billing link)

- [ ] **Step 1: Create web/src/app/settings/billing/page.tsx**

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users, subscriptions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import BillingClient from './BillingClient'
import { getPlan, CREDIT_PACKS, PLANS } from '@/lib/plans'
import { isStripeEnabled } from '@/lib/stripe'

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const user = db.select({
    credits: users.credits,
    plan: users.plan,
    stripeCustomerId: users.stripeCustomerId,
  }).from(users).where(eq(users.id, session.user.id)).get()

  const subscription = db.select().from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .get()

  return (
    <BillingClient
      credits={user?.credits ?? 0}
      currentPlan={user?.plan ?? 'free'}
      hasStripeCustomer={Boolean(user?.stripeCustomerId)}
      subscriptionStatus={subscription?.status ?? null}
      subscriptionEnd={subscription?.currentPeriodEnd ? subscription.currentPeriodEnd.toISOString() : null}
      stripeEnabled={isStripeEnabled()}
      creditPacks={CREDIT_PACKS}
      plans={PLANS}
    />
  )
}
```

- [ ] **Step 2: Create web/src/app/settings/billing/BillingClient.tsx**

```typescript
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
            {/* Credit packs */}
            <div>
              <h2 className="font-semibold text-foreground mb-4">Buy Credits</h2>
              <div className="grid grid-cols-3 gap-4">
                {creditPacks.map(pack => (
                  <div key={pack.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
                    <div>
                      <div className="font-semibold text-foreground text-sm">{pack.name}</div>
                      <div className="text-2xl font-bold text-foreground mt-1">{pack.credits}<span className="text-sm text-muted-foreground ml-1">credits</span></div>
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

            {/* Plans */}
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
```

- [ ] **Step 3: Add Billing link to DashboardClient.tsx**

Read `web/src/app/dashboard/DashboardClient.tsx`. In the header, add a Billing link after the AI Settings link:

```typescript
<Link href="/settings/billing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
  Billing
</Link>
```

- [ ] **Step 4: Run tests**

```bash
cd "i:/VS Code/Website_Bulder/web" && pnpm test
```

Expected: 17 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/app/settings/billing/ web/src/app/dashboard/DashboardClient.tsx
git commit -m "feat: billing settings page (packs, plans, portal)"
```

---

## Task 7: Credit Display in Builder + Final Verification

**Files:**
- Modify: `web/src/components/builder/BuilderHeader.tsx`
- Modify: `web/src/components/builder/ChatPanel.tsx`

Show live credit balance in the builder header. Update after each AI call.

- [ ] **Step 1: Add credits to builderStore**

Read `web/src/store/builderStore.ts`. Add `credits` state:

```typescript
import { create } from 'zustand'

interface Project {
  id: string
  name: string
  slug: string
  status: string
}

interface Page {
  id: string
  projectId: string
  name: string
  slug: string
}

interface BuilderState {
  project: Project | null
  pages: Page[]
  activePage: Page | null
  previewCode: string
  previewSize: 'desktop' | 'tablet' | 'mobile'
  credits: number           // ADD
  setProject: (project: Project) => void
  setPages: (pages: Page[]) => void
  setActivePage: (page: Page) => void
  setPreviewCode: (code: string) => void
  setPreviewSize: (size: 'desktop' | 'tablet' | 'mobile') => void
  setCredits: (credits: number) => void   // ADD
}

export const useBuilderStore = create<BuilderState>((set) => ({
  project: null,
  pages: [],
  activePage: null,
  previewCode: '',
  previewSize: 'desktop',
  credits: 0,               // ADD
  setProject: (project) => set({ project }),
  setPages: (pages) => set({ pages }),
  setActivePage: (activePage) => set({ activePage }),
  setPreviewCode: (previewCode) => set({ previewCode }),
  setPreviewSize: (previewSize) => set({ previewSize }),
  setCredits: (credits) => set({ credits }),  // ADD
}))
```

- [ ] **Step 2: Update BuilderPage.tsx to seed initial credits**

Read `web/src/app/builder/[projectId]/BuilderPage.tsx`. Update to accept and seed credits:

```typescript
'use client'
import { useEffect } from 'react'
import { useBuilderStore } from '@/store/builderStore'
import BuilderLayout from '@/components/builder/BuilderLayout'

interface Project {
  id: string
  name: string
  slug: string
  status: string
}

interface Props {
  project: Project
  initialCredits: number   // ADD
}

export default function BuilderPage({ project, initialCredits }: Props) {
  const { setProject, setCredits } = useBuilderStore()

  useEffect(() => {
    setProject(project)
    setCredits(initialCredits)   // ADD
  }, [project, initialCredits, setProject, setCredits])

  return <BuilderLayout />
}
```

- [ ] **Step 3: Update builder/[projectId]/page.tsx to pass credits**

Read `web/src/app/builder/[projectId]/page.tsx`. Add credit fetch and pass to BuilderPage:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, users } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import BuilderPage from './BuilderPage'

interface Props {
  params: { projectId: string }
}

export default async function BuilderRoute({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const project = db.select().from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()

  if (!project) redirect('/dashboard')

  const user = db.select({ credits: users.credits }).from(users)
    .where(eq(users.id, session.user.id))
    .get()

  return <BuilderPage project={project} initialCredits={user?.credits ?? 0} />
}
```

- [ ] **Step 4: Update BuilderHeader.tsx to show credits**

Read `web/src/components/builder/BuilderHeader.tsx`. Update to display credits:

```typescript
'use client'
import { useBuilderStore } from '@/store/builderStore'
import { useRouter } from 'next/navigation'

export default function BuilderHeader() {
  const { project, previewSize, setPreviewSize, credits } = useBuilderStore()
  const router = useRouter()

  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-4 bg-card shrink-0">
      <button
        onClick={() => router.push('/dashboard')}
        className="text-muted-foreground hover:text-foreground transition-colors text-sm"
      >
        ← Dashboard
      </button>

      <span className="text-foreground font-medium text-sm truncate flex-1">
        {project?.name ?? 'Loading…'}
      </span>

      <span className="text-xs text-muted-foreground">
        {credits} credits
      </span>

      <div className="flex items-center gap-1 bg-secondary rounded-md p-1">
        {(['desktop', 'tablet', 'mobile'] as const).map((size) => (
          <button
            key={size}
            onClick={() => setPreviewSize(size)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              previewSize === size
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {size === 'desktop' ? '🖥' : size === 'tablet' ? '📱' : '📲'}
          </button>
        ))}
      </div>

      <button className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:opacity-90 transition-opacity">
        Publish
      </button>
    </header>
  )
}
```

- [ ] **Step 5: Update ChatPanel to decrement credits in store after AI call**

Read `web/src/components/builder/ChatPanel.tsx`. Add `setCredits` and `credits` from `useBuilderStore`. In `sendMessage`, after the credit deduction fire-and-forget, add:

```typescript
const { project, setPreviewCode, credits, setCredits } = useBuilderStore()

// After the fire-and-forget credit deduction:
if (success && creditCost > 0) {
  setCredits(Math.max(0, credits - creditCost))
}
```

- [ ] **Step 6: Run all tests**

```bash
cd "i:/VS Code/Website_Bulder"
pnpm test
```

Expected: 45+ tests passing (ai: 31 + web: 17 = 48 total).

- [ ] **Step 7: Final commit**

```bash
cd "i:/VS Code/Website_Bulder"
git add web/src/store/builderStore.ts web/src/components/builder/BuilderHeader.tsx \
  web/src/components/builder/ChatPanel.tsx web/src/app/builder/
git commit -m "feat: phase 3 complete — live credit display in builder"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Stripe Checkout — one-time packs + subscription — Task 2
- ✅ Stripe Webhook — payment, subscription, invoice events — Task 3
- ✅ Admin-assigned credits — Task 4 PATCH with creditAdjustment
- ✅ Plan management — static config in plans.ts, selector in admin users UI — Tasks 1, 4
- ✅ Admin panel (users list, credits, role, plan) — Task 4
- ✅ Rate limiting — Redis sliding window 5/min 30/hr — Task 5
- ✅ Credit display in UI — builder header — Task 7
- ✅ Billing settings page — Task 6

**Type consistency:**
- `grantCredits(db, userId, amount, type, description, stripePaymentIntentId?)` — defined Task 1, used in Task 3 webhook ✅
- `CreditPack.id` used as `packId` in checkout route metadata and `getPack(packId)` ✅
- `Plan.id` typed as `'free' | 'pro' | 'enterprise'` — matches users.plan enum ✅
- `BuilderState.credits` / `setCredits` — added in Task 7 Step 1, used in Steps 4 and 5 ✅
- `subscriptions` table imported in webhook route — added to schema Task 1 Step 2 ✅

**Placeholder scan:** No TBDs or vague steps. All code blocks are complete.

**Note:** The webhook handler in `handleInvoicePaymentSucceeded` calls `getUserIdByCustomer` as a fallback when `sub.metadata.userId` is missing (can happen if subscription was created via the portal). This uses `users.stripeCustomerId` which is updated in the checkout route. ✅
