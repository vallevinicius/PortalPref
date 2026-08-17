import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    secretaria: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    projeto: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  getProjetoComIndicadores,
  getProjetosComIndicadores,
  getSecretariaAdminBySecretariaId,
  getSecretariaAdmins,
  getSecretariaById,
  getSecretarias,
  getSuperAdmins,
} from '@/lib/data'

describe('lib/data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna a secretaria com a contagem numérica de projetos', async () => {
    prismaMock.secretaria.findUnique.mockResolvedValue({
      id: 1,
      nome: 'Secretaria de Saúde',
      slug: 'secretaria-de-saude',
      _count: { projetos: 3 },
    })

    await expect(getSecretariaById(1)).resolves.toEqual({
      id: 1,
      nome: 'Secretaria de Saúde',
      slug: 'secretaria-de-saude',
      projetos_count: 3,
    })
    expect(prismaMock.secretaria.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: {
        id: true,
        nome: true,
        slug: true,
        _count: { select: { projetos: true } },
      },
    })
  })

  it('retorna null quando a secretaria não existe', async () => {
    prismaMock.secretaria.findUnique.mockResolvedValue(null)

    await expect(getSecretariaById(999)).resolves.toBeNull()
  })

  it('lista secretarias ordenadas e preserva suas contagens', async () => {
    prismaMock.secretaria.findMany.mockResolvedValue([
      { id: 2, nome: 'Saúde', slug: 'saude', _count: { projetos: 1 } },
      { id: 1, nome: 'Educação', slug: 'educacao', _count: { projetos: 4 } },
    ])

    await expect(getSecretarias()).resolves.toEqual([
      { id: 2, nome: 'Saúde', slug: 'saude', projetos_count: 1 },
      { id: 1, nome: 'Educação', slug: 'educacao', projetos_count: 4 },
    ])
    expect(prismaMock.secretaria.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { nome: 'asc' } }))
  })

  it('mapeia o administrador de uma secretaria e trata relação ausente', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 7,
      username: 'saude-admin',
      secretariaId: 2,
      secretaria: { nome: 'Saúde' },
    })

    await expect(getSecretariaAdminBySecretariaId(2)).resolves.toEqual({
      id: 7,
      username: 'saude-admin',
      secretaria_id: 2,
      secretaria_nome: 'Saúde',
    })

    prismaMock.user.findFirst.mockResolvedValue(null)
    await expect(getSecretariaAdminBySecretariaId(99)).resolves.toBeNull()
  })

  it('lista admins de secretaria e ignora registros sem relação válida', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 1, username: 'admin-a', secretariaId: 3, secretaria: { nome: 'A' } },
      { id: 2, username: 'admin-sem-secretaria', secretariaId: null, secretaria: null },
    ])

    await expect(getSecretariaAdmins()).resolves.toEqual([
      { id: 1, username: 'admin-a', secretaria_id: 3, secretaria_nome: 'A' },
    ])
  })

  it('lista super admins pelo nome', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 4, username: 'admin' }])

    await expect(getSuperAdmins()).resolves.toEqual([{ id: 4, username: 'admin' }])
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: 'super_admin' },
      orderBy: { username: 'asc' },
      select: { id: true, username: true },
    })
  })

  it('converte indicadores e datas ao mapear um projeto', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({
      id: 10,
      nome: 'Projeto Saúde',
      descricao: null,
      secretariaId: 2,
      secretaria: { id: 2, nome: 'Saúde' },
      indicadores: [
        {
          id: 20,
          titulo: 'Atendimentos',
          valor: { toString: () => '123.45' },
          unidade: 'pessoas',
          dataReferencia: new Date('2026-03-15T00:00:00.000Z'),
        },
      ],
    })

    await expect(getProjetoComIndicadores(10)).resolves.toEqual({
      id: 10,
      nome: 'Projeto Saúde',
      descricao: null,
      secretaria_id: 2,
      secretaria_nome: 'Saúde',
      indicadores: [
        {
          id: 20,
          titulo: 'Atendimentos',
          valor: 123.45,
          unidade: 'pessoas',
          data_referencia: '2026-03-15',
        },
      ],
    })
  })

  it('retorna null para projeto inexistente e lista projetos da secretaria', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue(null)
    await expect(getProjetoComIndicadores(999)).resolves.toBeNull()

    prismaMock.projeto.findMany.mockResolvedValue([
      {
        id: 11,
        nome: 'Projeto A',
        descricao: 'Descrição',
        secretariaId: 2,
        secretaria: { id: 2, nome: 'Saúde' },
        indicadores: [],
      },
    ])

    await expect(getProjetosComIndicadores(2)).resolves.toEqual([
      {
        id: 11,
        nome: 'Projeto A',
        descricao: 'Descrição',
        secretaria_id: 2,
        secretaria_nome: 'Saúde',
        indicadores: [],
      },
    ])
    expect(prismaMock.projeto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { secretariaId: 2 },
      orderBy: { createdAt: 'desc' },
    }))
  })
})
