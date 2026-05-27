import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users, subscriptions } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import BillingClient from './BillingClient'
import { CREDIT_PACKS, PLANS } from '@/lib/plans'
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
