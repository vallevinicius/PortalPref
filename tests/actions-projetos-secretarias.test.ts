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
        findFirst: vi.fn(),
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
import { createProjeto, deleteProjeto, setPrazoAtualizacao, updateProjeto } from '@/lib/actions/projetos'
import { createSecretaria } from '@/lib/actions/secretarias'

describe('ações de projetos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 5, username: 'admin', role: 'secretaria_admin', secretariaId: 10 })
    prismaMock.projeto.create.mockResolvedValue({ id: 21, nome: 'Projeto novo', secretariaId: 10 })
    prismaMock.indicador.create.mockResolvedValue({ id: 31, titulo: 'Atendimentos', projetoId: 20 })
  })

  it('cria projeto com texto normalizado e valores vazios como null', async () => {
    await createProjeto('  Projeto novo  ', '   ', '  Fulana de Tal  ', '  (22) 90000-0000  ', 30)

    expect(prismaMock.projeto.create).toHaveBeenCalledWith({
      data: {
        secretariaId: 10,
        nome: 'Projeto novo',
        descricao: null,
        responsavelNome: 'Fulana de Tal',
        responsavelTelefone: '(22) 90000-0000',
        prazoAtualizacaoDias: 30,
        createdBy: 5,
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })

  it('rejeita projeto sem nome antes de acessar o Prisma', async () => {
    await expect(createProjeto('   ', 'Descrição', 'Fulana', '99999-0000', 30)).rejects.toThrow('Informe o nome do projeto.')
    expect(prismaMock.projeto.create).not.toHaveBeenCalled()
  })

  it('rejeita projeto sem responsável ou telefone', async () => {
    await expect(createProjeto('Projeto', '', '', '99999-0000', 30)).rejects.toThrow(
      'Informe o nome completo e o telefone de contato do responsável.',
    )
    await expect(createProjeto('Projeto', '', 'Fulana', '   ', 30)).rejects.toThrow(
      'Informe o nome completo e o telefone de contato do responsável.',
    )
    expect(prismaMock.projeto.create).not.toHaveBeenCalled()
  })

  it('rejeita prazo de atualização inválido', async () => {
    await expect(createProjeto('Projeto', '', 'Fulana', '99999-0000', 0)).rejects.toThrow(
      'Informe de quanto em quanto tempo (em dias) o projeto precisa ser atualizado.',
    )
    await expect(createProjeto('Projeto', '', 'Fulana', '99999-0000', 1.5)).rejects.toThrow(
      'Informe de quanto em quanto tempo (em dias) o projeto precisa ser atualizado.',
    )
    expect(prismaMock.projeto.create).not.toHaveBeenCalled()
  })

  it('rejeita sessão de secretaria sem secretaria vinculada', async () => {
    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: null })

    await expect(createProjeto('Projeto', '', 'Fulana', '99999-0000', 30)).rejects.toThrow('Sua conta não está vinculada a uma secretaria.')
    expect(prismaMock.projeto.create).not.toHaveBeenCalled()
  })

  it('atualiza somente projeto pertencente à secretaria da sessão', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, secretariaId: 10 })

    await updateProjeto(12, '  Nome atualizado ', ' descrição ', ' Fulana de Tal ', ' (22) 90000-0000 ')

    expect(prismaMock.projeto.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: {
        nome: 'Nome atualizado',
        descricao: 'descrição',
        responsavelNome: 'Fulana de Tal',
        responsavelTelefone: '(22) 90000-0000',
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })

  it('bloqueia atualização e exclusão de projeto de outra secretaria', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, secretariaId: 99 })

    await expect(updateProjeto(12, 'Nome', '', 'Fulana', '(22) 90000-0000')).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    await expect(deleteProjeto(12)).rejects.toThrow('Este projeto não pertence à sua secretaria.')
    expect(prismaMock.projeto.update).not.toHaveBeenCalled()
    expect(prismaMock.projeto.delete).not.toHaveBeenCalled()
  })

  it('rejeita atualização sem responsável ou telefone', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, secretariaId: 10 })

    await expect(updateProjeto(12, 'Nome', '', '', '(22) 90000-0000')).rejects.toThrow(
      'Informe o nome completo e o telefone de contato do responsável.',
    )
    await expect(updateProjeto(12, 'Nome', '', 'Fulana', '   ')).rejects.toThrow(
      'Informe o nome completo e o telefone de contato do responsável.',
    )
    expect(prismaMock.projeto.update).not.toHaveBeenCalled()
  })

  it('exclui projeto após validar a posse', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, secretariaId: 10 })

    await deleteProjeto(12)

    expect(prismaMock.projeto.delete).toHaveBeenCalledWith({ where: { id: 12 } })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })

  it('permite configurar o prazo de atualização de projeto da própria secretaria', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, nome: 'Projeto', secretariaId: 10 })

    await setPrazoAtualizacao(12, 7)

    expect(prismaMock.projeto.update).toHaveBeenCalledWith({ where: { id: 12 }, data: { prazoAtualizacaoDias: 7 } })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/projetos/12')
  })

  it('bloqueia configurar prazo de projeto de outra secretaria e rejeita valor inválido', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, nome: 'Projeto', secretariaId: 99 })
    await expect(setPrazoAtualizacao(12, 7)).rejects.toBeInstanceOf(UnauthorizedErrorMock)

    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, nome: 'Projeto', secretariaId: 10 })
    await expect(setPrazoAtualizacao(12, 0)).rejects.toThrow('Informe um número de dias válido.')

    expect(prismaMock.projeto.update).not.toHaveBeenCalled()
  })
})

describe('responsável de projeto (projeto_admin) editando o próprio projeto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('permite ao responsável do projeto atualizar nome, briefing e contato', async () => {
    requireSessionMock.mockResolvedValue({
      userId: 40,
      username: 'joao.responsavel',
      role: 'projeto_admin',
      secretariaId: null,
      projetoIds: [12],
    })
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, secretariaId: 10 })

    await updateProjeto(12, 'Nome atualizado', 'Novo briefing', 'Fulana de Tal', '(22) 90000-0000')

    expect(prismaMock.projeto.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: {
        nome: 'Nome atualizado',
        descricao: 'Novo briefing',
        responsavelNome: 'Fulana de Tal',
        responsavelTelefone: '(22) 90000-0000',
      },
    })
  })

  it('bloqueia o responsável de editar um projeto que não é dele', async () => {
    requireSessionMock.mockResolvedValue({
      userId: 40,
      username: 'joao.responsavel',
      role: 'projeto_admin',
      secretariaId: null,
      projetoIds: [20],
    })
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 12, secretariaId: 10 })

    await expect(updateProjeto(12, 'Nome', '', 'Fulana', '(22) 90000-0000')).rejects.toThrow(
      'Você não é responsável por este projeto.',
    )
    expect(prismaMock.projeto.update).not.toHaveBeenCalled()
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

    expect(requireSessionMock).toHaveBeenCalledWith('super_admin', 'secretaria_admin', 'projeto_admin')
  })
})
