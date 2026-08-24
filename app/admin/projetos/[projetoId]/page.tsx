import { ArrowLeft, Phone, User } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AdminHeader } from '@/app/admin/admin-header'
import { getSession } from '@/lib/auth'
import { getProjetoComIndicadores } from '@/lib/data'
import { ProjetoDashboard } from './projeto-dashboard'

export default async function ProjetoDetailPage({ params }: { params: Promise<{ projetoId: string }> }) {
  const session = await getSession()
  if (!session) redirect('/')

  const { projetoId } = await params
  const id = Number(projetoId)
  if (!Number.isInteger(id)) notFound()

  const projeto = await getProjetoComIndicadores(id)
  if (!projeto) notFound()

  const isSuperAdmin = session.role === 'super_admin'
  const isOwner = session.role === 'secretaria_admin' && session.secretariaId === projeto.secretaria_id
  if (session.role === 'secretaria_admin' && !isOwner) redirect('/admin')

  const backHref = isSuperAdmin ? `/admin/secretarias/${projeto.secretaria_id}` : '/admin'

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-6 sm:p-8">
      <AdminHeader subtitle={`${isSuperAdmin ? 'Painel da Prefeita' : 'Painel da Secretaria'} | ${session.username}`} />

      <div className="flex flex-col gap-6">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{projeto.secretaria_nome}</p>
          <h2 className="text-xl font-semibold text-foreground">{projeto.nome}</h2>
          {projeto.descricao && <p className="mt-1 text-sm text-muted-foreground">{projeto.descricao}</p>}
          {(projeto.responsavel_nome || projeto.responsavel_telefone) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {projeto.responsavel_nome && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-3.5" />
                  {projeto.responsavel_nome}
                </span>
              )}
              {projeto.responsavel_telefone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {projeto.responsavel_telefone}
                </span>
              )}
            </div>
          )}
        </div>

        <ProjetoDashboard projeto={projeto} editable={isSuperAdmin || isOwner} />
      </div>
    </main>
  )
}
