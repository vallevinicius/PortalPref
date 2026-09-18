import { AlertTriangle, ArrowLeft, Clock, Phone, User } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AdminHeader } from '@/app/admin/admin-header'
import { NovoProjetoDialogButton } from '@/app/admin/secretaria-admin-dashboard'
import { getSession } from '@/lib/auth'
import { getProjetoComIndicadores } from '@/lib/data'
import { calcularStatusAtualizacao } from '@/lib/prazo-atualizacao'
import { EditarProjetoButton, PrazoAtualizacaoButton, ProjetoDashboard } from './projeto-dashboard'

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
  const isProjectResponsible = session.role === 'projeto_admin' && session.projetoIds.includes(projeto.id)
  if (session.role === 'secretaria_admin' && !isOwner) redirect('/admin')
  if (session.role === 'projeto_admin' && !isProjectResponsible) redirect('/admin')

  const canManageUsers = (isSuperAdmin && session.canEdit !== false) || isOwner
  const editable = canManageUsers || isProjectResponsible

  const backHref = isSuperAdmin ? `/admin/secretarias/${projeto.secretaria_id}` : '/admin'
  const subtitle = isSuperAdmin ? 'Painel da Prefeita' : isOwner ? 'Painel da Secretaria' : 'Painel do Projeto'
  const status = calcularStatusAtualizacao(projeto.ultima_atualizacao, projeto.prazo_atualizacao_dias)

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-6 sm:p-8">
      <AdminHeader subtitle={`${subtitle} | ${session.username}`} />

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          {!isProjectResponsible || session.projetoIds.length > 1 ? (
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          ) : (
            <span />
          )}
          {isProjectResponsible && <NovoProjetoDialogButton />}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{projeto.secretaria_nome}</p>
          <div className="flex items-center gap-1">
            <h2 className="text-xl font-semibold text-foreground">{projeto.nome}</h2>
            {editable && <EditarProjetoButton projeto={projeto} />}
            {canManageUsers && <PrazoAtualizacaoButton projetoId={projeto.id} prazoAtual={projeto.prazo_atualizacao_dias} />}
          </div>
          {projeto.descricao && <p className="mt-1 text-sm text-muted-foreground">{projeto.descricao}</p>}
          {(projeto.responsavel_nome || projeto.responsavel_telefone || projeto.prazo_atualizacao_dias !== null) && (
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
              {projeto.prazo_atualizacao_dias !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  Atualizar a cada {projeto.prazo_atualizacao_dias} dia{projeto.prazo_atualizacao_dias === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )}
        </div>

        {status.atrasado && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Projeto atrasado</p>
              <p className="text-sm text-muted-foreground">
                {status.diasDesdeUltimaAtualizacao === null
                  ? 'Este projeto ainda não teve nenhum número lançado.'
                  : `O último número foi lançado há ${status.diasDesdeUltimaAtualizacao} dia${status.diasDesdeUltimaAtualizacao === 1 ? '' : 's'} — o prazo configurado é de ${projeto.prazo_atualizacao_dias} dia${projeto.prazo_atualizacao_dias === 1 ? '' : 's'}.`}
              </p>
            </div>
          </div>
        )}

        <ProjetoDashboard projeto={projeto} editable={editable} canDeleteProject={canManageUsers} />
      </div>
    </main>
  )
}
