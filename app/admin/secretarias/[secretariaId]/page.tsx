import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AdminHeader } from '@/app/admin/admin-header'
import { SecretariaUserPanel } from '@/app/admin/credential-components'
import { ProjetoCardGrid } from '@/app/admin/projeto-card-grid'
import { getSession } from '@/lib/auth'
import { getProjetosComIndicadores, getSecretariaAdminBySecretariaId, getSecretariaById } from '@/lib/data'
import { getSecretariaIcon } from '@/lib/secretaria-icon'

export default async function SecretariaDetailPage({ params }: { params: Promise<{ secretariaId: string }> }) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'super_admin') redirect('/admin')

  const { secretariaId } = await params
  const id = Number(secretariaId)
  if (!Number.isInteger(id)) notFound()

  const secretaria = await getSecretariaById(id)
  if (!secretaria) notFound()

  const [admin, projetos] = await Promise.all([getSecretariaAdminBySecretariaId(id), getProjetosComIndicadores(id)])

  const Icon = getSecretariaIcon(secretaria.nome)

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-6 sm:p-8">
      <AdminHeader subtitle={`Painel da Prefeita | ${session.username}`} />

      <div className="flex flex-col gap-6">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{secretaria.nome}</h2>
            <p className="text-sm text-muted-foreground">
              {secretaria.projetos_count} projeto{secretaria.projetos_count === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <SecretariaUserPanel secretariaId={secretaria.id} admin={admin} />

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Projetos e números</h3>
          <ProjetoCardGrid projetos={projetos} />
        </div>
      </div>
    </main>
  )
}
