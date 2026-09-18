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
  sendVerificationCodeEmailMock,
  generateVerificationCodeMock,
} = vi.hoisted(() => ({
  bcryptMock: { compare: vi.fn(), hashSync: vi.fn().mockReturnValue('dummy-hash') },
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    projetoResponsavel: { findMany: vi.fn() },
  },
  createSessionTokenMock: vi.fn(),
  setSessionCookieMock: vi.fn(),
  clearLoginFailuresMock: vi.fn(),
  getLoginClientIdentifierMock: vi.fn(),
  getLoginThrottleStatusMock: vi.fn(),
  registerFailedLoginMock: vi.fn(),
  sendVerificationCodeEmailMock: vi.fn(),
  generateVerificationCodeMock: vi.fn(),
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
vi.mock('@/lib/mail', () => ({ sendVerificationCodeEmail: sendVerificationCodeEmailMock }))
vi.mock('@/lib/password', () => ({
  generateVerificationCode: generateVerificationCodeMock,
  VERIFICATION_CODE_DURATION_MS: 60 * 60 * 1000,
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
    prismaMock.user.update.mockResolvedValue(undefined)
    sendVerificationCodeEmailMock.mockResolvedValue(undefined)
    generateVerificationCodeMock.mockReturnValue({ code: '123456', codeHash: 'code-hash' })
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
      email: null,
      passwordHash: 'hash',
      role: 'super_admin',
      secretariaId: null,
      mustChangePassword: false,
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
      email: null,
      passwordHash: 'hash',
      role: 'secretaria_admin',
      secretariaId: 10,
      mustChangePassword: false,
    })

    const response = await POST(makeRequest({ username: 'saude-admin', password: 'secret' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, role: 'secretaria_admin', mustChangePassword: false })
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'saude-admin' },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        role: true,
        secretariaId: true,
        mustChangePassword: true,
      },
    })
    expect(clearLoginFailuresMock).toHaveBeenCalledWith('saude-admin', '203.0.113.10')
    expect(createSessionTokenMock).toHaveBeenCalledWith({
      userId: 7,
      username: 'saude-admin',
      role: 'secretaria_admin',
      secretariaId: 10,
      projetoIds: [],
      mustChangePassword: false,
    })
    expect(setSessionCookieMock).toHaveBeenCalledWith('token-gerado')
    expect(prismaMock.projetoResponsavel.findMany).not.toHaveBeenCalled()
    expect(sendVerificationCodeEmailMock).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('busca todos os projetos vinculados ao logar como responsável de projeto', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 40,
      username: 'joao.responsavel',
      email: null,
      passwordHash: 'hash',
      role: 'projeto_admin',
      secretariaId: null,
      mustChangePassword: false,
    })
    prismaMock.projetoResponsavel.findMany.mockResolvedValue([{ projetoId: 20 }, { projetoId: 21 }])

    const response = await POST(makeRequest({ username: 'joao.responsavel', password: 'secret' }))

    expect(response.status).toBe(200)
    expect(prismaMock.projetoResponsavel.findMany).toHaveBeenCalledWith({
      where: { userId: 40 },
      select: { projetoId: true },
    })
    expect(createSessionTokenMock).toHaveBeenCalledWith({
      userId: 40,
      username: 'joao.responsavel',
      role: 'projeto_admin',
      secretariaId: null,
      projetoIds: [20, 21],
      mustChangePassword: false,
    })
  })

  it('quando a senha ainda é a padrão, gera código, envia e-mail e mesmo assim cria a sessão', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 8,
      username: 'saude-admin',
      email: 'saude@prefeitura.gov.br',
      passwordHash: 'hash',
      role: 'secretaria_admin',
      secretariaId: 10,
      mustChangePassword: true,
    })

    const response = await POST(makeRequest({ username: 'saude-admin', password: 'mudar123' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, role: 'secretaria_admin', mustChangePassword: true })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: {
        passwordResetToken: 'code-hash',
        passwordResetExpires: expect.any(Date),
      },
    })
    expect(sendVerificationCodeEmailMock).toHaveBeenCalledWith('saude@prefeitura.gov.br', '123456')
    expect(createSessionTokenMock).toHaveBeenCalledWith({
      userId: 8,
      username: 'saude-admin',
      role: 'secretaria_admin',
      secretariaId: 10,
      projetoIds: [],
      mustChangePassword: true,
    })
    expect(setSessionCookieMock).toHaveBeenCalledWith('token-gerado')
  })

  it('não trava o login se o envio do e-mail de confirmação falhar', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 9,
      username: 'saude-admin',
      email: 'saude@prefeitura.gov.br',
      passwordHash: 'hash',
      role: 'secretaria_admin',
      secretariaId: 10,
      mustChangePassword: true,
    })
    sendVerificationCodeEmailMock.mockRejectedValue(new Error('SMTP fora do ar'))

    const response = await POST(makeRequest({ username: 'saude-admin', password: 'mudar123' }))

    expect(response.status).toBe(200)
    expect(setSessionCookieMock).toHaveBeenCalledWith('token-gerado')
  })

  it('não envia e-mail de confirmação quando o usuário não tem e-mail cadastrado', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 10,
      username: 'legado-admin',
      email: null,
      passwordHash: 'hash',
      role: 'secretaria_admin',
      secretariaId: 10,
      mustChangePassword: true,
    })

    const response = await POST(makeRequest({ username: 'legado-admin', password: 'mudar123' }))

    expect(response.status).toBe(200)
    expect(sendVerificationCodeEmailMock).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(setSessionCookieMock).toHaveBeenCalledWith('token-gerado')
  })
})
