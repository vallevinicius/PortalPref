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
      getProjetosComIndicadores: vi.fn().mockResolvedValue([]),
      getSecretariaById: vi.fn(),
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/auth', () => ({ getSession: getSessionMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock, notFound: notFoundMock }))
vi.mock('@/lib/data', () => dataMock)

import SecretariaDetailPage from '@/app/admin/secretarias/[secretariaId]/page'

const SECRETARIA = { id: 10, nome: 'Secretaria de Saúde', slug: 'secretaria-de-saude', projetos_count: 3 }

function makeParams(secretariaId: string) {
  return Promise.resolve({ secretariaId })
}

describe('app/admin/secretarias/[secretariaId]/page (autorização exclusiva do admin supremo)', () => {
  it('redireciona para "/" quando não há sessão', async () => {
    getSessionMock.mockResolvedValue(null)

    await expect(SecretariaDetailPage({ params: makeParams('10') })).rejects.toMatchObject({ path: '/' })
  })

  it('bloqueia secretaria_admin', async () => {
    getSessionMock.mockResolvedValue({ userId: 3, username: 'secretaria', role: 'secretaria_admin', secretariaId: 10, projetoIds: [] })

    await expect(SecretariaDetailPage({ params: makeParams('10') })).rejects.toMatchObject({ path: '/admin' })
  })

  it('bloqueia projeto_admin', async () => {
    getSessionMock.mockResolvedValue({ userId: 5, username: 'joao', role: 'projeto_admin', secretariaId: null, projetoIds: [20] })

    await expect(SecretariaDetailPage({ params: makeParams('10') })).rejects.toMatchObject({ path: '/admin' })
  })

  it('retorna notFound para secretaria inexistente', async () => {
    getSessionMock.mockResolvedValue({ userId: 1, username: 'root', role: 'super_admin', secretariaId: null, projetoIds: [] })
    dataMock.getSecretariaById.mockResolvedValue(null)

    await expect(SecretariaDetailPage({ params: makeParams('999') })).rejects.toThrow()
  })

  it('permite super_admin', async () => {
    getSessionMock.mockResolvedValue({ userId: 1, username: 'root', role: 'super_admin', secretariaId: null, projetoIds: [] })
    dataMock.getSecretariaById.mockResolvedValue(SECRETARIA)

    await expect(SecretariaDetailPage({ params: makeParams('10') })).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
