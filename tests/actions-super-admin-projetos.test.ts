import { beforeEach, describe, expect, it, vi } from 'vitest'

const { poolMock, requireSessionMock, revalidatePathMock, UnauthorizedErrorMock } = vi.hoisted(() => {
  class UnauthorizedErrorMock extends Error {}

  return {
    poolMock: {
      query: vi.fn(),
    },
    requireSessionMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    UnauthorizedErrorMock,
  }
})

vi.mock('@/lib/db', () => ({ getPool: () => poolMock }))
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
  })

  it('permite criar projeto em qualquer secretaria informada', async () => {
    await createProjeto('  Projeto Saúde  ', '  Descrição  ', 42)

    expect(requireSessionMock).toHaveBeenCalledWith('super_admin', 'secretaria_admin')
    expect(poolMock.query).toHaveBeenCalledWith(
      'INSERT INTO projetos (secretaria_id, nome, descricao, created_by) VALUES (?, ?, ?, ?)',
      [42, 'Projeto Saúde', 'Descrição', 1],
    )
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/secretarias/42')
  })

  it('exige secretaria-alvo para criação feita pelo super administrador', async () => {
    await expect(createProjeto('Projeto', '')).rejects.toThrow('Informe a secretaria do projeto.')
    expect(poolMock.query).not.toHaveBeenCalled()
  })

  it('permite ao super administrador atualizar projeto de outra secretaria', async () => {
    poolMock.query.mockResolvedValueOnce([[{ id: 12, secretaria_id: 99 }]])

    await updateProjeto(12, '  Projeto atualizado ', ' descrição ')

    expect(poolMock.query).toHaveBeenNthCalledWith(2, 'UPDATE projetos SET nome = ?, descricao = ? WHERE id = ?', [
      'Projeto atualizado',
      'descrição',
      12,
    ])
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/secretarias/99')
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/projetos/12')
  })

  it('permite ao super administrador excluir projeto de outra secretaria', async () => {
    poolMock.query.mockResolvedValueOnce([[{ id: 12, secretaria_id: 99 }]])

    await deleteProjeto(12)

    expect(poolMock.query).toHaveBeenNthCalledWith(2, 'DELETE FROM projetos WHERE id = ?', [12])
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/secretarias/99')
  })
})

describe('restrições do administrador de secretaria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 5, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10 })
  })

  it('continua criando projeto apenas na própria secretaria', async () => {
    await createProjeto('Projeto local', '', 10)

    expect(poolMock.query).toHaveBeenCalledWith(
      'INSERT INTO projetos (secretaria_id, nome, descricao, created_by) VALUES (?, ?, ?, ?)',
      [10, 'Projeto local', null, 5],
    )
  })

  it('bloqueia tentativa de criar projeto em outra secretaria', async () => {
    await expect(createProjeto('Projeto indevido', '', 99)).rejects.toBeInstanceOf(UnauthorizedErrorMock)
    expect(poolMock.query).not.toHaveBeenCalled()
  })

  it('bloqueia atualização de projeto de outra secretaria', async () => {
    poolMock.query.mockResolvedValueOnce([[{ id: 12, secretaria_id: 99 }]])

    await expect(updateProjeto(12, 'Nome', '')).rejects.toThrow('Este projeto não pertence à sua secretaria.')
    expect(poolMock.query).toHaveBeenCalledTimes(1)
  })
})

describe('indicadores em projetos gerenciados pelo super administrador', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionMock.mockResolvedValue({ userId: 1, username: 'admin', role: 'super_admin', secretariaId: null })
  })

  it('permite lançar indicador em projeto de qualquer secretaria', async () => {
    poolMock.query.mockResolvedValueOnce([[{ id: 20, secretaria_id: 42 }]])

    await createIndicador(20, 'Atendimentos', 10, 'pessoas', '2026-01-01')

    expect(poolMock.query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO indicadores'), [
      20,
      'Atendimentos',
      10,
      'pessoas',
      '2026-01-01',
      1,
    ])
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/projetos/20')
  })

  it('permite remover indicador de qualquer secretaria', async () => {
    poolMock.query.mockResolvedValueOnce([[{ id: 7, secretaria_id: 42 }]])

    await deleteIndicador(7)

    expect(poolMock.query).toHaveBeenNthCalledWith(2, 'DELETE FROM indicadores WHERE id = ?', [7])
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/secretarias/42')
  })
})
