'use server'

import type { Prisma } from '@prisma/client'
import { recordAuditLog, AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, type AuditEntityType } from '@/lib/audit-log'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type AuditLogQuery = {
  page?: number
  pageSize?: number
  action?: string
  entityType?: AuditEntityType
  actorUserId?: number
}

export type AuditLogEntry = {
  id: number
  action: string
  actionLabel: string
  entityType: AuditEntityType
  entityLabel: string
  entityId: number | null
  details: unknown
  createdAt: string
  actor: {
    id: number
    username: string
    role: string
  }
  target: {
    id: number
    username: string
    role: string
  } | null
}

export type AuditLogPage = {
  entries: AuditLogEntry[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

function normalizePage(value: number | undefined, fallback: number, max: number) {
  if (!Number.isInteger(value) || !value || value < 1) return fallback
  return Math.min(value, max)
}

function normalizeEntityType(value: string | undefined): AuditEntityType | undefined {
  if (!value || !AUDIT_ENTITY_LABELS[value as AuditEntityType]) return undefined
  return value as AuditEntityType
}

export async function getAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogPage> {
  const session = await requireSession('super_admin')
  const pageSize = normalizePage(query.pageSize, 25, 100)
  const page = normalizePage(query.page, 1, Number.MAX_SAFE_INTEGER)
  const action = query.action?.trim() || undefined
  const entityType = normalizeEntityType(query.entityType)
  const actorUserId = query.actorUserId && query.actorUserId > 0 ? query.actorUserId : undefined

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'audit_log.view',
    entityType: 'audit_log',
    details: { page, pageSize, action: action ?? null, entityType: entityType ?? null, actorUserId: actorUserId ?? null },
  })

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(actorUserId ? { actorUserId } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        details: true,
        createdAt: true,
        actor: { select: { id: true, username: true, role: true } },
        target: { select: { id: true, username: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  const entries: AuditLogEntry[] = rows.map((row) => ({
    id: row.id,
    action: row.action,
    actionLabel: AUDIT_ACTION_LABELS[row.action] ?? row.action,
    entityType: normalizeEntityType(row.entityType) ?? 'user',
    entityLabel: AUDIT_ENTITY_LABELS[normalizeEntityType(row.entityType) ?? 'user'],
    entityId: row.entityId,
    details: row.details,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor,
    target: row.target,
  }))

  return {
    entries,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}
