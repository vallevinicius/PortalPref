import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import bcrypt from 'bcryptjs'

process.loadEnvFile(path.resolve(process.cwd(), '.env'))

import { getPool } from '../lib/db'

async function main() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password) {
    throw new Error('Defina ADMIN_USERNAME e ADMIN_PASSWORD no .env antes de rodar o seed.')
  }

  const pool = getPool()

  const schema = readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf8')
  await pool.query(schema)

  const passwordHash = await bcrypt.hash(password, 12)

  await pool.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES (?, ?, 'super_admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'super_admin'`,
    [username, passwordHash],
  )

  console.log(`Admin supremo "${username}" criado/atualizado com sucesso.`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
