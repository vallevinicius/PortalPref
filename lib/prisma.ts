import { PrismaClient } from '@prisma/client'

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('Defina DATABASE_URL no arquivo .env antes de iniciar o Prisma.')
  }

  return databaseUrl
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
