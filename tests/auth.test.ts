import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookieStore, cookiesMock } = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    cookieStore: store,
    cookiesMock: vi.fn(async () => ({
      get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
      set: (name: string, value: string) => {
        store.set(name, value)
      },
      delete: (name: string) => {
        store.delete(name)
      },
    })),
  }
})

vi.mock('next/headers', () => ({ cookies: cookiesMock }))

process.env.SESSION_SECRET = 'test-secret-para-testes-de-auth'

import { assertCanEdit, createSessionToken, getSession, requireSession, SESSION_COOKIE, UnauthorizedError, verifySessionToken, type SessionPayload } from '@/lib/auth'

describe('lib/auth (sem mock, sessão e JWT reais)', () => {
  beforeEach(() => {
    cookieStore.clear()
  })

  describe('createSessionToken / verifySessionToken', () => {
    it('cria e verifica um token preservando o payload', async () => {
      const payload: SessionPayload = {
        userId: 1,
        username: 'root',
        role: 'super_admin',
        secretariaId: null,
        projetoIds: [],
        mustChangePassword: false,
        canEdit: true,
      }
      const token = await createSessionToken(payload)

      await expect(verifySessionToken(token)).resolves.toMatchObject(payload)
    })

    it('retorna null para token inválido ou assinado com outro segredo', async () => {
      await expect(verifySessionToken('token-completamente-invalido')).resolves.toBeNull()

      const segredoOriginal = process.env.SESSION_SECRET
      process.env.SESSION_SECRET = 'segredo-diferente'
      const tokenComOutroSegredo = await createSessionToken({
        userId: 1,
        username: 'root',
        role: 'super_admin',
        secretariaId: null,
        projetoIds: [],
        mustChangePassword: false,
        canEdit: true,
      })
      process.env.SESSION_SECRET = segredoOriginal

      await expect(verifySessionToken(tokenComOutroSegredo)).resolves.toBeNull()
    })
  })

  describe('getSession', () => {
    it('retorna null quando não há cookie de sessão', async () => {
      await expect(getSession()).resolves.toBeNull()
    })

    it('retorna null quando o cookie contém um token inválido', async () => {
      cookieStore.set(SESSION_COOKIE, 'lixo-nao-e-jwt')
      await expect(getSession()).resolves.toBeNull()
    })

    it('retorna o payload quando o cookie contém um token válido', async () => {
      const payload: SessionPayload = {
        userId: 5,
        username: 'joao.responsavel',
        role: 'projeto_admin',
        secretariaId: null,
        projetoIds: [20, 21],
        mustChangePassword: false,
        canEdit: true,
      }
      const token = await createSessionToken(payload)
      cookieStore.set(SESSION_COOKIE, token)

      await expect(getSession()).resolves.toMatchObject(payload)
    })
  })

  describe('requireSession', () => {
    it('lança UnauthorizedError quando não há sessão', async () => {
      await expect(requireSession('super_admin')).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('permite super_admin quando listado e rejeita quando não listado', async () => {
      const token = await createSessionToken({
        userId: 1,
        username: 'root',
        role: 'super_admin',
        secretariaId: null,
        projetoIds: [],
        mustChangePassword: false,
        canEdit: true,
      })
      cookieStore.set(SESSION_COOKIE, token)

      await expect(requireSession('super_admin')).resolves.toMatchObject({ role: 'super_admin' })
      await expect(requireSession('secretaria_admin', 'projeto_admin')).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('permite secretaria_admin quando listado e rejeita quando não listado', async () => {
      const token = await createSessionToken({
        userId: 2,
        username: 'saude-admin',
        role: 'secretaria_admin',
        secretariaId: 10,
        projetoIds: [],
        mustChangePassword: false,
        canEdit: true,
      })
      cookieStore.set(SESSION_COOKIE, token)

      await expect(requireSession('secretaria_admin')).resolves.toMatchObject({ role: 'secretaria_admin' })
      await expect(requireSession('super_admin')).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('permite projeto_admin quando listado e rejeita quando não listado', async () => {
      const token = await createSessionToken({
        userId: 3,
        username: 'joao.responsavel',
        role: 'projeto_admin',
        secretariaId: null,
        projetoIds: [20],
        mustChangePassword: false,
        canEdit: true,
      })
      cookieStore.set(SESSION_COOKIE, token)

      await expect(requireSession('projeto_admin')).resolves.toMatchObject({ role: 'projeto_admin' })
      await expect(requireSession('super_admin', 'secretaria_admin')).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('sem lista de papéis aceita qualquer papel autenticado', async () => {
      const token = await createSessionToken({
        userId: 4,
        username: 'saude-admin',
        role: 'secretaria_admin',
        secretariaId: 5,
        projetoIds: [],
        mustChangePassword: false,
        canEdit: true,
      })
      cookieStore.set(SESSION_COOKIE, token)

      await expect(requireSession()).resolves.toMatchObject({ role: 'secretaria_admin' })
    })
  })

  describe('assertCanEdit', () => {
    function payload(overrides: Partial<SessionPayload>): SessionPayload {
      return {
        userId: 1,
        username: 'root',
        role: 'super_admin',
        secretariaId: null,
        projetoIds: [],
        mustChangePassword: false,
        canEdit: true,
        ...overrides,
      }
    }

    it('bloqueia admin supremo com canEdit false', () => {
      expect(() => assertCanEdit(payload({ canEdit: false }))).toThrow(UnauthorizedError)
    })

    it('permite admin supremo com canEdit true', () => {
      expect(() => assertCanEdit(payload({ canEdit: true }))).not.toThrow()
    })

    it('permite admin supremo com token antigo (sem canEdit no payload)', () => {
      const semCanEdit = payload({}) as Partial<SessionPayload>
      delete semCanEdit.canEdit
      expect(() => assertCanEdit(semCanEdit as SessionPayload)).not.toThrow()
    })

    it('não restringe outros papéis mesmo com canEdit false', () => {
      expect(() => assertCanEdit(payload({ role: 'secretaria_admin', secretariaId: 10, canEdit: false }))).not.toThrow()
    })
  })
})
