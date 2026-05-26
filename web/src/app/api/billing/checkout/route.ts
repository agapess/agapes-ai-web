import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getStripe, getOrCreateStripeCustomer, isStripeEnabled } from '@/lib/stripe'
import { getPack, getPlan } from '@/lib/plans'
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
