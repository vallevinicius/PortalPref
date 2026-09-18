import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  bcryptMock,
  prismaMock,
  requireSessionMock,
  generateRandomPasswordMock,
  generateVerificationCodeMock,
  sendVerificationCodeEmailMock,
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
      delete: vi.fn(),
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
  generateRandomPasswordMock: vi.fn(),
  generateVerificationCodeMock: vi.fn(),
  sendVerificationCodeEmailMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  UnauthorizedErrorMock: class UnauthorizedError extends Error {},
}))

vi.mock('bcryptjs', () => ({ default: bcryptMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ requireSession: requireSessionMock, UnauthorizedError: UnauthorizedErrorMock }))
vi.mock('@/lib/mail', () => ({ sendVerificationCodeEmail: sendVerificationCodeEmailMock }))
vi.mock('@/lib/password', () => ({
  generateRandomPassword: generateRandomPasswordMock,
  generateVerificationCode: generateVerificationCodeMock,
  DEFAULT_PASSWORD: 'mudar123',
  VERIFICATION_CODE_DURATION_MS: 60 * 60 * 1000,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import {
  assignProjetoUser,
  createProjetoUser,
  createSecretariaUser,
  createSuperAdmin,
  deleteUser,
  enviarRedefinicaoSenha,
  unassignProjetoUser,
  updateUserProfile,
} from '@/lib/actions/users'

describe('ações de usuários e credenciais', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 1, username: 'root', role: 'super_admin', secretariaId: null })
    generateRandomPasswordMock.mockReturnValue('SenhaGerada1')
    generateVerificationCodeMock.mockReturnValue({ code: '123456', codeHash: 'hash-do-codigo' })
    sendVerificationCodeEmailMock.mockResolvedValue(undefined)
    bcryptMock.hash.mockResolvedValue('hash-gerado')
    bcryptMock.compare.mockResolvedValue(true)
  })

  it('cria usuário de secretaria com senha padrão e hash', async () => {
    const result = await createSecretariaUser('  secretaria-admin  ', '  admin@prefeitura.gov.br  ', 10)

    expect(result).toEqual({ username: 'secretaria-admin', password: 'mudar123' })
    expect(bcryptMock.hash).toHaveBeenCalledWith('mudar123', 12)
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        username: 'secretaria-admin',
        email: 'admin@prefeitura.gov.br',
        passwordHash: 'hash-gerado',
        mustChangePassword: true,
        role: 'secretaria_admin',
        secretariaId: 10,
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })

  it('rejeita username ou e-mail vazio e traduz conflito de unicidade', async () => {
    await expect(createSecretariaUser(' ', 'admin@prefeitura.gov.br', 10)).rejects.toThrow(
      'Informe o nome de usuário de acesso da secretaria.',
    )
    await expect(createSecretariaUser('admin', ' ', 10)).rejects.toThrow('Informe o e-mail de acesso da secretaria.')

    prismaMock.user.create.mockRejectedValue({ code: 'P2002', meta: { target: ['username'] } })
    await expect(createSecretariaUser('admin', 'admin@prefeitura.gov.br', 10)).rejects.toThrow(
      'Já existe um usuário com esse nome de acesso.',
    )

    prismaMock.user.create.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } })
    await expect(createSecretariaUser('admin', 'admin@prefeitura.gov.br', 10)).rejects.toThrow(
      'Já existe um usuário com esse e-mail.',
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

  describe('usuário responsável de projeto (projeto_admin)', () => {
    it('permite ao super admin criar o usuário do projeto', async () => {
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })
      prismaMock.user.create.mockResolvedValue({ id: 40 })

      await expect(createProjetoUser('  joao.responsavel  ', '  joao@prefeitura.gov.br  ', 20)).resolves.toEqual({
        username: 'joao.responsavel',
        password: 'mudar123',
      })
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          username: 'joao.responsavel',
          email: 'joao@prefeitura.gov.br',
          passwordHash: 'hash-gerado',
          mustChangePassword: true,
          role: 'projeto_admin',
          projetosResponsavel: { create: { projetoId: 20 } },
        },
      })
    })

    it('permite ao admin da secretaria dona do projeto criar o usuário, e bloqueia para outra secretaria', async () => {
      requireSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })
      prismaMock.user.create.mockResolvedValue({ id: 40 })

      await expect(createProjetoUser('joao.responsavel', 'joao@prefeitura.gov.br', 20)).resolves.toEqual({
        username: 'joao.responsavel',
        password: 'mudar123',
      })

      prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 99 })
      await expect(createProjetoUser('joao.responsavel', 'joao@prefeitura.gov.br', 21)).rejects.toThrow(
        'Você não tem permissão para gerenciar o usuário deste projeto.',
      )
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

    it('bloqueia secretaria de designar usuário para projeto de outra secretaria', async () => {
      requireSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 99 })

      await expect(assignProjetoUser(40, 21)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
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

    it('remove o responsável de um projeto específico, sem afetar os outros projetos dele, para super admin e secretaria dona', async () => {
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

      requireSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })
      await unassignProjetoUser(40, 21)
      expect(prismaMock.projetoResponsavel.delete).toHaveBeenCalledTimes(2)
    })

    it('bloqueia secretaria de remover responsável de projeto de outra secretaria', async () => {
      requireSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 22, secretariaId: 99 })

      await expect(unassignProjetoUser(40, 22)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
      expect(prismaMock.projetoResponsavel.delete).not.toHaveBeenCalled()
    })

    it('rejeita remover quando o usuário não é responsável pelo projeto informado', async () => {
      prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 10 })
      prismaMock.projetoResponsavel.findUnique.mockResolvedValue(null)

      await expect(unassignProjetoUser(40, 21)).rejects.toThrow('Este usuário não é responsável por este projeto.')
      expect(prismaMock.projetoResponsavel.delete).not.toHaveBeenCalled()
    })
  })

  describe('updateUserProfile (edita usuário/e-mail sem tocar em senha)', () => {
    it('atualiza usuário e e-mail de um secretário', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 10, username: 'saude-admin', role: 'secretaria_admin' })

      await updateUserProfile(10, '  novo.usuario  ', '  novo@prefeitura.gov.br  ')

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { username: 'novo.usuario', email: 'novo@prefeitura.gov.br' },
      })
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/usuarios')
    })

    it('rejeita quando o usuário não existe ou não é secretário/responsável de projeto', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      await expect(updateUserProfile(999, 'user', 'user@x.com')).rejects.toThrow('Usuário não encontrado.')

      prismaMock.user.findUnique.mockResolvedValue({ id: 1, username: 'root', role: 'super_admin' })
      await expect(updateUserProfile(1, 'user', 'user@x.com')).rejects.toThrow('Usuário não encontrado.')

      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('rejeita usuário ou e-mail vazio e traduz conflito de unicidade', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 10, username: 'saude-admin', role: 'secretaria_admin' })

      await expect(updateUserProfile(10, ' ', 'user@x.com')).rejects.toThrow('Informe o nome de usuário.')
      await expect(updateUserProfile(10, 'user', ' ')).rejects.toThrow('Informe o e-mail.')

      prismaMock.user.update.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } })
      await expect(updateUserProfile(10, 'user', 'user@x.com')).rejects.toThrow('Já existe um usuário com esse e-mail.')
    })

    it('bloqueia edição do admin definido pelo .env do servidor', async () => {
      process.env.ADMIN_USERNAME = 'admin'
      prismaMock.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', role: 'secretaria_admin' })

      await expect(updateUserProfile(1, 'novo', 'novo@x.com')).rejects.toThrow(
        'Este usuário é definido pelo .env do servidor e não pode ser editado por aqui.',
      )
      expect(prismaMock.user.update).not.toHaveBeenCalled()
      delete process.env.ADMIN_USERNAME
    })

    it('exige sessão de super admin ou secretaria admin', async () => {
      requireSessionMock.mockRejectedValue(new UnauthorizedErrorMock())
      await expect(updateUserProfile(10, 'user', 'user@x.com')).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    })

    it('permite à secretaria editar responsável de projeto da própria secretaria, e bloqueia secretário e projetos de fora', async () => {
      requireSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })

      prismaMock.user.findUnique.mockResolvedValue({
        id: 40,
        username: 'joao.responsavel',
        role: 'projeto_admin',
        projetosResponsavel: [{ projeto: { secretariaId: 10 } }],
      })
      await updateUserProfile(40, 'joao.novo', 'joao@prefeitura.gov.br')
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 40 },
        data: { username: 'joao.novo', email: 'joao@prefeitura.gov.br' },
      })

      prismaMock.user.findUnique.mockResolvedValue({ id: 10, username: 'outra-secretaria', role: 'secretaria_admin', projetosResponsavel: [] })
      await expect(updateUserProfile(10, 'user', 'user@x.com')).rejects.toBeInstanceOf(UnauthorizedErrorMock)

      prismaMock.user.findUnique.mockResolvedValue({
        id: 41,
        username: 'fora.secretaria',
        role: 'projeto_admin',
        projetosResponsavel: [{ projeto: { secretariaId: 99 } }],
      })
      await expect(updateUserProfile(41, 'user', 'user@x.com')).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    })
  })

  describe('deleteUser', () => {
    it('exclui um secretário ou responsável de projeto', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 10, username: 'saude-admin', role: 'secretaria_admin' })

      await deleteUser(10)

      expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 10 } })
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/usuarios')
    })

    it('rejeita quando o usuário não existe ou não é secretário/responsável de projeto', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      await expect(deleteUser(999)).rejects.toThrow('Usuário não encontrado.')

      prismaMock.user.findUnique.mockResolvedValue({ id: 1, username: 'root', role: 'super_admin' })
      await expect(deleteUser(1)).rejects.toThrow('Usuário não encontrado.')

      expect(prismaMock.user.delete).not.toHaveBeenCalled()
    })

    it('bloqueia exclusão do admin definido pelo .env do servidor', async () => {
      process.env.ADMIN_USERNAME = 'admin'
      prismaMock.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', role: 'secretaria_admin' })

      await expect(deleteUser(1)).rejects.toThrow(
        'Este usuário é definido pelo .env do servidor e não pode ser excluído por aqui.',
      )
      expect(prismaMock.user.delete).not.toHaveBeenCalled()
      delete process.env.ADMIN_USERNAME
    })

    it('exige sessão de super admin ou secretaria admin', async () => {
      requireSessionMock.mockRejectedValue(new UnauthorizedErrorMock())
      await expect(deleteUser(10)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    })

    it('permite à secretaria excluir responsável de projeto da própria secretaria, e bloqueia secretário e projetos de fora', async () => {
      requireSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })

      prismaMock.user.findUnique.mockResolvedValue({
        id: 40,
        username: 'joao.responsavel',
        role: 'projeto_admin',
        projetosResponsavel: [{ projeto: { secretariaId: 10 } }],
      })
      await deleteUser(40)
      expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 40 } })

      prismaMock.user.findUnique.mockResolvedValue({ id: 10, username: 'outra-secretaria', role: 'secretaria_admin', projetosResponsavel: [] })
      await expect(deleteUser(10)).rejects.toBeInstanceOf(UnauthorizedErrorMock)

      prismaMock.user.findUnique.mockResolvedValue({
        id: 41,
        username: 'fora.secretaria',
        role: 'projeto_admin',
        projetosResponsavel: [{ projeto: { secretariaId: 99 } }],
      })
      await expect(deleteUser(41)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    })
  })

  describe('enviarRedefinicaoSenha (LGPD: nunca ver/gerar senha, só mandar e-mail de redefinição)', () => {
    it('super admin envia redefinição para secretário, responsável de projeto ou outro admin supremo', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 10,
        username: 'saude-admin',
        email: 'saude@prefeitura.gov.br',
        role: 'secretaria_admin',
        projetosResponsavel: [],
      })

      await expect(enviarRedefinicaoSenha(10)).resolves.toEqual({ ok: true })

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { passwordResetToken: 'hash-do-codigo', passwordResetExpires: expect.any(Date) },
      })
      expect(sendVerificationCodeEmailMock).toHaveBeenCalledWith('saude@prefeitura.gov.br', '123456')
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorUserId: 1,
          action: 'user.password_reset_email',
          entityType: 'user',
          entityId: 10,
          targetUserId: 10,
          details: { role: 'secretaria_admin' },
        },
      })

      prismaMock.user.findUnique.mockResolvedValue({
        id: 2,
        username: 'outro-root',
        email: 'outro-root@prefeitura.gov.br',
        role: 'super_admin',
        projetosResponsavel: [],
      })
      await expect(enviarRedefinicaoSenha(2)).resolves.toEqual({ ok: true })
      expect(sendVerificationCodeEmailMock).toHaveBeenCalledWith('outro-root@prefeitura.gov.br', '123456')
    })

    it('permite à secretaria redefinir a senha de responsável de projeto da própria secretaria, e bloqueia o resto', async () => {
      requireSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })

      prismaMock.user.findUnique.mockResolvedValue({
        id: 40,
        username: 'joao.responsavel',
        email: 'joao@prefeitura.gov.br',
        role: 'projeto_admin',
        projetosResponsavel: [{ projeto: { secretariaId: 10 } }],
      })
      await expect(enviarRedefinicaoSenha(40)).resolves.toEqual({ ok: true })

      prismaMock.user.findUnique.mockResolvedValue({
        id: 2,
        username: 'root-2',
        email: 'root@x.com',
        role: 'super_admin',
        projetosResponsavel: [],
      })
      await expect(enviarRedefinicaoSenha(2)).rejects.toThrow('Você só pode gerenciar responsáveis de projetos da sua secretaria.')

      prismaMock.user.findUnique.mockResolvedValue({
        id: 41,
        username: 'fora.secretaria',
        email: 'fora@x.com',
        role: 'projeto_admin',
        projetosResponsavel: [{ projeto: { secretariaId: 99 } }],
      })
      await expect(enviarRedefinicaoSenha(41)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    })

    it('bloqueia redefinição do admin definido pelo .env e rejeita usuário sem e-mail cadastrado', async () => {
      process.env.ADMIN_USERNAME = 'admin'
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'admin',
        email: 'admin@x.com',
        role: 'secretaria_admin',
        projetosResponsavel: [],
      })
      await expect(enviarRedefinicaoSenha(1)).rejects.toThrow(
        'Este usuário é definido pelo .env do servidor e não pode ter a senha redefinida por aqui.',
      )
      delete process.env.ADMIN_USERNAME

      prismaMock.user.findUnique.mockResolvedValue({
        id: 10,
        username: 'saude-admin',
        email: null,
        role: 'secretaria_admin',
        projetosResponsavel: [],
      })
      await expect(enviarRedefinicaoSenha(10)).rejects.toThrow(
        'Este usuário não tem e-mail cadastrado. Atualize o e-mail antes de redefinir a senha.',
      )

      expect(sendVerificationCodeEmailMock).not.toHaveBeenCalled()
    })

    it('exige sessão de super admin ou secretaria admin', async () => {
      requireSessionMock.mockRejectedValue(new UnauthorizedErrorMock())
      await expect(enviarRedefinicaoSenha(10)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    })
  })
})
