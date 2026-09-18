import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  bcryptMock,
  prismaMock,
  getSessionMock,
  createSessionTokenMock,
  setSessionCookieMock,
  recordAuditLogMock,
  sendVerificationCodeEmailMock,
  generateVerificationCodeMock,
  hashVerificationCodeMock,
  revalidatePathMock,
  headersMock,
  isBootstrapAdminUsernameMock,
  getLoginThrottleStatusMock,
  registerFailedLoginMock,
  clearLoginFailuresMock,
} = vi.hoisted(() => ({
  bcryptMock: { hash: vi.fn() },
  prismaMock: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    projetoResponsavel: { findMany: vi.fn() },
  },
  getSessionMock: vi.fn(),
  createSessionTokenMock: vi.fn(),
  setSessionCookieMock: vi.fn(),
  recordAuditLogMock: vi.fn(),
  sendVerificationCodeEmailMock: vi.fn(),
  generateVerificationCodeMock: vi.fn(),
  hashVerificationCodeMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  headersMock: vi.fn(),
  isBootstrapAdminUsernameMock: vi.fn(),
  getLoginThrottleStatusMock: vi.fn(),
  registerFailedLoginMock: vi.fn(),
  clearLoginFailuresMock: vi.fn(),
}))

vi.mock('bcryptjs', () => ({ default: bcryptMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({
  getSession: getSessionMock,
  createSessionToken: createSessionTokenMock,
  setSessionCookie: setSessionCookieMock,
}))
vi.mock('@/lib/audit-log', () => ({ recordAuditLog: recordAuditLogMock }))
vi.mock('@/lib/bootstrap-admin', () => ({ isBootstrapAdminUsername: isBootstrapAdminUsernameMock }))
vi.mock('@/lib/login-throttle', () => ({
  getLoginThrottleStatus: getLoginThrottleStatusMock,
  registerFailedLogin: registerFailedLoginMock,
  clearLoginFailures: clearLoginFailuresMock,
}))
vi.mock('@/lib/mail', () => ({ sendVerificationCodeEmail: sendVerificationCodeEmailMock }))
vi.mock('@/lib/password', () => ({
  generateVerificationCode: generateVerificationCodeMock,
  hashVerificationCode: hashVerificationCodeMock,
  VERIFICATION_CODE_DURATION_MS: 60 * 60 * 1000,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('next/headers', () => ({ headers: headersMock }))

import { definirNovaSenha, reenviarCodigoVerificacao, redefinirSenhaComCodigo, solicitarRecuperacaoSenha } from '@/lib/actions/auth'

const SESSION = {
  userId: 7,
  username: 'saude-admin',
  role: 'secretaria_admin' as const,
  secretariaId: 10,
  projetoIds: [],
  mustChangePassword: true,
}

describe('ações de autenticação (troca de senha por código)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionMock.mockResolvedValue(SESSION)
    bcryptMock.hash.mockResolvedValue('hash-nova-senha')
    createSessionTokenMock.mockResolvedValue('novo-token')
    setSessionCookieMock.mockResolvedValue(undefined)
    generateVerificationCodeMock.mockReturnValue({ code: '123456', codeHash: 'hash-do-codigo' })
    hashVerificationCodeMock.mockImplementation((code: string) => `hash-de-${code}`)
    headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.10' }))
    isBootstrapAdminUsernameMock.mockReturnValue(false)
    getLoginThrottleStatusMock.mockResolvedValue({ blocked: false, retryAfterSeconds: 0 })
    registerFailedLoginMock.mockResolvedValue(undefined)
    clearLoginFailuresMock.mockResolvedValue(undefined)
    prismaMock.projetoResponsavel.findMany.mockResolvedValue([])
  })

  describe('reenviarCodigoVerificacao', () => {
    it('gera um novo código, salva o hash e reenvia por e-mail', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ email: 'saude@prefeitura.gov.br' })

      await expect(reenviarCodigoVerificacao()).resolves.toEqual({ ok: true })

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: {
          passwordResetToken: 'hash-do-codigo',
          passwordResetExpires: expect.any(Date),
        },
      })
      expect(sendVerificationCodeEmailMock).toHaveBeenCalledWith('saude@prefeitura.gov.br', '123456')
    })

    it('rejeita sem sessão ou quando a senha já foi trocada', async () => {
      getSessionMock.mockResolvedValue(null)
      await expect(reenviarCodigoVerificacao()).rejects.toThrow('Sessão expirada. Faça login novamente.')

      getSessionMock.mockResolvedValue({ ...SESSION, mustChangePassword: false })
      await expect(reenviarCodigoVerificacao()).rejects.toThrow('Sua senha já foi definida.')
    })

    it('rejeita quando o usuário não tem e-mail cadastrado', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ email: null })
      await expect(reenviarCodigoVerificacao()).rejects.toThrow('Sua conta não tem e-mail cadastrado. Contate um administrador.')
    })
  })

  describe('definirNovaSenha', () => {
    function mockUsuarioComCodigo(overrides: Partial<{ passwordResetToken: string | null; passwordResetExpires: Date | null }> = {}) {
      prismaMock.user.findUnique.mockResolvedValue({
        passwordResetToken: 'hash-de-123456',
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
        ...overrides,
      })
    }

    it('valida o código, troca a senha, limpa o código e cria uma nova sessão sem exigência de troca', async () => {
      mockUsuarioComCodigo()

      const result = await definirNovaSenha('123456', 'minhaSenhaNova')

      expect(result).toEqual({ role: 'secretaria_admin' })
      expect(bcryptMock.hash).toHaveBeenCalledWith('minhaSenhaNova', 12)
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: {
          passwordHash: 'hash-nova-senha',
          mustChangePassword: false,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      })
      expect(recordAuditLogMock).toHaveBeenCalledWith({
        actorUserId: 7,
        action: 'user.password_self_change',
        entityType: 'user',
        entityId: 7,
        targetUserId: 7,
      })
      expect(createSessionTokenMock).toHaveBeenCalledWith({
        userId: 7,
        username: 'saude-admin',
        role: 'secretaria_admin',
        secretariaId: 10,
        projetoIds: [],
        mustChangePassword: false,
      })
      expect(setSessionCookieMock).toHaveBeenCalledWith('novo-token')
    })

    it('rejeita código incorreto', async () => {
      mockUsuarioComCodigo()

      await expect(definirNovaSenha('999999', 'minhaSenhaNova')).rejects.toThrow(
        'Código incorreto. Confira o número recebido por e-mail.',
      )
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('rejeita código expirado ou ausente', async () => {
      mockUsuarioComCodigo({ passwordResetExpires: new Date(Date.now() - 1000) })
      await expect(definirNovaSenha('123456', 'minhaSenhaNova')).rejects.toThrow('Código expirado. Peça um novo código.')

      mockUsuarioComCodigo({ passwordResetToken: null })
      await expect(definirNovaSenha('123456', 'minhaSenhaNova')).rejects.toThrow('Código expirado. Peça um novo código.')
    })

    it('rejeita senha curta ou código vazio antes de consultar o banco', async () => {
      await expect(definirNovaSenha('123456', '123')).rejects.toThrow('A senha precisa ter pelo menos 6 caracteres.')
      await expect(definirNovaSenha('   ', 'minhaSenhaNova')).rejects.toThrow('Digite o código de confirmação recebido por e-mail.')
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('rejeita sem sessão ativa', async () => {
      getSessionMock.mockResolvedValue(null)
      await expect(definirNovaSenha('123456', 'minhaSenhaNova')).rejects.toThrow('Sessão expirada. Faça login novamente.')
    })
  })

  describe('solicitarRecuperacaoSenha (esqueci minha senha)', () => {
    it('gera e envia um código quando a conta existe, e registra a tentativa no throttle', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 12,
        username: 'saude-admin',
        email: 'saude@prefeitura.gov.br',
        role: 'secretaria_admin',
        secretariaId: 10,
        passwordResetToken: null,
        passwordResetExpires: null,
      })

      await expect(solicitarRecuperacaoSenha('saude-admin')).resolves.toEqual({ ok: true })

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ username: 'saude-admin' }, { email: 'saude-admin' }] },
        select: expect.any(Object),
      })
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 12 },
        data: { passwordResetToken: 'hash-do-codigo', passwordResetExpires: expect.any(Date) },
      })
      expect(sendVerificationCodeEmailMock).toHaveBeenCalledWith('saude@prefeitura.gov.br', '123456')
      expect(registerFailedLoginMock).toHaveBeenCalledWith('reset:saude-admin', '203.0.113.10')
    })

    it('responde com sucesso mesmo quando a conta não existe, sem enviar e-mail', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)

      await expect(solicitarRecuperacaoSenha('ninguem@x.com')).resolves.toEqual({ ok: true })
      expect(sendVerificationCodeEmailMock).not.toHaveBeenCalled()
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('não permite recuperar a senha do admin definido pelo .env', async () => {
      isBootstrapAdminUsernameMock.mockReturnValue(true)
      prismaMock.user.findFirst.mockResolvedValue({ id: 1, email: 'x@x.com' })

      await expect(solicitarRecuperacaoSenha('admin')).resolves.toEqual({ ok: true })
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
      expect(sendVerificationCodeEmailMock).not.toHaveBeenCalled()
    })

    it('rejeita quando bloqueado por excesso de tentativas, e rejeita campo vazio', async () => {
      await expect(solicitarRecuperacaoSenha('  ')).rejects.toThrow('Informe seu usuário ou e-mail.')

      getLoginThrottleStatusMock.mockResolvedValue({ blocked: true, retryAfterSeconds: 300 })
      await expect(solicitarRecuperacaoSenha('saude-admin')).rejects.toThrow(
        'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      )
    })
  })

  describe('redefinirSenhaComCodigo (esqueci minha senha)', () => {
    function mockUsuarioComCodigo(overrides: Record<string, unknown> = {}) {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 12,
        username: 'saude-admin',
        email: 'saude@prefeitura.gov.br',
        role: 'secretaria_admin',
        secretariaId: 10,
        passwordResetToken: 'hash-de-123456',
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
        ...overrides,
      })
    }

    it('valida o código, troca a senha e cria uma sessão nova', async () => {
      mockUsuarioComCodigo()

      const result = await redefinirSenhaComCodigo('saude-admin', '123456', 'minhaSenhaNova')

      expect(result).toEqual({ role: 'secretaria_admin' })
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 12 },
        data: {
          passwordHash: 'hash-nova-senha',
          mustChangePassword: false,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      })
      expect(createSessionTokenMock).toHaveBeenCalledWith({
        userId: 12,
        username: 'saude-admin',
        role: 'secretaria_admin',
        secretariaId: 10,
        projetoIds: [],
        mustChangePassword: false,
      })
      expect(setSessionCookieMock).toHaveBeenCalledWith('novo-token')
      expect(clearLoginFailuresMock).toHaveBeenCalledWith('reset:saude-admin', '203.0.113.10')
    })

    it('rejeita código incorreto ou quando a conta não existe, e registra a falha no throttle', async () => {
      mockUsuarioComCodigo()
      await expect(redefinirSenhaComCodigo('saude-admin', '999999', 'minhaSenhaNova')).rejects.toThrow(
        'Código incorreto ou expirado.',
      )
      expect(registerFailedLoginMock).toHaveBeenCalledWith('reset:saude-admin', '203.0.113.10')

      prismaMock.user.findFirst.mockResolvedValue(null)
      await expect(redefinirSenhaComCodigo('ninguem@x.com', '123456', 'minhaSenhaNova')).rejects.toThrow(
        'Código incorreto ou expirado.',
      )

      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('rejeita quando bloqueado por excesso de tentativas', async () => {
      getLoginThrottleStatusMock.mockResolvedValue({ blocked: true, retryAfterSeconds: 300 })
      await expect(redefinirSenhaComCodigo('saude-admin', '123456', 'minhaSenhaNova')).rejects.toThrow(
        'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      )
    })

    it('rejeita senha curta, código vazio ou identificação vazia antes de consultar o banco', async () => {
      await expect(redefinirSenhaComCodigo('', '123456', 'minhaSenhaNova')).rejects.toThrow('Informe seu usuário ou e-mail.')
      await expect(redefinirSenhaComCodigo('saude-admin', '123456', '123')).rejects.toThrow(
        'A senha precisa ter pelo menos 6 caracteres.',
      )
      await expect(redefinirSenhaComCodigo('saude-admin', '   ', 'minhaSenhaNova')).rejects.toThrow(
        'Digite o código de confirmação recebido por e-mail.',
      )
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    })
  })
})
