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
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      indicadorEscala: {
        upsert: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
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

import {
  createIndicador,
  deleteIndicador,
  deleteIndicadorGrupo,
  removeIndicadorEscala,
  renameIndicadorGrupo,
  setIndicadorEscala,
  updateIndicador,
} from '@/lib/actions/indicadores'

describe('ações de indicadores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: 10 })
    prismaMock.indicador.create.mockResolvedValue({ id: 31, titulo: 'Atendimentos', valor: 123.45, unidade: 'pessoas', projetoId: 20 })
    prismaMock.indicador.findFirst.mockResolvedValue(null)
  })

  it('cria indicador normalizando campos, convertendo a data para Date, e audita como gráfico novo (com o valor lançado) quando não havia nenhum com esse título', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })
    prismaMock.indicador.findFirst.mockResolvedValue(null)

    await createIndicador(20, '  Atendimentos  ', 123.45, ' pessoas ', '2026-03-15')

    expect(prismaMock.indicador.findFirst).toHaveBeenCalledWith({
      where: { projetoId: 20, titulo: 'Atendimentos' },
      select: { id: true },
    })
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
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 5,
        action: 'indicator.create',
        entityType: 'indicator',
        entityId: 31,
        targetUserId: null,
        details: { titulo: 'Atendimentos', valor: 123.45, unidade: 'pessoas', projetoId: 20, secretariaId: 10 },
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin')
  })

  it('audita como número lançado (não gráfico criado) quando já existe indicador com o mesmo título no projeto', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })
    prismaMock.indicador.findFirst.mockResolvedValue({ id: 7 })

    await createIndicador(20, 'Atendimentos', 50, '', '2026-03-16')

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'indicator.add_value' }) }),
    )
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

  it('atualiza indicador pertencente à secretaria e audita o novo valor', async () => {
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
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 5,
        action: 'indicator.update',
        entityType: 'indicator',
        entityId: 30,
        targetUserId: null,
        details: { titulo: 'Atualizado', valor: 99, unidade: null, secretariaId: 10 },
      },
    })
  })

  it('permite ao admin supremo atualizar indicador de qualquer secretaria', async () => {
    requireSessionMock.mockResolvedValue({ userId: 1, role: 'super_admin', secretariaId: null, projetoIds: [] })
    prismaMock.indicador.findUnique.mockResolvedValue({ id: 30, projeto: { secretariaId: 77 } })

    await updateIndicador(30, 'Atualizado', 99, '', '2026-12-01')

    expect(prismaMock.indicador.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { titulo: 'Atualizado', valor: 99, unidade: null, dataReferencia: new Date('2026-12-01T00:00:00.000Z') },
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

describe('ações de indicadores para responsável de projeto (projeto_admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.indicador.create.mockResolvedValue({ id: 31, titulo: 'Atendimentos', projetoId: 20 })
    prismaMock.indicador.findFirst.mockResolvedValue(null)
  })

  it('permite criar indicador apenas no próprio projeto', async () => {
    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [20] })
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })

    await createIndicador(20, 'Atendimentos', 10, '', '2026-01-01')

    expect(prismaMock.indicador.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ projetoId: 20 }) }),
    )
  })

  it('bloqueia criação de indicador em outro projeto', async () => {
    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [20] })
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 21, secretariaId: 10 })

    await expect(createIndicador(21, 'Atendimentos', 10, '', '2026-01-01')).rejects.toThrow(
      'Você só pode gerenciar o seu próprio projeto.',
    )
    expect(prismaMock.indicador.create).not.toHaveBeenCalled()
  })

  it('permite excluir indicador do próprio projeto e bloqueia de outro', async () => {
    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [20] })
    prismaMock.indicador.findUnique.mockResolvedValue({ id: 30, projetoId: 20, projeto: { secretariaId: 10 } })

    await deleteIndicador(30)
    expect(prismaMock.indicador.delete).toHaveBeenCalledWith({ where: { id: 30 } })

    prismaMock.indicador.findUnique.mockResolvedValue({ id: 32, projetoId: 21, projeto: { secretariaId: 10 } })
    await expect(deleteIndicador(32)).rejects.toThrow('Este indicador não pertence ao seu projeto.')
  })

  it('permite atualizar indicador do próprio projeto e bloqueia de outro', async () => {
    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [20] })
    prismaMock.indicador.findUnique.mockResolvedValue({ id: 30, projetoId: 20, projeto: { secretariaId: 10 } })

    await updateIndicador(30, 'Atualizado', 99, '', '2026-12-01')
    expect(prismaMock.indicador.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { titulo: 'Atualizado', valor: 99, unidade: null, dataReferencia: new Date('2026-12-01T00:00:00.000Z') },
    })

    prismaMock.indicador.findUnique.mockResolvedValue({ id: 32, projetoId: 21, projeto: { secretariaId: 10 } })
    await expect(updateIndicador(32, 'Atualizado', 99, '', '2026-12-01')).rejects.toThrow(
      'Este indicador não pertence ao seu projeto.',
    )
  })
})

describe('gráficos: renomear grupo, excluir grupo e configurar escala (super_admin, secretaria_admin, projeto_admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.projeto.findUnique.mockResolvedValue({ id: 20, secretariaId: 10 })
  })

  it('permite renomear o grupo de indicadores para os três papéis autorizados', async () => {
    prismaMock.indicador.updateMany.mockResolvedValue({ count: 2 })

    requireSessionMock.mockResolvedValue({ userId: 1, role: 'super_admin', secretariaId: null, projetoIds: [] })
    await renameIndicadorGrupo(20, 'Antigo', 'Novo')
    expect(prismaMock.indicador.updateMany).toHaveBeenCalledWith({ where: { projetoId: 20, titulo: 'Antigo' }, data: { titulo: 'Novo' } })

    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: 10, projetoIds: [] })
    await renameIndicadorGrupo(20, 'Antigo', 'Novo')

    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [20] })
    await renameIndicadorGrupo(20, 'Antigo', 'Novo')

    expect(prismaMock.indicador.updateMany).toHaveBeenCalledTimes(3)
  })

  it('bloqueia renomear grupo fora da posse (secretaria errada / projeto errado) e rejeita título vazio ou grupo inexistente', async () => {
    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: 99, projetoIds: [] })
    await expect(renameIndicadorGrupo(20, 'Antigo', 'Novo')).rejects.toThrow('Este projeto não pertence à sua secretaria.')

    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [21] })
    await expect(renameIndicadorGrupo(20, 'Antigo', 'Novo')).rejects.toThrow('Você só pode gerenciar o seu próprio projeto.')

    requireSessionMock.mockResolvedValue({ userId: 1, role: 'super_admin', secretariaId: null, projetoIds: [] })
    await expect(renameIndicadorGrupo(20, 'Antigo', '  ')).rejects.toThrow('Informe um nome para o gráfico.')

    prismaMock.indicador.updateMany.mockResolvedValue({ count: 0 })
    await expect(renameIndicadorGrupo(20, 'Inexistente', 'Novo')).rejects.toThrow('Gráfico não encontrado.')

    expect(prismaMock.indicador.update).not.toHaveBeenCalled()
  })

  it('permite excluir o grupo de indicadores para os três papéis autorizados, bloqueia fora da posse e rejeita grupo inexistente', async () => {
    prismaMock.indicador.deleteMany.mockResolvedValue({ count: 3 })
    prismaMock.indicadorEscala.deleteMany.mockResolvedValue({ count: 1 })

    requireSessionMock.mockResolvedValue({ userId: 1, role: 'super_admin', secretariaId: null, projetoIds: [] })
    await deleteIndicadorGrupo(20, 'Atendimentos')

    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: 10, projetoIds: [] })
    await deleteIndicadorGrupo(20, 'Atendimentos')

    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [20] })
    await deleteIndicadorGrupo(20, 'Atendimentos')

    expect(prismaMock.indicador.deleteMany).toHaveBeenCalledTimes(3)

    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [21] })
    await expect(deleteIndicadorGrupo(20, 'Atendimentos')).rejects.toThrow('Você só pode gerenciar o seu próprio projeto.')

    requireSessionMock.mockResolvedValue({ userId: 1, role: 'super_admin', secretariaId: null, projetoIds: [] })
    prismaMock.indicador.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.indicadorEscala.deleteMany.mockResolvedValue({ count: 0 })
    await expect(deleteIndicadorGrupo(20, 'Inexistente')).rejects.toThrow('Gráfico não encontrado.')
  })

  it('permite configurar a escala para os três papéis autorizados e bloqueia fora da posse', async () => {
    prismaMock.indicadorEscala.upsert.mockResolvedValue({})

    requireSessionMock.mockResolvedValue({ userId: 1, role: 'super_admin', secretariaId: null, projetoIds: [] })
    await setIndicadorEscala(20, 'Atendimentos', 0, 100, true)
    expect(prismaMock.indicadorEscala.upsert).toHaveBeenCalledWith({
      where: { projetoId_titulo: { projetoId: 20, titulo: 'Atendimentos' } },
      create: { projetoId: 20, titulo: 'Atendimentos', valorMinimo: 0, valorMaximo: 100, crescenteMelhor: true },
      update: { valorMinimo: 0, valorMaximo: 100, crescenteMelhor: true },
    })

    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: 10, projetoIds: [] })
    await setIndicadorEscala(20, 'Atendimentos', 0, 100, true)

    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [20] })
    await setIndicadorEscala(20, 'Atendimentos', 0, 100, true)

    expect(prismaMock.indicadorEscala.upsert).toHaveBeenCalledTimes(3)

    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: 99, projetoIds: [] })
    await expect(setIndicadorEscala(20, 'Atendimentos', 0, 100, true)).rejects.toThrow('Este projeto não pertence à sua secretaria.')
  })

  it('rejeita valores inválidos de escala', async () => {
    requireSessionMock.mockResolvedValue({ userId: 1, role: 'super_admin', secretariaId: null, projetoIds: [] })

    await expect(setIndicadorEscala(20, 'Atendimentos', Number.NaN, 100, true)).rejects.toThrow(
      'Informe o valor mínimo e o valor máximo da escala.',
    )
    await expect(setIndicadorEscala(20, 'Atendimentos', 100, 50, true)).rejects.toThrow(
      'O valor máximo precisa ser maior que o valor mínimo.',
    )
    expect(prismaMock.indicadorEscala.upsert).not.toHaveBeenCalled()
  })

  it('permite remover a escala para os três papéis autorizados e bloqueia fora da posse', async () => {
    prismaMock.indicadorEscala.deleteMany.mockResolvedValue({ count: 1 })

    requireSessionMock.mockResolvedValue({ userId: 1, role: 'super_admin', secretariaId: null, projetoIds: [] })
    await removeIndicadorEscala(20, 'Atendimentos')

    requireSessionMock.mockResolvedValue({ userId: 5, role: 'secretaria_admin', secretariaId: 10, projetoIds: [] })
    await removeIndicadorEscala(20, 'Atendimentos')

    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [20] })
    await removeIndicadorEscala(20, 'Atendimentos')

    expect(prismaMock.indicadorEscala.deleteMany).toHaveBeenCalledTimes(3)

    requireSessionMock.mockResolvedValue({ userId: 9, role: 'projeto_admin', secretariaId: null, projetoIds: [21] })
    await expect(removeIndicadorEscala(20, 'Atendimentos')).rejects.toThrow('Você só pode gerenciar o seu próprio projeto.')
  })
})
