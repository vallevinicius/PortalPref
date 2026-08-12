import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getAllProjetosComIndicadores, getProjetosComIndicadores, getSecretariaAdmins, getSecretarias } from '@/lib/data'
import { LogoutButton } from './logout-button'
import { SecretariaAdminDashboard } from './secretaria-admin-dashboard'
import { SuperAdminDashboard } from './super-admin-dashboard'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/')

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Portal de Dados Integrados</h1>
          <p className="text-sm text-muted-foreground">
            {session.role === 'super_admin' ? 'Painel da Prefeita' : 'Painel da Secretaria'} — {session.username}
          </p>
        </div>
        <LogoutButton />
      </div>

      {session.role === 'super_admin' ? (
        <SuperAdminDashboardData />
      ) : (
        <SecretariaAdminDashboardData secretariaId={session.secretariaId} />
      )}
    </main>
  )
}

async function SuperAdminDashboardData() {
  const [secretarias, admins, projetos] = await Promise.all([
    getSecretarias(),
    getSecretariaAdmins(),
    getAllProjetosComIndicadores(),
  ])

  return <SuperAdminDashboard secretarias={secretarias} admins={admins} projetos={projetos} />
}

async function SecretariaAdminDashboardData({ secretariaId }: { secretariaId: number | null }) {
  if (!secretariaId) {
    return <p className="text-sm text-destructive">Sua conta não está vinculada a nenhuma secretaria. Contate a Prefeitura.</p>
  }

  const projetos = await getProjetosComIndicadores(secretariaId)
  return <SecretariaAdminDashboard projetos={projetos} />
}
