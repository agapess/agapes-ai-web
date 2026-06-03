import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    _stripe = new Stripe(key, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
  }
  return _stripe
}

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

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
