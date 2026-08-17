import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  bcryptMock,
  prismaMock,
  requireSessionMock,
  encryptSecretMock,
  decryptSecretMock,
  generateRandomPasswordMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  bcryptMock: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  prismaMock: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
  requireSessionMock: vi.fn(),
  encryptSecretMock: vi.fn(),
  decryptSecretMock: vi.fn(),
  generateRandomPasswordMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('bcryptjs', () => ({ default: bcryptMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ requireSession: requireSessionMock }))
vi.mock('@/lib/crypto', () => ({
  encryptSecret: encryptSecretMock,
  decryptSecret: decryptSecretMock,
}))
vi.mock('@/lib/password', () => ({ generateRandomPassword: generateRandomPasswordMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import {
  createSecretariaUser,
  createSuperAdmin,
  getSecretariaUserPassword,
  getSuperAdminPassword,
  resetSecretariaUserPassword,
  resetSuperAdminPassword,
} from '@/lib/actions/users'

describe('ações de usuários e credenciais', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 1, username: 'root', role: 'super_admin', secretariaId: null })
    generateRandomPasswordMock.mockReturnValue('SenhaGerada1')
    bcryptMock.hash.mockResolvedValue('hash-gerado')
    bcryptMock.compare.mockResolvedValue(true)
    encryptSecretMock.mockImplementation((password: string) => `enc:${password}`)
    decryptSecretMock.mockImplementation((secret: string) => secret.replace('enc:', ''))
  })

  it('cria usuário de secretaria com senha gerada, hash e cifra', async () => {
    const result = await createSecretariaUser('  secretaria-admin  ', 10)

    expect(result).toEqual({ username: 'secretaria-admin', password: 'SenhaGerada1' })
    expect(bcryptMock.hash).toHaveBeenCalledWith('SenhaGerada1', 12)
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        username: 'secretaria-admin',
        passwordHash: 'hash-gerado',
        passwordEncrypted: 'enc:SenhaGerada1',
        role: 'secretaria_admin',
        secretariaId: 10,
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })

  it('rejeita username vazio e traduz conflito de unicidade', async () => {
    await expect(createSecretariaUser(' ', 10)).rejects.toThrow('Informe o usuário de acesso da secretaria.')

    prismaMock.user.create.mockRejectedValue({ code: 'P2002' })
    await expect(createSecretariaUser('admin', 10)).rejects.toThrow('Já existe um usuário com esse nome de acesso.')
  })

  it('reseta senha de usuário de secretaria existente', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 10, role: 'secretaria_admin' })

    await expect(resetSecretariaUserPassword(10)).resolves.toEqual({ password: 'SenhaGerada1' })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { passwordHash: 'hash-gerado', passwordEncrypted: 'enc:SenhaGerada1' },
    })
  })

  it('não reseta usuário inexistente ou de outro papel', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 10, role: 'super_admin' })

    await expect(resetSecretariaUserPassword(10)).rejects.toThrow(
      'Usuário não encontrado ou não é uma conta de secretaria.',
    )
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('revela senha de secretaria somente após confirmar a senha do operador e audita o acesso', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ passwordHash: 'hash-do-root' })
      .mockResolvedValueOnce({ id: 10, role: 'secretaria_admin', passwordEncrypted: 'enc:SenhaGerada1' })

    await expect(getSecretariaUserPassword(10, 'confirmada')).resolves.toEqual({ password: 'SenhaGerada1' })
    expect(bcryptMock.compare).toHaveBeenCalledWith('confirmada', 'hash-do-root')
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: { actorUserId: 1, action: 'view_password', targetUserId: 10 },
    })
  })

  it('bloqueia revelação com confirmação incorreta ou senha cifrada ausente', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ passwordHash: 'hash-do-root' })
    bcryptMock.compare.mockResolvedValue(false)
    await expect(getSecretariaUserPassword(10, 'errada')).rejects.toThrow('Senha incorreta.')

    bcryptMock.compare.mockResolvedValue(true)
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ passwordHash: 'hash-do-root' })
      .mockResolvedValueOnce({ id: 10, role: 'secretaria_admin', passwordEncrypted: null })
    await expect(getSecretariaUserPassword(10, 'confirmada')).rejects.toThrow(
      'Esta senha foi definida antes deste recurso existir. Gere uma nova senha para poder visualizá-la.',
    )
  })

  it('cria super admin sem secretaria vinculada', async () => {
    await expect(createSuperAdmin('  novo-root ')).resolves.toEqual({
      username: 'novo-root',
      password: 'SenhaGerada1',
    })
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        username: 'novo-root',
        passwordHash: 'hash-gerado',
        passwordEncrypted: 'enc:SenhaGerada1',
        role: 'super_admin',
        secretariaId: null,
      },
    })
  })

  it('rejeita super admin vazio e conflito de username', async () => {
    await expect(createSuperAdmin(' ')).rejects.toThrow('Informe o usuário de acesso.')

    prismaMock.user.create.mockRejectedValue({ code: 'P2002' })
    await expect(createSuperAdmin('root-2')).rejects.toThrow('Já existe um usuário com esse nome de acesso.')
  })

  it('reseta e revela senha de super admin válido', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: 2, role: 'super_admin' })
    await expect(resetSuperAdminPassword(2)).resolves.toEqual({ password: 'SenhaGerada1' })

    prismaMock.user.findUnique
      .mockResolvedValueOnce({ passwordHash: 'hash-do-root' })
      .mockResolvedValueOnce({ id: 2, role: 'super_admin', passwordEncrypted: 'enc:SenhaGerada1' })
    await expect(getSuperAdminPassword(2, 'confirmada')).resolves.toEqual({ password: 'SenhaGerada1' })
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: { actorUserId: 1, action: 'view_password', targetUserId: 2 },
    })
  })
})
