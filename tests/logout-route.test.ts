import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionMock, clearSessionCookieMock, recordAuditLogMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  clearSessionCookieMock: vi.fn(),
  recordAuditLogMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSession: getSessionMock,
  clearSessionCookie: clearSessionCookieMock,
}))
vi.mock('@/lib/audit-log', () => ({ recordAuditLog: recordAuditLogMock }))

import { POST } from '@/app/api/auth/logout/route'

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSessionCookieMock.mockResolvedValue(undefined)
    recordAuditLogMock.mockResolvedValue(undefined)
  })

  it('registra o logout do usuário autenticado antes de limpar a sessão', async () => {
    getSessionMock.mockResolvedValue({ userId: 4, username: 'admin', role: 'super_admin', secretariaId: null })

    const response = await POST()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(recordAuditLogMock).toHaveBeenCalledWith({
      actorUserId: 4,
      action: 'auth.logout',
      entityType: 'auth',
      entityId: 4,
      details: { username: 'admin', role: 'super_admin' },
    })
    expect(clearSessionCookieMock).toHaveBeenCalledOnce()
  })

  it('limpa a sessão sem gravar evento quando não existe usuário autenticado', async () => {
    getSessionMock.mockResolvedValue(null)

    const response = await POST()

    expect(response.status).toBe(200)
    expect(recordAuditLogMock).not.toHaveBeenCalled()
    expect(clearSessionCookieMock).toHaveBeenCalledOnce()
  })
})
