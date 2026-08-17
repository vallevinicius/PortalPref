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
      projeto: { findUnique: vi.fn() },
      indicador: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
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

import { createIndicador, deleteIndicador, updateIndicador } from '@/lib/actions/indicadores'

describe('ações de indicadores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: 10 })
  })

  it('cria indicador normalizando campos e convertendo a data para Date', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })

    await createIndicador(20, '  Atendimentos  ', 123.45, ' pessoas ', '2026-03-15')

    expect(prismaMock.indicador.create).toHaveBeenCalledWith({
      data: {
        projetoId: 20,
        titulo: 'Atendimentos',
        valor: 123.45,
        unidade: 'pessoas',
        dataReferencia: new Date('2026-03-15T00:00:00.000Z'),
        createdBy: 5,
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })

  it.each([
    ['título vazio', '', 10, '2026-01-01'],
    ['valor NaN', 'Indicador', Number.NaN, '2026-01-01'],
    ['valor infinito', 'Indicador', Number.POSITIVE_INFINITY, '2026-01-01'],
    ['data vazia', 'Indicador', 10, ''],
    ['data inválida', 'Indicador', 10, '2026-02-30'],
    ['data fora do formato', 'Indicador', 10, '15/03/2026'],
  ])('rejeita %s antes de persistir', async (_caso, titulo, valor, data) => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })

    await expect(createIndicador(20, titulo, valor, '', data)).rejects.toThrow(
      'Preencha título, valor e data do indicador.',
    )
    expect(prismaMock.indicador.create).not.toHaveBeenCalled()
  })

  it('bloqueia criação quando o projeto não pertence à secretaria', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 99 })

    await expect(createIndicador(20, 'Indicador', 10, '', '2026-01-01')).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    expect(prismaMock.indicador.create).not.toHaveBeenCalled()
  })

  it('bloqueia sessão sem secretaria vinculada', async () => {
    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: null })
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })

    await expect(createIndicador(20, 'Indicador', 10, '', '2026-01-01')).rejects.toThrow(
      'Sua conta não está vinculada a uma secretaria.',
    )
    expect(prismaMock.projeto.findUnique).toHaveBeenCalled()
  })

  it('atualiza indicador pertencente à secretaria', async () => {
    prismaMock.indicador.findUnique.mockResolvedValue({ id: 30, projeto: { secretariaId: 10 } })

    await updateIndicador(30, '  Atualizado ', 99, '', '2026-12-01')

    expect(prismaMock.indicador.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: {
        titulo: 'Atualizado',
        valor: 99,
        unidade: null,
        dataReferencia: new Date('2026-12-01T00:00:00.000Z'),
      },
    })
  })

  it('bloqueia atualização e exclusão de indicador de outra secretaria', async () => {
    prismaMock.indicador.findUnique.mockResolvedValue({ id: 30, projeto: { secretariaId: 99 } })

    await expect(updateIndicador(30, 'Atualizado', 99, '', '2026-12-01')).rejects.toThrow(
      'Este indicador não pertence à sua secretaria.',
    )
    await expect(deleteIndicador(30)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    expect(prismaMock.indicador.update).not.toHaveBeenCalled()
    expect(prismaMock.indicador.delete).not.toHaveBeenCalled()
  })

  it('exclui indicador após validar a posse', async () => {
    prismaMock.indicador.findUnique.mockResolvedValue({ id: 30, projeto: { secretariaId: 10 } })

    await deleteIndicador(30)

    expect(prismaMock.indicador.delete).toHaveBeenCalledWith({ where: { id: 30 } })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })
})
