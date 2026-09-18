import { describe, expect, it, vi } from 'vitest'

const { getSessionMock, redirectMock, dataMock, actionsMock } = vi.hoisted(() => {
  class RedirectSentinel extends Error {
    path: string
    constructor(path: string) {
      super(`REDIRECT:${path}`)
      this.path = path
    }
  }
  return {
    RedirectSentinel,
    getSessionMock: vi.fn(),
    redirectMock: vi.fn((path: string) => {
      throw new RedirectSentinel(path)
    }),
    dataMock: {
      getSecretariaAdmins: vi.fn().mockResolvedValue([]),
      getSuperAdmins: vi.fn().mockResolvedValue([]),
    },
    actionsMock: {
      getAuditLogs: vi.fn().mockResolvedValue({ entries: [], page: 1, pageSize: 25, total: 0, totalPages: 1 }),
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/auth', () => ({ getSession: getSessionMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/data', () => dataMock)
vi.mock('@/lib/actions/audit-log', () => actionsMock)

import AuditLogPage from '@/app/admin/audit-log/page'

function makeSearchParams() {
  return Promise.resolve({})
}

describe('app/admin/audit-log/page (autorização exclusiva do admin supremo)', () => {
  it('redireciona para "/" quando não há sessão', async () => {
    getSessionMock.mockResolvedValue(null)

    await expect(AuditLogPage({ searchParams: makeSearchParams() })).rejects.toMatchObject({ path: '/' })
  })

  it('bloqueia secretaria_admin', async () => {
    getSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10, projetoIds: [] })

    await expect(AuditLogPage({ searchParams: makeSearchParams() })).rejects.toMatchObject({ path: '/admin' })
  })

  it('bloqueia projeto_admin', async () => {
    getSessionMock.mockResolvedValue({ userId: 5, username: 'joao', role: 'projeto_admin', secretariaId: null, projetoIds: [20] })

    await expect(AuditLogPage({ searchParams: makeSearchParams() })).rejects.toMatchObject({ path: '/admin' })
  })

  it('permite super_admin', async () => {
    getSessionMock.mockResolvedValue({ userId: 1, username: 'root', role: 'super_admin', secretariaId: null, projetoIds: [] })
    actionsMock.getAuditLogs.mockResolvedValue({ entries: [], page: 1, pageSize: 25, total: 0, totalPages: 1 })
    dataMock.getSecretariaAdmins.mockResolvedValue([])
    dataMock.getSuperAdmins.mockResolvedValue([])

    await expect(AuditLogPage({ searchParams: makeSearchParams() })).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
    expect(actionsMock.getAuditLogs).toHaveBeenCalled()
  })
})
