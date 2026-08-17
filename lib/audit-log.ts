import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const AUDIT_ENTITY_TYPES = ['auth', 'user', 'secretaria', 'project', 'indicator', 'audit_log'] as const
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export type AuditLogDetails = Prisma.InputJsonValue

export type RecordAuditLogInput = {
  actorUserId: number
  action: string
  entityType: AuditEntityType
  entityId?: number | null
  targetUserId?: number | null
  details?: AuditLogDetails
}

export async function recordAuditLog({
  actorUserId,
  action,
  entityType,
  entityId,
  targetUserId,
  details,
}: RecordAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      entityType,
      entityId: entityId ?? null,
      targetUserId: targetUserId ?? null,
      ...(details === undefined ? {} : { details }),
    },
  })
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Login realizado',
  'auth.logout': 'Logout realizado',
  'user.create': 'Usuário criado',
  'user.password_reset': 'Senha redefinida',
  view_password: 'Senha visualizada',
  'secretaria.create': 'Secretaria criada',
  'project.create': 'Projeto criado',
  'project.update': 'Projeto atualizado',
  'project.delete': 'Projeto excluído',
  'indicator.create': 'Indicador criado',
  'indicator.update': 'Indicador atualizado',
  'indicator.delete': 'Indicador excluído',
  'audit_log.view': 'Audit log consultado',
  'demo.seed': 'Dados demonstrativos populados',
}

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  auth: 'Autenticação',
  user: 'Usuário',
  secretaria: 'Secretaria',
  project: 'Projeto',
  indicator: 'Indicador',
  audit_log: 'Audit log',
}
