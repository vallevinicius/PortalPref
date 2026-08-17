import { PrismaClient } from '@prisma/client'

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const host = process.env.DB_HOST
  const port = process.env.DB_PORT ?? '3306'
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD ?? ''
  const database = process.env.DB_NAME

  if (!host || !user || !database) {
    throw new Error('Defina DATABASE_URL ou as variáveis DB_HOST, DB_USER e DB_NAME no ambiente.')
  }

  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?charset=utf8mb4`
}

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaClient
}

const prismaGlobal = globalThis as PrismaGlobal

export const prisma =
  prismaGlobal.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.prisma = prisma
}
