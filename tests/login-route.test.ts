import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  bcryptMock,
  prismaMock,
  createSessionTokenMock,
  setSessionCookieMock,
  clearLoginFailuresMock,
  getLoginClientIdentifierMock,
  getLoginThrottleStatusMock,
  registerFailedLoginMock,
} = vi.hoisted(() => ({
  bcryptMock: { compare: vi.fn() },
  prismaMock: {
    user: { findUnique: vi.fn() },
  },
  createSessionTokenMock: vi.fn(),
  setSessionCookieMock: vi.fn(),
  clearLoginFailuresMock: vi.fn(),
  getLoginClientIdentifierMock: vi.fn(),
  getLoginThrottleStatusMock: vi.fn(),
  registerFailedLoginMock: vi.fn(),
}))

vi.mock('bcryptjs', () => ({ default: bcryptMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({
  createSessionToken: createSessionTokenMock,
  setSessionCookie: setSessionCookieMock,
}))
vi.mock('@/lib/login-throttle', () => ({
  clearLoginFailures: clearLoginFailuresMock,
  getLoginClientIdentifier: getLoginClientIdentifierMock,
  getLoginThrottleStatus: getLoginThrottleStatusMock,
  registerFailedLogin: registerFailedLoginMock,
}))

import { POST } from '@/app/api/auth/login/route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bcryptMock.compare.mockResolvedValue(true)
    createSessionTokenMock.mockResolvedValue('token-gerado')
    setSessionCookieMock.mockResolvedValue(undefined)
    clearLoginFailuresMock.mockResolvedValue(undefined)
    getLoginClientIdentifierMock.mockReturnValue('203.0.113.10')
    getLoginThrottleStatusMock.mockResolvedValue({ blocked: false, retryAfterSeconds: 0 })
    registerFailedLoginMock.mockResolvedValue(undefined)
  })

  it('retorna 400 para credenciais ausentes', async () => {
    const response = await POST(makeRequest({ username: '', password: '' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Usuário e senha são obrigatórios.' })
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(getLoginThrottleStatusMock).not.toHaveBeenCalled()
  })

  it('retorna 401 e registra falha para usuário inexistente ou senha inválida', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const missingUserResponse = await POST(makeRequest({ username: 'unknown', password: 'secret' }))
    expect(missingUserResponse.status).toBe(401)

    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: 'hash',
      role: 'super_admin',
      secretariaId: null,
    })
    bcryptMock.compare.mockResolvedValue(false)
    const wrongPasswordResponse = await POST(makeRequest({ username: 'admin', password: 'wrong' }))
    expect(wrongPasswordResponse.status).toBe(401)
    expect(createSessionTokenMock).not.toHaveBeenCalled()
    expect(registerFailedLoginMock).toHaveBeenCalledTimes(2)
  })

  it('bloqueia temporariamente novas tentativas quando o limite é atingido', async () => {
    getLoginThrottleStatusMock.mockResolvedValue({ blocked: true, retryAfterSeconds: 420 })

    const response = await POST(makeRequest({ username: 'admin', password: 'wrong' }))

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('420')
    await expect(response.json()).resolves.toEqual({ error: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.' })
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(registerFailedLoginMock).not.toHaveBeenCalled()
  })

  it('cria sessão, limpa falhas anteriores e retorna o papel do usuário válido', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 7,
      username: 'saude-admin',
      passwordHash: 'hash',
      role: 'secretaria_admin',
      secretariaId: 10,
    })

    const response = await POST(makeRequest({ username: 'saude-admin', password: 'secret' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, role: 'secretaria_admin' })
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'saude-admin' },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        role: true,
        secretariaId: true,
      },
    })
    expect(clearLoginFailuresMock).toHaveBeenCalledWith('saude-admin', '203.0.113.10')
    expect(createSessionTokenMock).toHaveBeenCalledWith({
      userId: 7,
      username: 'saude-admin',
      role: 'secretaria_admin',
      secretariaId: 10,
    })
    expect(setSessionCookieMock).toHaveBeenCalledWith('token-gerado')
  })
})
