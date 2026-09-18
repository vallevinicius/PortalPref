import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getProjetosComIndicadores, getProjetosPorIds, getProjetosResumo, getSecretariaAdmins, getSecretarias, getSuperAdmins } from '@/lib/data'
import { AdminHeader } from './admin-header'
import { ProjetoCardGrid } from './projeto-card-grid'
import { NovoProjetoDialogButton, SecretariaAdminDashboard } from './secretaria-admin-dashboard'
import { SuperAdminDashboard } from './super-admin-dashboard'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/')

  if (session.role === 'projeto_admin') {
    if (session.projetoIds.length === 0) redirect('/')
    if (session.projetoIds.length === 1) redirect(`/admin/projetos/${session.projetoIds[0]}`)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 p-6 sm:p-8">
      <AdminHeader
        subtitle={`${session.role === 'super_admin' ? 'Painel da Prefeita' : session.role === 'secretaria_admin' ? 'Painel da Secretaria' : 'Meus Projetos'} | ${session.username}`}
      />

      {session.role === 'super_admin' ? (
        <SuperAdminDashboardData currentUsername={session.username} canEdit={session.canEdit !== false} />
      ) : session.role === 'secretaria_admin' ? (
        <SecretariaAdminDashboardData secretariaId={session.secretariaId} />
      ) : (
        <MeusProjetosData projetoIds={session.projetoIds} />
      )}
    </main>
  )
}

async function MeusProjetosData({ projetoIds }: { projetoIds: number[] }) {
  const projetos = await getProjetosPorIds(projetoIds)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Meus projetos</h2>
          <p className="text-sm text-muted-foreground">
            {projetos.length} projeto{projetos.length === 1 ? '' : 's'} sob sua responsabilidade
          </p>
        </div>
        <NovoProjetoDialogButton />
      </div>
      <ProjetoCardGrid projetos={projetos} />
    </div>
  )
}

async function SuperAdminDashboardData({ currentUsername, canEdit }: { currentUsername: string; canEdit: boolean }) {
  const [secretarias, admins, superAdmins, projetosResumo] = await Promise.all([
    getSecretarias(),
    getSecretariaAdmins(),
    getSuperAdmins(),
    getProjetosResumo(),
  ])

  return (
    <SuperAdminDashboard
      secretarias={secretarias}
      admins={admins}
      superAdmins={superAdmins}
      currentUsername={currentUsername}
      bootstrapUsername={process.env.ADMIN_USERNAME ?? null}
      projetosResumo={projetosResumo}
      canEdit={canEdit}
    />
  )
}

async function SecretariaAdminDashboardData({ secretariaId }: { secretariaId: number | null }) {
  if (!secretariaId) {
    return <p className="text-sm text-destructive">Sua conta não está vinculada a nenhuma secretaria. Contate a Prefeitura.</p>
  }

  const projetos = await getProjetosComIndicadores(secretariaId)
  return <SecretariaAdminDashboard projetos={projetos} />
}
