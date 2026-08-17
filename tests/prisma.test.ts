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
    delete (globalThis as { prisma?: unknown }).prisma
  })

  it('usa DATABASE_URL para construir o cliente', async () => {
    process.env.DATABASE_URL = 'mysql://root:password@localhost:3306/apaixonese'

    await import('@/lib/prisma')

    expect(prismaClientMock).toHaveBeenCalledWith({
      datasources: { db: { url: 'mysql://root:password@localhost:3306/apaixonese' } },
    })
  })

  it('falha com mensagem clara quando DATABASE_URL não está configurada', async () => {
    await expect(import('@/lib/prisma')).rejects.toThrow(
      'Defina DATABASE_URL no arquivo .env antes de iniciar o Prisma.',
    )
  })
})
