import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, AUDIT_ENTITY_TYPES, type AuditEntityType } from '@/lib/audit-log'
import { getSession } from '@/lib/auth'
import { getAuditLogs, type AuditLogEntry } from '@/lib/actions/audit-log'
import { getSecretariaAdmins, getSuperAdmins } from '@/lib/data'
import { AdminHeader } from '../admin-header'

const ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS)

function parsePositiveInt(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = raw ? Number.parseInt(raw, 10) : undefined
  return parsed && parsed > 0 ? parsed : undefined
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value))
}

function formatDetails(details: unknown) {
  if (details === null || details === undefined) return '—'
  return JSON.stringify(details)
}

function roleLabel(role: string) {
  return role === 'super_admin' ? 'Admin supremo' : 'Admin de secretaria'
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <tr className="border-b border-border/70 align-top last:border-0">
      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="font-medium">{entry.actionLabel}</div>
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{entry.action}</div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline">{entry.entityLabel}</Badge>
        {entry.entityId !== null && <div className="mt-1 text-xs text-muted-foreground">ID {entry.entityId}</div>}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium">{entry.actor.username}</div>
        <div className="text-xs text-muted-foreground">{roleLabel(entry.actor.role)}</div>
      </td>
      <td className="px-4 py-3">
        {entry.target ? (
          <>
            <div className="font-medium">{entry.target.username}</div>
            <div className="text-xs text-muted-foreground">{roleLabel(entry.target.role)}</div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="max-w-sm px-4 py-3">
        <code className="break-words text-[11px] leading-relaxed text-muted-foreground">{formatDetails(entry.details)}</code>
      </td>
    </tr>
  )
}

function Pagination({ page, totalPages, action, entityType, actor }: { page: number; totalPages: number; action?: string; entityType?: string; actor?: string }) {
  const params = new URLSearchParams()
  if (action) params.set('action', action)
  if (entityType) params.set('entityType', entityType)
  if (actor) params.set('actor', actor)

  const previous = new URLSearchParams(params)
  previous.set('page', String(Math.max(1, page - 1)))
  const next = new URLSearchParams(params)
  next.set('page', String(Math.min(totalPages, page + 1)))

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Página {page} de {totalPages}
      </p>
      <div className="flex gap-2">
        <Link href={`/admin/audit-log?${previous.toString()}`} className={buttonVariants({ variant: 'outline', size: 'sm', className: page <= 1 ? 'pointer-events-none opacity-50' : undefined })}>Anterior</Link>
        <Link href={`/admin/audit-log?${next.toString()}`} className={buttonVariants({ variant: 'outline', size: 'sm', className: page >= totalPages ? 'pointer-events-none opacity-50' : undefined })}>Próxima</Link>
      </div>
    </div>
  )
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'super_admin') redirect('/admin')

  const params = await searchParams
  const action = getSingleValue(params.action)
  const entityType = getSingleValue(params.entityType)
  const actor = getSingleValue(params.actor)
  const page = parsePositiveInt(params.page) ?? 1
  const actorUserId = parsePositiveInt(actor)
  const validEntityType = AUDIT_ENTITY_TYPES.includes(entityType as AuditEntityType) ? (entityType as AuditEntityType) : undefined

  const [auditLog, secretariaAdmins, superAdmins] = await Promise.all([
    getAuditLogs({ page, action, entityType: validEntityType, actorUserId }),
    getSecretariaAdmins(),
    getSuperAdmins(),
  ])

  const actors = [...secretariaAdmins.map((user) => ({ id: user.id, username: user.username, role: 'secretaria_admin' })), ...superAdmins.map((user) => ({ id: user.id, username: user.username, role: 'super_admin' }))].sort((a, b) => a.username.localeCompare(b.username))

  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-8 p-6 sm:p-8">
      <AdminHeader subtitle={`Histórico de atividades | ${session.username}`} />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Audit log</h2>
          <p className="text-sm text-muted-foreground">Todas as ações registradas no Portal de Dados Integrados, inclusive as ações dos administradores supremos.</p>
        </div>
        <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>Voltar ao painel</Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de auditoria</CardTitle>
          <CardDescription>Refine o histórico por tipo de ação, entidade ou usuário responsável.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
            <select name="action" defaultValue={action ?? ''} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todas as ações</option>
              {ACTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select name="entityType" defaultValue={entityType ?? ''} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todas as entidades</option>
              {AUDIT_ENTITY_TYPES.map((value) => <option key={value} value={value}>{AUDIT_ENTITY_LABELS[value]}</option>)}
            </select>
            <select name="actor" defaultValue={actor ?? ''} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos os usuários</option>
              {actors.map((user) => <option key={user.id} value={user.id}>{user.username} — {roleLabel(user.role)}</option>)}
            </select>
            <Button type="submit">Filtrar</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{auditLog.total} evento(s) registrado(s)</CardTitle>
          <CardDescription>Os eventos mais recentes aparecem primeiro. Dados sensíveis, como senhas, nunca são armazenados no histórico.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {auditLog.entries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum evento encontrado para os filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Ação</th>
                    <th className="px-4 py-3 font-medium">Entidade</th>
                    <th className="px-4 py-3 font-medium">Ator</th>
                    <th className="px-4 py-3 font-medium">Alvo</th>
                    <th className="px-4 py-3 font-medium">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.entries.map((entry) => <AuditRow key={entry.id} entry={entry} />)}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={auditLog.page} totalPages={auditLog.totalPages} action={action} entityType={entityType} actor={actor} />
        </CardContent>
      </Card>
    </main>
  )
}
