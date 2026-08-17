import { beforeEach, describe, expect, it, vi } from 'vitest'

const { clearSessionCookieMock } = vi.hoisted(() => ({
  clearSessionCookieMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  clearSessionCookie: clearSessionCookieMock,
}))

import { POST } from '@/app/api/auth/logout/route'

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSessionCookieMock.mockResolvedValue(undefined)
  })

  it('limpa a sessão sem registrar uma atividade de baixo valor', async () => {
    const response = await POST()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(clearSessionCookieMock).toHaveBeenCalledOnce()
  })
})
