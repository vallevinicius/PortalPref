import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getProjetosComIndicadores, getSecretariaAdmins, getSecretarias, getSuperAdmins } from '@/lib/data'
import { AdminHeader } from './admin-header'
import { SecretariaAdminDashboard } from './secretaria-admin-dashboard'
import { SuperAdminDashboard } from './super-admin-dashboard'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/')

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 p-6 sm:p-8">
      <AdminHeader subtitle={`${session.role === 'super_admin' ? 'Painel da Prefeita' : 'Painel da Secretaria'} | ${session.username}`} />

      {session.role === 'super_admin' ? (
        <SuperAdminDashboardData currentUsername={session.username} />
      ) : (
        <SecretariaAdminDashboardData secretariaId={session.secretariaId} />
      )}
    </main>
  )
}

async function SuperAdminDashboardData({ currentUsername }: { currentUsername: string }) {
  const [secretarias, admins, superAdmins] = await Promise.all([getSecretarias(), getSecretariaAdmins(), getSuperAdmins()])

  return (
    <SuperAdminDashboard secretarias={secretarias} admins={admins} superAdmins={superAdmins} currentUsername={currentUsername} />
  )
}

async function SecretariaAdminDashboardData({ secretariaId }: { secretariaId: number | null }) {
  if (!secretariaId) {
    return <p className="text-sm text-destructive">Sua conta não está vinculada a nenhuma secretaria. Contate a Prefeitura.</p>
  }

  const projetos = await getProjetosComIndicadores(secretariaId)
  return <SecretariaAdminDashboard projetos={projetos} />
}
