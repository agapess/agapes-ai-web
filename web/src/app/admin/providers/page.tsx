import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminProvidersClient from './AdminProvidersClient'

export default async function AdminProvidersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'admin') redirect('/dashboard')

  return <AdminProvidersClient />
}
