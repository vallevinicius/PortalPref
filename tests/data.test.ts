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
    projetoResponsavel: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  getAllUsers,
  getAssignableProjetoUsers,
  getProjetoAdminByProjetoId,
  getProjetoComIndicadores,
  getProjetosComIndicadores,
  getProjetosPorIds,
  getProjetosResumo,
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

  it('lista admins de secretaria e ignora registros sem relação válida', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 1, username: 'admin-a', secretariaId: 3, secretaria: { nome: 'A' } },
      { id: 2, username: 'admin-sem-secretaria', secretariaId: null, secretaria: null },
    ])

    await expect(getSecretariaAdmins()).resolves.toEqual([
      { id: 1, username: 'admin-a', secretaria_id: 3, secretaria_nome: 'A' },
    ])
  })

  it('lista secretários e responsáveis de projeto com e-mail e vínculos, sem incluir super admins', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 1,
        username: 'saude-admin',
        email: 'saude@x.com',
        role: 'secretaria_admin',
        secretariaId: 7,
        secretaria: { nome: 'Saúde' },
        projetosResponsavel: [],
      },
      {
        id: 2,
        username: 'joao.responsavel',
        email: null,
        role: 'projeto_admin',
        secretariaId: null,
        secretaria: null,
        projetosResponsavel: [
          { projeto: { id: 10, nome: 'Projeto A', secretariaId: 7, secretaria: { nome: 'Saúde' } } },
          { projeto: { id: 11, nome: 'Projeto B', secretariaId: 7, secretaria: { nome: 'Saúde' } } },
        ],
      },
    ])

    await expect(getAllUsers()).resolves.toEqual([
      { id: 1, username: 'saude-admin', email: 'saude@x.com', role: 'secretaria_admin', secretaria_id: 7, secretaria_nome: 'Saúde', projetos: [] },
      {
        id: 2,
        username: 'joao.responsavel',
        email: null,
        role: 'projeto_admin',
        secretaria_id: 7,
        secretaria_nome: 'Saúde',
        projetos: [{ id: 10, nome: 'Projeto A' }, { id: 11, nome: 'Projeto B' }],
      },
    ])
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: { in: ['secretaria_admin', 'projeto_admin'] } },
      orderBy: [{ username: 'asc' }],
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        secretariaId: true,
        secretaria: { select: { nome: true } },
        projetosResponsavel: {
          orderBy: { createdAt: 'asc' },
          select: { projeto: { select: { id: true, nome: true, secretariaId: true, secretaria: { select: { nome: true } } } } },
        },
      },
    })
  })

  it('filtra por secretaria e retorna só responsáveis de projeto daquela secretaria', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 2,
        username: 'joao.responsavel',
        email: 'joao@x.com',
        role: 'projeto_admin',
        secretariaId: null,
        secretaria: null,
        projetosResponsavel: [{ projeto: { id: 10, nome: 'Projeto A', secretariaId: 7, secretaria: { nome: 'Saúde' } } }],
      },
    ])

    await expect(getAllUsers(7)).resolves.toEqual([
      {
        id: 2,
        username: 'joao.responsavel',
        email: 'joao@x.com',
        role: 'projeto_admin',
        secretaria_id: 7,
        secretaria_nome: 'Saúde',
        projetos: [{ id: 10, nome: 'Projeto A' }],
      },
    ])
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: 'projeto_admin',
          projetosResponsavel: { some: {}, every: { projeto: { secretariaId: 7 } } },
        },
      }),
    )
  })

  it('lista super admins pelo nome', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 4, username: 'admin', canEdit: true }])

    await expect(getSuperAdmins()).resolves.toEqual([{ id: 4, username: 'admin', canEdit: true }])
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: 'super_admin' },
      orderBy: { username: 'asc' },
      select: { id: true, username: true, canEdit: true },
    })
  })

  it('converte indicadores e datas ao mapear um projeto', async () => {
    prismaMock.projeto.findUnique.mockResolvedValue({
      id: 10,
      nome: 'Projeto Saúde',
      descricao: null,
      responsavelNome: null,
      responsavelTelefone: null,
      prazoAtualizacaoDias: 30,
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
      indicadorEscalas: [
        {
          titulo: 'Atendimentos',
          valorMinimo: { toString: () => '0' },
          valorMaximo: { toString: () => '100' },
          crescenteMelhor: true,
        },
      ],
    })

    await expect(getProjetoComIndicadores(10)).resolves.toEqual({
      id: 10,
      nome: 'Projeto Saúde',
      descricao: null,
      responsavel_nome: null,
      responsavel_telefone: null,
      prazo_atualizacao_dias: 30,
      ultima_atualizacao: '2026-03-15',
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
      escalas: [
        {
          titulo: 'Atendimentos',
          valor_minimo: 0,
          valor_maximo: 100,
          crescente_melhor: true,
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
        responsavelNome: null,
        responsavelTelefone: null,
        prazoAtualizacaoDias: null,
        secretariaId: 2,
        secretaria: { id: 2, nome: 'Saúde' },
        indicadores: [],
        indicadorEscalas: [],
      },
    ])

    await expect(getProjetosComIndicadores(2)).resolves.toEqual([
      {
        id: 11,
        nome: 'Projeto A',
        descricao: 'Descrição',
        responsavel_nome: null,
        responsavel_telefone: null,
        prazo_atualizacao_dias: null,
        ultima_atualizacao: null,
        secretaria_id: 2,
        secretaria_nome: 'Saúde',
        indicadores: [],
        escalas: [],
      },
    ])
    expect(prismaMock.projeto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { secretariaId: 2 },
      orderBy: { createdAt: 'desc' },
    }))
  })

  it('resume projetos com secretaria, prazo e última atualização', async () => {
    prismaMock.projeto.findMany.mockResolvedValue([
      {
        id: 30,
        nome: 'Projeto com número',
        secretariaId: 2,
        secretaria: { nome: 'Saúde' },
        prazoAtualizacaoDias: 7,
        indicadores: [{ dataReferencia: new Date('2026-08-14T00:00:00.000Z') }],
      },
      {
        id: 31,
        nome: 'Projeto sem número',
        secretariaId: 2,
        secretaria: { nome: 'Saúde' },
        prazoAtualizacaoDias: null,
        indicadores: [],
      },
    ])

    await expect(getProjetosResumo()).resolves.toEqual([
      {
        id: 30,
        nome: 'Projeto com número',
        secretaria_id: 2,
        secretaria_nome: 'Saúde',
        prazo_atualizacao_dias: 7,
        ultima_atualizacao: '2026-08-14',
      },
      {
        id: 31,
        nome: 'Projeto sem número',
        secretaria_id: 2,
        secretaria_nome: 'Saúde',
        prazo_atualizacao_dias: null,
        ultima_atualizacao: null,
      },
    ])
  })

  it('filtra usuários designáveis por secretaria do projeto', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 40, username: 'joao.responsavel', projetosResponsavel: [{ projeto: { nome: 'Projeto A' } }, { projeto: { nome: 'Projeto B' } }] },
      { id: 41, username: 'maria.livre', projetosResponsavel: [] },
    ])

    await expect(getAssignableProjetoUsers(10)).resolves.toEqual([
      { id: 40, username: 'joao.responsavel', projetos_atuais: ['Projeto A', 'Projeto B'] },
      { id: 41, username: 'maria.livre', projetos_atuais: [] },
    ])
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: 'projeto_admin', projetosResponsavel: { every: { projeto: { secretariaId: 10 } } } },
    }))
  })

  it('busca o primeiro responsável cadastrado para um projeto', async () => {
    prismaMock.projetoResponsavel.findFirst.mockResolvedValue({ user: { id: 40, username: 'joao.responsavel' } })

    await expect(getProjetoAdminByProjetoId(20)).resolves.toEqual({
      id: 40,
      username: 'joao.responsavel',
      projeto_id: 20,
    })
    expect(prismaMock.projetoResponsavel.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { projetoId: 20 },
    }))

    prismaMock.projetoResponsavel.findFirst.mockResolvedValue(null)
    await expect(getProjetoAdminByProjetoId(21)).resolves.toBeNull()
  })

  it('busca projetos por uma lista de ids, e retorna vazio para lista vazia', async () => {
    await expect(getProjetosPorIds([])).resolves.toEqual([])
    expect(prismaMock.projeto.findMany).not.toHaveBeenCalled()

    prismaMock.projeto.findMany.mockResolvedValue([
      {
        id: 20,
        nome: 'Projeto A',
        descricao: null,
        responsavelNome: null,
        responsavelTelefone: null,
        prazoAtualizacaoDias: null,
        secretariaId: 2,
        secretaria: { id: 2, nome: 'Saúde' },
        indicadores: [],
        indicadorEscalas: [],
      },
    ])

    await expect(getProjetosPorIds([20, 21])).resolves.toEqual([
      {
        id: 20,
        nome: 'Projeto A',
        descricao: null,
        responsavel_nome: null,
        responsavel_telefone: null,
        prazo_atualizacao_dias: null,
        ultima_atualizacao: null,
        secretaria_id: 2,
        secretaria_nome: 'Saúde',
        indicadores: [],
        escalas: [],
      },
    ])
    expect(prismaMock.projeto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: [20, 21] } },
    }))
  })
})
