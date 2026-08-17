import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  prismaMock,
  requireSessionMock,
  revalidatePathMock,
  UnauthorizedErrorMock,
} = vi.hoisted(() => {
  class UnauthorizedErrorMock extends Error {}

  return {
    prismaMock: {
      projeto: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      indicador: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      secretaria: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
    requireSessionMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    UnauthorizedErrorMock,
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({
  requireSession: requireSessionMock,
  UnauthorizedError: UnauthorizedErrorMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { createIndicador } from '@/lib/actions/indicadores'
import { createProjeto, deleteProjeto, updateProjeto } from '@/lib/actions/projetos'
import { createSecretaria } from '@/lib/actions/secretarias'

describe('ações de projetos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 5, username: 'admin', role: 'secretaria_admin', secretariaId: 10 })
    prismaMock.projeto.create.mockResolvedValue({ id: 21, nome: 'Projeto novo', secretariaId: 10 })
    prismaMock.indicador.create.mockResolvedValue({ id: 31, titulo: 'Atendimentos', projetoId: 20 })
  })

  it('cria projeto com texto normalizado e valores vazios como null', async () => {
    await createProjeto('  Projeto novo  ', '   ')

    expect(prismaMock.projeto.create).toHaveBeenCalledWith({
      data: {
        secretariaId: 10,
        nome: 'Projeto novo',
        descricao: null,
        createdBy: 5,
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })

  it('rejeita projeto sem nome antes de acessar o Prisma', async () => {
    await expect(createProjeto('   ', 'Descrição')).rejects.toThrow('Informe o nome do projeto.')
    expect(prismaMock.projeto.create).not.toHaveBeenCalled()
  })

  it('rejeita sessão de secretaria sem secretaria vinculada', async () => {
    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: null })

    await expect(createProjeto('Projeto', '')).rejects.toThrow('Sua conta não está vinculada a uma secretaria.')
    expect(prismaMock.projeto.create).not.toHaveBeenCalled()
  })

  it('atualiza somente projeto pertencente à secretaria da sessão', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, secretariaId: 10 })

    await updateProjeto(12, '  Nome atualizado ', ' descrição ')

    expect(prismaMock.projeto.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { nome: 'Nome atualizado', descricao: 'descrição' },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })

  it('bloqueia atualização e exclusão de projeto de outra secretaria', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, secretariaId: 99 })

    await expect(updateProjeto(12, 'Nome', '')).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    await expect(deleteProjeto(12)).rejects.toThrow('Este projeto não pertence à sua secretaria.')
    expect(prismaMock.projeto.update).not.toHaveBeenCalled()
    expect(prismaMock.projeto.delete).not.toHaveBeenCalled()
  })

  it('exclui projeto após validar a posse', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, secretariaId: 10 })

    await deleteProjeto(12)

    expect(prismaMock.projeto.delete).toHaveBeenCalledWith({ where: { id: 12 } })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })
})

describe('ação de secretarias', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 1, username: 'root', role: 'super_admin', secretariaId: null })
    prismaMock.secretaria.create.mockResolvedValue({ id: 11, nome: 'Secretaria de Saúde' })
  })

  it('cria secretaria com slug normalizado', async () => {
    await createSecretaria('  Secretaria de Saúde  ')

    expect(prismaMock.secretaria.create).toHaveBeenCalledWith({
      data: {
        nome: 'Secretaria de Saúde',
        slug: 'secretaria-de-saude',
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })

  it('rejeita nome vazio e converte conflito único em mensagem de domínio', async () => {
    await expect(createSecretaria(' ')).rejects.toThrow('Informe o nome da secretaria.')

    prismaMock.secretaria.create.mockRejectedValue({ code: 'P2002' })
    await expect(createSecretaria('Saúde')).rejects.toThrow('Já existe uma secretaria com esse nome.')
  })
})

describe('contrato compartilhado de autorização', () => {
  it('usa a sessão exigida antes de criar um indicador', async () => {
    requireSessionMock.mockResolvedValue({ userId: 5, username: 'admin', role: 'secretaria_admin', secretariaId: 10 })
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })
    prismaMock.indicador.create.mockResolvedValue({ id: 31, titulo: 'Atendimentos', projetoId: 20 })

    await createIndicador(20, 'Atendimentos', 10, '', '2026-01-01')

    expect(requireSessionMock).toHaveBeenCalledWith('super_admin', 'secretaria_admin')
  })
})
