import path from 'node:path'
import process from 'node:process'

process.loadEnvFile(path.resolve(process.cwd(), '.env'))

import { prisma } from '../lib/prisma'
import { SECRETARIA_PRESETS } from '../lib/secretaria-presets'
import { slugify } from '../lib/slug'

async function main() {
  const result = await prisma.secretaria.createMany({
    data: SECRETARIA_PRESETS.map((nome) => ({
      nome,
      slug: slugify(nome),
    })),
    skipDuplicates: true,
  })

  console.log(`${result.count} secretaria(s) nova(s) cadastrada(s) (${SECRETARIA_PRESETS.length - result.count} já existiam).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
