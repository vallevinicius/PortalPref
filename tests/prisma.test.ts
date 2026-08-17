import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaClientMock } = vi.hoisted(() => ({
  prismaClientMock: vi.fn().mockImplementation(() => ({ disconnect: vi.fn() })),
}))

vi.mock('@prisma/client', () => ({ PrismaClient: prismaClientMock }))

describe('lib/prisma', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.DATABASE_URL
    delete process.env.DB_HOST
    delete process.env.DB_PORT
    delete process.env.DB_USER
    delete process.env.DB_PASSWORD
    delete process.env.DB_NAME
    delete (globalThis as { prisma?: unknown }).prisma
  })

  it('prioriza DATABASE_URL', async () => {
    process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/app'

    await import('@/lib/prisma')

    expect(prismaClientMock).toHaveBeenCalledWith({
      datasources: { db: { url: 'mysql://user:password@localhost:3306/app' } },
    })
  })

  it('monta URL a partir das variáveis DB_* e codifica credenciais', async () => {
    process.env.DB_HOST = 'db.internal'
    process.env.DB_PORT = '3307'
    process.env.DB_USER = 'portal user'
    process.env.DB_PASSWORD = 'p@ss word'
    process.env.DB_NAME = 'portal pref'

    await import('@/lib/prisma')

    expect(prismaClientMock).toHaveBeenCalledWith({
      datasources: {
        db: {
          url: 'mysql://portal%20user:p%40ss%20word@db.internal:3307/portal%20pref?charset=utf8mb4',
        },
      },
    })
  })

  it('falha com mensagem clara quando não há configuração do banco', async () => {
    await expect(import('@/lib/prisma')).rejects.toThrow(
      'Defina DATABASE_URL ou as variáveis DB_HOST, DB_USER e DB_NAME no ambiente.',
    )
  })
})
