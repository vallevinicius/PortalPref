import path from 'node:path'
import process from 'node:process'

process.loadEnvFile(path.resolve(process.cwd(), '.env'))

import { getPool } from '../lib/db'
import { SECRETARIA_PRESETS } from '../lib/secretaria-presets'
import { slugify } from '../lib/slug'

async function main() {
  const pool = getPool()

  let created = 0
  for (const nome of SECRETARIA_PRESETS) {
    const [result] = await pool.query('INSERT IGNORE INTO secretarias (nome, slug) VALUES (?, ?)', [nome, slugify(nome)])
    if ((result as { affectedRows: number }).affectedRows > 0) created += 1
  }

  console.log(`${created} secretaria(s) nova(s) cadastrada(s) (${SECRETARIA_PRESETS.length - created} já existiam).`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
