import { describe, expect, it, vi } from 'vitest'

const { getSessionMock, redirectMock, notFoundMock, dataMock } = vi.hoisted(() => {
  class RedirectSentinel extends Error {
    path: string
    constructor(path: string) {
      super(`REDIRECT:${path}`)
      this.path = path
    }
  }
  class NotFoundSentinel extends Error {}
  return {
    RedirectSentinel,
    NotFoundSentinel,
    getSessionMock: vi.fn(),
    redirectMock: vi.fn((path: string) => {
      throw new RedirectSentinel(path)
    }),
    notFoundMock: vi.fn(() => {
      throw new NotFoundSentinel()
    }),
    dataMock: {
      getProjetoComIndicadores: vi.fn(),
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/auth', () => ({ getSession: getSessionMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock, notFound: notFoundMock }))
vi.mock('@/lib/data', () => dataMock)

import ProjetoDetailPage from '@/app/admin/projetos/[projetoId]/page'

const PROJETO = {
  id: 20,
  nome: 'Projeto Saúde',
  descricao: null,
  responsavel_nome: null,
  responsavel_telefone: null,
  prazo_atualizacao_dias: null,
  ultima_atualizacao: null,
  secretaria_id: 10,
  secretaria_nome: 'Saúde',
  indicadores: [],
  escalas: [],
}

function makeParams(projetoId: string) {
  return Promise.resolve({ projetoId })
}

describe('app/admin/projetos/[projetoId]/page (autorização por dono do recurso)', () => {
  it('redireciona para "/" quando não há sessão', async () => {
    getSessionMock.mockResolvedValue(null)

    await expect(ProjetoDetailPage({ params: makeParams('20') })).rejects.toMatchObject({ path: '/' })
  })

  it('retorna notFound para id inválido ou projeto inexistente', async () => {
    getSessionMock.mockResolvedValue({ userId: 1, username: 'root', role: 'super_admin', secretariaId: null, projetoIds: [] })

    await expect(ProjetoDetailPage({ params: makeParams('abc') })).rejects.toBeInstanceOf(Error)

    dataMock.getProjetoComIndicadores.mockResolvedValue(null)
    await expect(ProjetoDetailPage({ params: makeParams('999') })).rejects.toThrow()
  })

  it('bloqueia secretaria_admin de outra secretaria', async () => {
    getSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 99, projetoIds: [] })
    dataMock.getProjetoComIndicadores.mockResolvedValue(PROJETO)

    await expect(ProjetoDetailPage({ params: makeParams('20') })).rejects.toMatchObject({ path: '/admin' })
  })

  it('bloqueia projeto_admin não designado para este projeto', async () => {
    getSessionMock.mockResolvedValue({ userId: 5, username: 'joao', role: 'projeto_admin', secretariaId: null, projetoIds: [21] })
    dataMock.getProjetoComIndicadores.mockResolvedValue(PROJETO)

    await expect(ProjetoDetailPage({ params: makeParams('20') })).rejects.toMatchObject({ path: '/admin' })
  })

  it('permite super_admin ver qualquer projeto', async () => {
    getSessionMock.mockResolvedValue({ userId: 1, username: 'root', role: 'super_admin', secretariaId: null, projetoIds: [] })
    dataMock.getProjetoComIndicadores.mockResolvedValue(PROJETO)

    await expect(ProjetoDetailPage({ params: makeParams('20') })).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('permite secretaria_admin dono ver o projeto', async () => {
    getSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10, projetoIds: [] })
    dataMock.getProjetoComIndicadores.mockResolvedValue(PROJETO)

    await expect(ProjetoDetailPage({ params: makeParams('20') })).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('permite projeto_admin designado ver o projeto', async () => {
    getSessionMock.mockResolvedValue({ userId: 5, username: 'joao', role: 'projeto_admin', secretariaId: null, projetoIds: [20] })
    dataMock.getProjetoComIndicadores.mockResolvedValue(PROJETO)

    await expect(ProjetoDetailPage({ params: makeParams('20') })).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
