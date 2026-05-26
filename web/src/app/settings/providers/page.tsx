import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProvidersClient from './ProvidersClient'

export default async function SettingsProvidersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  return <ProvidersClient user={session.user} />
}
