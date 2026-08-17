import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    loginThrottle: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  clearLoginFailures,
  getLoginClientIdentifier,
  getLoginThrottleStatus,
  registerFailedLogin,
} from '@/lib/login-throttle'

describe('controlador de tentativas de login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.loginThrottle.findMany.mockResolvedValue([])
    prismaMock.loginThrottle.findUnique.mockResolvedValue(null)
    prismaMock.loginThrottle.upsert.mockResolvedValue({})
    prismaMock.loginThrottle.deleteMany.mockResolvedValue({ count: 2 })
  })

  it('prioriza o primeiro endereço encaminhado pelo proxy', () => {
    const request = new Request('http://localhost/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.20, 198.51.100.4' },
    })

    expect(getLoginClientIdentifier(request)).toBe('203.0.113.20')
  })

  it('não bloqueia quando não existe bloqueio ativo', async () => {
    await expect(getLoginThrottleStatus('admin', '203.0.113.20')).resolves.toEqual({
      blocked: false,
      retryAfterSeconds: 0,
    })
    expect(prismaMock.loginThrottle.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: { in: expect.arrayContaining([expect.any(String), expect.any(String)]) } },
    }))
  })

  it('informa o tempo restante quando há bloqueio ativo', async () => {
    prismaMock.loginThrottle.findMany.mockResolvedValue([
      { blockedUntil: new Date(Date.now() + 90_000) },
      { blockedUntil: null },
    ])

    const result = await getLoginThrottleStatus('admin', '203.0.113.20')

    expect(result.blocked).toBe(true)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(90)
  })

  it('registra falhas em chaves hash por usuário e origem', async () => {
    await registerFailedLogin('Admin', '203.0.113.20')

    expect(prismaMock.loginThrottle.upsert).toHaveBeenCalledTimes(2)
    const firstCall = prismaMock.loginThrottle.upsert.mock.calls[0][0]
    expect(firstCall.where.key).toMatch(/^[a-f0-9]{64}$/)
    expect(firstCall.where.key).not.toContain('admin')
    expect(firstCall.create.failedAttempts).toBe(1)
    expect(firstCall.create.blockedUntil).toBeNull()
  })

  it('bloqueia a chave ao atingir cinco falhas na janela', async () => {
    prismaMock.loginThrottle.findUnique.mockResolvedValue({
      key: 'hash',
      failedAttempts: 4,
      windowStartedAt: new Date(),
      blockedUntil: null,
      updatedAt: new Date(),
    })

    await registerFailedLogin('admin', '203.0.113.20')

    expect(prismaMock.loginThrottle.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        failedAttempts: 5,
        blockedUntil: expect.any(Date),
      }),
    }))
  })

  it('remove as falhas anteriores após autenticação válida', async () => {
    await clearLoginFailures('admin', '203.0.113.20')

    expect(prismaMock.loginThrottle.deleteMany).toHaveBeenCalledWith({
      where: { key: { in: expect.arrayContaining([expect.any(String), expect.any(String)]) } },
    })
  })
})
