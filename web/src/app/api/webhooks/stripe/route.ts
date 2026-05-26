import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, subscriptions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe'
import { grantCredits } from '@/lib/credits'
import { getPlan } from '@/lib/plans'
import { generateId } from '@/lib/utils'
import type Stripe from 'stripe'

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
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
    default:
      break
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId
  if (!userId) return

  if (session.metadata?.type === 'pack') {
    const credits = parseInt(session.metadata.credits ?? '0', 10)
    if (credits > 0) {
      grantCredits(
        db, userId, credits, 'purchase',
        `Credit pack: ${session.metadata.packId}`,
        session.payment_intent as string ?? undefined,
      )
    }
  }
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
    grantCredits(db, userId, plan.monthlyCredits, 'purchase', `Monthly credits: ${plan.name} plan`)
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.userId ?? getUserIdByCustomer(sub.customer as string)
  if (!userId) return

  const priceId = sub.items.data[0]?.price.id
  if (!priceId) return

  const plan = getPlan(sub.metadata?.planId ?? '')
  const currentPeriodEnd = new Date((sub.current_period_end ?? 0) * 1000)

  const existing = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get()

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

  db.update(users)
    .set({ plan: plan.id as 'free' | 'pro' | 'enterprise', updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run()

  if (sub.status === 'active' && plan.monthlyCredits > 0 && !existing) {
    grantCredits(db, userId, plan.monthlyCredits, 'purchase', `Welcome credits: ${plan.name} plan`)
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
