import bcrypt from 'bcryptjs'
import path from 'node:path'
import process from 'node:process'

process.loadEnvFile(path.resolve(process.cwd(), '.env'))

import { UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma'

async function main() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password) {
    throw new Error('Defina ADMIN_USERNAME e ADMIN_PASSWORD no .env antes de rodar o seed.')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { username },
    create: {
      username,
      passwordHash,
      role: UserRole.super_admin,
      secretariaId: null,
    },
    update: {
      passwordHash,
      role: UserRole.super_admin,
      secretariaId: null,
    },
  })

  console.log(`Admin supremo "${username}" criado/atualizado com sucesso.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
