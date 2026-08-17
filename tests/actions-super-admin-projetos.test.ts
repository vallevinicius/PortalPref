import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, requireSessionMock, revalidatePathMock, UnauthorizedErrorMock } = vi.hoisted(() => {
  class UnauthorizedErrorMock extends Error {}

  return {
    prismaMock: {
      projeto: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      indicador: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
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

import { createIndicador, deleteIndicador } from '@/lib/actions/indicadores'
import { createProjeto, deleteProjeto, updateProjeto } from '@/lib/actions/projetos'

describe('acesso global do super administrador a projetos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 1, username: 'admin', role: 'super_admin', secretariaId: null })
    prismaMock.projeto.create.mockResolvedValue({ id: 21, nome: 'Projeto Saúde', secretariaId: 42 })
    prismaMock.indicador.create.mockResolvedValue({ id: 8, titulo: 'Atendimentos', projetoId: 20 })
  })

  it('permite criar projeto em qualquer secretaria informada', async () => {
    await createProjeto('  Projeto Saúde  ', '  Descrição  ', 42)

    expect(prismaMock.projeto.create).toHaveBeenCalledWith({
      data: {
        secretariaId: 42,
        nome: 'Projeto Saúde',
        descricao: 'Descrição',
        createdBy: 1,
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/secretarias/42')
  })

  it('exige secretaria-alvo para criação feita pelo super administrador', async () => {
    await expect(createProjeto('Projeto', '')).rejects.toThrow('Informe a secretaria do projeto.')
    expect(prismaMock.projeto.create).not.toHaveBeenCalled()
  })

  it('permite ao super administrador atualizar projeto de outra secretaria', async () => {
    prismaMock.projeto.findUnique.mockResolvedValueOnce({ id: 12, secretariaId: 99 })

    await updateProjeto(12, '  Projeto atualizado ', ' descrição ')

    expect(prismaMock.projeto.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { nome: 'Projeto atualizado', descricao: 'descrição' },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/secretarias/99')
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/projetos/12')
  })

  it('permite ao super administrador excluir projeto de outra secretaria', async () => {
    prismaMock.projeto.findUnique.mockResolvedValueOnce({ id: 12, secretariaId: 99 })

    await deleteProjeto(12)

    expect(prismaMock.projeto.delete).toHaveBeenCalledWith({ where: { id: 12 } })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/secretarias/99')
  })
})

describe('restrições do administrador de secretaria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 5, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })
    prismaMock.projeto.create.mockResolvedValue({ id: 21, nome: 'Projeto local', secretariaId: 10 })
  })

  it('continua criando projeto apenas na própria secretaria', async () => {
    await createProjeto('Projeto local', '', 10)

    expect(prismaMock.projeto.create).toHaveBeenCalledWith({
      data: { secretariaId: 10, nome: 'Projeto local', descricao: null, createdBy: 5 },
    })
  })

  it('bloqueia tentativa de criar projeto em outra secretaria', async () => {
    await expect(createProjeto('Projeto indevido', '', 99)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    expect(prismaMock.projeto.create).not.toHaveBeenCalled()
  })

  it('bloqueia atualização de projeto de outra secretaria', async () => {
    prismaMock.projeto.findUnique.mockResolvedValueOnce({ id: 12, secretariaId: 99 })

    await expect(updateProjeto(12, 'Nome', '')).rejects.toThrow('Este projeto não pertence à sua secretaria.')
    expect(prismaMock.projeto.update).not.toHaveBeenCalled()
  })
})

describe('indicadores em projetos gerenciados pelo super administrador', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 1, username: 'admin', role: 'super_admin', secretariaId: null })
    prismaMock.indicador.create.mockResolvedValue({ id: 8, titulo: 'Atendimentos', projetoId: 20 })
  })

  it('permite lançar indicador em projeto de qualquer secretaria', async () => {
    prismaMock.projeto.findUnique.mockResolvedValueOnce({ id: 20, secretariaId: 42 })

    await createIndicador(20, 'Atendimentos', 10, 'pessoas', '2026-01-01')

    expect(prismaMock.indicador.create).toHaveBeenCalledWith({
      data: {
        projetoId: 20,
        titulo: 'Atendimentos',
        valor: 10,
        unidade: 'pessoas',
        dataReferencia: new Date('2026-01-01T00:00:00.000Z'),
        createdBy: 1,
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/projetos/20')
  })

  it('permite remover indicador de qualquer secretaria', async () => {
    prismaMock.indicador.findUnique.mockResolvedValueOnce({ id: 7, projeto: { secretariaId: 42 } })

    await deleteIndicador(7)

    expect(prismaMock.indicador.delete).toHaveBeenCalledWith({ where: { id: 7 } })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/secretarias/42')
  })
})
