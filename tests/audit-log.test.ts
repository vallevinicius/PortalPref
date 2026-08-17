import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, requireSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  requireSessionMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ requireSession: requireSessionMock }))

import { getAuditDetailEntries, recordAuditLog } from '@/lib/audit-log'
import { getAuditLogs } from '@/lib/actions/audit-log'

describe('helper do registro de auditoria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({ id: 1 })
  })

  it('normaliza campos opcionais sem gravar detalhes inexistentes', async () => {
    await recordAuditLog({
      actorUserId: 3,
      action: 'project.delete',
      entityType: 'project',
      entityId: 22,
    })

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 3,
        action: 'project.delete',
        entityType: 'project',
        entityId: 22,
        targetUserId: null,
      },
    })
  })

  it('persiste detalhes estruturados quando fornecidos', async () => {
    await recordAuditLog({
      actorUserId: 3,
      action: 'project.create',
      entityType: 'project',
      entityId: 22,
      details: { nome: 'Projeto Saúde', secretariaId: 4 },
    })

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 3,
        action: 'project.create',
        entityType: 'project',
        entityId: 22,
        targetUserId: null,
        details: { nome: 'Projeto Saúde', secretariaId: 4 },
      },
    })
  })

  it('converte detalhes técnicos em informações legíveis e omite campos internos', () => {
    expect(getAuditDetailEntries({
      nome: 'Projeto Saúde',
      secretariaId: 4,
      role: 'super_admin',
      pageSize: 25,
      seedKey: 'audit-log-demo-v1',
    })).toEqual([
      { label: 'Nome', value: 'Projeto Saúde' },
      { label: 'Secretaria relacionada', value: 'ID 4' },
      { label: 'Perfil de acesso', value: 'Administrador supremo' },
      { label: 'Itens por página', value: '25 itens' },
    ])
  })
})

describe('consulta protegida do registro de auditoria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 1, username: 'root', role: 'super_admin', secretariaId: null })
    prismaMock.auditLog.create.mockResolvedValue({ id: 100 })
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: 9,
        action: 'project.create',
        entityType: 'project',
        entityId: 22,
        details: { nome: 'Projeto Saúde' },
        createdAt: new Date('2026-08-17T16:00:00.000Z'),
        actor: { id: 1, username: 'root', role: 'super_admin' },
        target: null,
      },
    ])
    prismaMock.auditLog.count.mockResolvedValue(51)
  })

  it('permite somente super admin e registra a própria consulta', async () => {
    const result = await getAuditLogs({ page: 2, pageSize: 10, action: 'project.create', entityType: 'project', actorUserId: 1 })

    expect(requireSessionMock).toHaveBeenCalledWith('super_admin')
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 1,
        action: 'audit_log.view',
        entityType: 'audit_log',
        entityId: null,
        targetUserId: null,
        details: { page: 2, pageSize: 10, action: 'project.create', entityType: 'project', actorUserId: 1 },
      },
    })
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
      where: { action: 'project.create', entityType: 'project', actorUserId: 1 },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
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
    })
    expect(result).toEqual({
      entries: [{
        id: 9,
        action: 'project.create',
        actionLabel: 'Projeto criado',
        entityType: 'project',
        entityLabel: 'Projeto',
        entityId: 22,
        details: { nome: 'Projeto Saúde' },
        createdAt: '2026-08-17T16:00:00.000Z',
        actor: { id: 1, username: 'root', role: 'super_admin' },
        target: null,
      }],
      page: 2,
      pageSize: 10,
      total: 51,
      totalPages: 6,
    })
  })

  it('limita parâmetros inválidos aos valores seguros', async () => {
    await getAuditLogs({ page: 0, pageSize: 500, entityType: 'invalid' as never, actorUserId: -2 })

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      skip: 0,
      take: 100,
    }))
  })

  it('rejeita administrador de secretaria antes de consultar ou gravar eventos', async () => {
    const unauthorized = new Error('Acesso não autorizado.')
    requireSessionMock.mockRejectedValue(unauthorized)

    await expect(getAuditLogs()).rejects.toBe(unauthorized)
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled()
    expect(prismaMock.auditLog.count).not.toHaveBeenCalled()
  })
})
