import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { createSessionToken, SESSION_COOKIE, type SessionPayload } from '@/lib/auth'
import { middleware } from '../middleware'

process.env.SESSION_SECRET = 'test-secret-para-testes-de-middleware'

function makeRequest(cookieValue?: string) {
  const headers = new Headers()
  if (cookieValue !== undefined) {
    headers.set('cookie', `${SESSION_COOKIE}=${cookieValue}`)
  }
  return new NextRequest('http://localhost/admin', { headers })
}

describe('middleware (sem mock, JWT real)', () => {
  it('redireciona para "/" quando não há cookie de sessão', async () => {
    const response = await middleware(makeRequest())

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('redireciona para "/" quando o cookie contém um token inválido', async () => {
    const response = await middleware(makeRequest('token-invalido'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('redireciona para "/" quando o token foi assinado com outro segredo', async () => {
    const segredoOriginal = process.env.SESSION_SECRET
    process.env.SESSION_SECRET = 'outro-segredo'
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
    process.env.SESSION_SECRET = segredoOriginal

    const response = await middleware(makeRequest(token))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('deixa passar quando o cookie contém um token válido', async () => {
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

    const response = await middleware(makeRequest(token))

    expect(response.headers.get('location')).toBeNull()
  })

  it('redireciona para "/trocar-senha" quando a sessão exige troca de senha', async () => {
    const payload: SessionPayload = {
      userId: 1,
      username: 'saude-admin',
      role: 'secretaria_admin',
      secretariaId: 10,
      projetoIds: [],
      mustChangePassword: true,
      canEdit: true,
    }
    const token = await createSessionToken(payload)

    const response = await middleware(makeRequest(token))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/trocar-senha')
  })

  it('redireciona "/trocar-senha" para "/" quando não há sessão', async () => {
    const request = new NextRequest('http://localhost/trocar-senha')

    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })
})
