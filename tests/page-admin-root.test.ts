import { describe, expect, it, vi } from 'vitest'

const { getSessionMock, redirectMock, dataMock } = vi.hoisted(() => {
  class RedirectSentinel extends Error {
    path: string
    constructor(path: string) {
      super(`REDIRECT:${path}`)
      this.path = path
    }
  }
  return {
    RedirectSentinel,
    getSessionMock: vi.fn(),
    redirectMock: vi.fn((path: string) => {
      throw new RedirectSentinel(path)
    }),
    dataMock: {
      getProjetosComIndicadores: vi.fn().mockResolvedValue([]),
      getProjetosPorIds: vi.fn().mockResolvedValue([]),
      getProjetosResumo: vi.fn().mockResolvedValue([]),
      getSecretariaAdmins: vi.fn().mockResolvedValue([]),
      getSecretarias: vi.fn().mockResolvedValue([]),
      getSuperAdmins: vi.fn().mockResolvedValue([]),
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/auth', () => ({ getSession: getSessionMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/data', () => dataMock)

import AdminPage from '@/app/admin/page'

describe('app/admin/page (autorização de entrada)', () => {
  it('redireciona para "/" quando não há sessão', async () => {
    getSessionMock.mockResolvedValue(null)

    await expect(AdminPage()).rejects.toMatchObject({ path: '/' })
  })

  it('redireciona para "/" quando o responsável de projeto não tem nenhum projeto', async () => {
    getSessionMock.mockResolvedValue({ userId: 1, username: 'joao', role: 'projeto_admin', secretariaId: null, projetoIds: [] })

    await expect(AdminPage()).rejects.toMatchObject({ path: '/' })
  })

  it('redireciona direto para o projeto quando o responsável tem apenas um projeto', async () => {
    getSessionMock.mockResolvedValue({ userId: 1, username: 'joao', role: 'projeto_admin', secretariaId: null, projetoIds: [72] })

    await expect(AdminPage()).rejects.toMatchObject({ path: '/admin/projetos/72' })
  })

  it('não redireciona quando o responsável tem mais de um projeto (mostra "Meus projetos")', async () => {
    getSessionMock.mockResolvedValue({ userId: 1, username: 'joao', role: 'projeto_admin', secretariaId: null, projetoIds: [72, 73] })

    await expect(AdminPage()).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('não redireciona para super_admin', async () => {
    getSessionMock.mockResolvedValue({ userId: 1, username: 'root', role: 'super_admin', secretariaId: null, projetoIds: [] })

    await expect(AdminPage()).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('não redireciona para secretaria_admin', async () => {
    getSessionMock.mockResolvedValue({ userId: 1, username: 'saude-admin', role: 'secretaria_admin', secretariaId: 10, projetoIds: [] })

    await expect(AdminPage()).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
