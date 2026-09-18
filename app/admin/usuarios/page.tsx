import Link from 'next/link'
import { redirect } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { getSession } from '@/lib/auth'
import { getAllUsers, getProjetosResumo } from '@/lib/data'
import { AdminHeader } from '../admin-header'
import { UsuariosTable } from './usuarios-table'

export default async function UsuariosPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role === 'projeto_admin') redirect('/admin')
  if (session.role === 'secretaria_admin' && !session.secretariaId) redirect('/admin')

  const isSuperAdmin = session.role === 'super_admin'

  const [usuarios, projetosResumo] = await Promise.all([
    getAllUsers(isSuperAdmin ? undefined : (session.secretariaId ?? undefined)),
    getProjetosResumo(),
  ])

  const projetosGerenciaveis = isSuperAdmin
    ? projetosResumo
    : projetosResumo.filter((p) => p.secretaria_id === session.secretariaId)

  const subtitle = isSuperAdmin ? 'Painel da Prefeita' : 'Painel da Secretaria'
  const descricao = isSuperAdmin
    ? 'secretários e responsáveis de projeto.'
    : 'responsáveis de projeto da sua secretaria.'

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-6 sm:p-8">
      <AdminHeader subtitle={`${subtitle} | ${session.username}`} />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Usuários</h2>
          <p className="text-sm text-muted-foreground">
            {usuarios.length} usuário{usuarios.length === 1 ? '' : 's'} cadastrado{usuarios.length === 1 ? '' : 's'} ({descricao})
          </p>
        </div>
        <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>
          Voltar ao painel
        </Link>
      </div>

      <UsuariosTable usuarios={usuarios} projetos={projetosGerenciaveis} canEdit={session.canEdit !== false} />
    </main>
  )
}
