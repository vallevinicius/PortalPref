import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  bcryptMock,
  prismaMock,
  requireSessionMock,
  encryptSecretMock,
  decryptSecretMock,
  generateRandomPasswordMock,
  revalidatePathMock,
  UnauthorizedErrorMock,
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
    projeto: {
      findUnique: vi.fn(),
    },
    projetoResponsavel: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
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
  UnauthorizedErrorMock: class UnauthorizedError extends Error {},
}))

vi.mock('bcryptjs', () => ({ default: bcryptMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ requireSession: requireSessionMock, UnauthorizedError: UnauthorizedErrorMock }))
vi.mock('@/lib/crypto', () => ({
  encryptSecret: encryptSecretMock,
  decryptSecret: decryptSecretMock,
}))
vi.mock('@/lib/password', () => ({ generateRandomPassword: generateRandomPasswordMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import {
  assignProjetoUser,
  createProjetoUser,
  createSecretariaUser,
  createSuperAdmin,
  getProjetoUserPassword,
  getSecretariaUserPassword,
  getSuperAdminPassword,
  resetProjetoUserPassword,
  resetSecretariaUserPassword,
  resetSuperAdminPassword,
  unassignProjetoUser,
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
      data: { actorUserId: 1, action: 'view_password', entityType: 'user', entityId: 10, targetUserId: 10 },
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
      data: { actorUserId: 1, action: 'view_password', entityType: 'user', entityId: 2, targetUserId: 2 },
    })
  })

  describe('usuário responsável de projeto (projeto_admin)', () => {
    it('permite ao super admin criar o usuário do projeto', async () => {
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })
      prismaMock.user.create.mockResolvedValue({ id: 40 })

      await expect(createProjetoUser('  joao.responsavel  ', 20)).resolves.toEqual({
        username: 'joao.responsavel',
        password: 'SenhaGerada1',
      })
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          username: 'joao.responsavel',
          passwordHash: 'hash-gerado',
          passwordEncrypted: 'enc:SenhaGerada1',
          role: 'projeto_admin',
          projetosResponsavel: { create: { projetoId: 20 } },
        },
      })
    })

    it('permite ao admin da secretaria dona do projeto criar o usuário, e bloqueia para outra secretaria', async () => {
      requireSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })
      prismaMock.user.create.mockResolvedValue({ id: 40 })

      await expect(createProjetoUser('joao.responsavel', 20)).resolves.toEqual({
        username: 'joao.responsavel',
        password: 'SenhaGerada1',
      })

      prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 99 })
      await expect(createProjetoUser('joao.responsavel', 21)).rejects.toThrow(
        'Você não tem permissão para gerenciar o usuário deste projeto.',
      )
    })

    it('reseta senha somente de conta projeto_admin vinculada ao projeto informado', async () => {
      prismaMock.projetoResponsavel.findUnique.mockResolvedValue({ user: { id: 40, role: 'projeto_admin' } })
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })

      await expect(resetProjetoUserPassword(40, 20)).resolves.toEqual({ password: 'SenhaGerada1' })
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 40 },
        data: { passwordHash: 'hash-gerado', passwordEncrypted: 'enc:SenhaGerada1' },
      })

      prismaMock.projetoResponsavel.findUnique.mockResolvedValue(null)
      await expect(resetProjetoUserPassword(41, 20)).rejects.toThrow(
        'Usuário não encontrado ou não é uma conta de responsável de projeto.',
      )
    })

    it('revela senha do projeto após confirmar a senha do operador', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({ passwordHash: 'hash-do-root' })
      prismaMock.projetoResponsavel.findUnique.mockResolvedValue({
        user: { id: 40, role: 'projeto_admin', passwordEncrypted: 'enc:SenhaGerada1' },
      })
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })

      await expect(getProjetoUserPassword(40, 20, 'confirmada')).resolves.toEqual({ password: 'SenhaGerada1' })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: { actorUserId: 1, action: 'view_password', entityType: 'user', entityId: 40, targetUserId: 40 },
      })
    })

    it('permite ao super admin designar um usuário que ainda não tem nenhum projeto', async () => {
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 10 })
      prismaMock.user.findUnique.mockResolvedValue({
        id: 40,
        username: 'joao.responsavel',
        role: 'projeto_admin',
        projetosResponsavel: [],
      })

      await expect(assignProjetoUser(40, 21)).resolves.toEqual({ username: 'joao.responsavel' })
      expect(prismaMock.projetoResponsavel.create).toHaveBeenCalledWith({ data: { userId: 40, projetoId: 21 } })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorUserId: 1,
          action: 'user.assign',
          entityType: 'user',
          entityId: 40,
          targetUserId: 40,
          details: { projetoId: 21, secretariaId: 10 },
        },
      })
    })

    it('soma um segundo projeto ao usuário que já tem um projeto na mesma secretaria, sem afetar o primeiro', async () => {
      requireSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 10 })
      prismaMock.user.findUnique.mockResolvedValue({
        id: 40,
        username: 'joao.responsavel',
        role: 'projeto_admin',
        projetosResponsavel: [{ projeto: { id: 20, secretariaId: 10 } }],
      })

      await expect(assignProjetoUser(40, 21)).resolves.toEqual({ username: 'joao.responsavel' })
      expect(prismaMock.projetoResponsavel.create).toHaveBeenCalledWith({ data: { userId: 40, projetoId: 21 } })
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/projetos/21')
      expect(revalidatePathMock).not.toHaveBeenCalledWith('/admin/projetos/20')
    })

    it('bloqueia designar usuário com projeto de outra secretaria, tanto para secretaria quanto para o admin supremo', async () => {
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 10 })
      prismaMock.user.findUnique.mockResolvedValue({
        id: 40,
        username: 'joao.responsavel',
        role: 'projeto_admin',
        projetosResponsavel: [{ projeto: { id: 99, secretariaId: 77 } }],
      })

      await expect(assignProjetoUser(40, 21)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
      expect(prismaMock.projetoResponsavel.create).not.toHaveBeenCalled()

      requireSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })
      await expect(assignProjetoUser(40, 21)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
      expect(prismaMock.projetoResponsavel.create).not.toHaveBeenCalled()
    })

    it('rejeita designar usuário inexistente, de outro papel, ou já responsável pelo mesmo projeto', async () => {
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 10 })

      prismaMock.user.findUnique.mockResolvedValue(null)
      await expect(assignProjetoUser(40, 21)).rejects.toThrow(
        'Usuário não encontrado ou não é uma conta de responsável de projeto.',
      )

      prismaMock.user.findUnique.mockResolvedValue({ id: 41, username: 'admin-secretaria', role: 'secretaria_admin', projetosResponsavel: [] })
      await expect(assignProjetoUser(41, 21)).rejects.toThrow(
        'Usuário não encontrado ou não é uma conta de responsável de projeto.',
      )

      prismaMock.user.findUnique.mockResolvedValue({
        id: 40,
        username: 'joao.responsavel',
        role: 'projeto_admin',
        projetosResponsavel: [{ projeto: { id: 21, secretariaId: 10 } }],
      })
      await expect(assignProjetoUser(40, 21)).rejects.toThrow('Este usuário já é responsável por este projeto.')

      expect(prismaMock.projetoResponsavel.create).not.toHaveBeenCalled()
    })

    it('remove o responsável de um projeto específico, sem afetar os outros projetos dele', async () => {
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 10 })
      prismaMock.projetoResponsavel.findUnique.mockResolvedValue({ id: 5, userId: 40, projetoId: 21 })

      await unassignProjetoUser(40, 21)

      expect(prismaMock.projetoResponsavel.delete).toHaveBeenCalledWith({ where: { id: 5 } })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorUserId: 1,
          action: 'user.unassign',
          entityType: 'user',
          entityId: 40,
          targetUserId: 40,
          details: { projetoId: 21, secretariaId: 10 },
        },
      })
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/projetos/21')
    })

    it('rejeita remover quando o usuário não é responsável pelo projeto informado', async () => {
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 10 })
      prismaMock.projetoResponsavel.findUnique.mockResolvedValue(null)

      await expect(unassignProjetoUser(40, 21)).rejects.toThrow('Este usuário não é responsável por este projeto.')
      expect(prismaMock.projetoResponsavel.delete).not.toHaveBeenCalled()
    })
  })
})
