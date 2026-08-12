import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import bcrypt from 'bcryptjs'
import type { Pool } from 'mysql2/promise'

process.loadEnvFile(path.resolve(process.cwd(), '.env'))

import { getPool } from '../lib/db'

async function ignoreDuplicate(pool: Pool, sql: string) {
  try {
    await pool.query(sql)
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    if (code !== 'ER_DUP_FIELDNAME' && code !== 'ER_DUP_KEYNAME' && code !== 'ER_FK_DUP_NAME') {
      throw err
    }
  }
}

async function main() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password) {
    throw new Error('Defina ADMIN_USERNAME e ADMIN_PASSWORD no .env antes de rodar o seed.')
  }

  const pool = getPool()

  const schema = readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf8')
  const statements = schema
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await pool.query(statement)
  }

  // Migração defensiva para bancos criados antes da tabela `secretarias` existir.
  await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'secretaria_admin') NOT NULL")
  await ignoreDuplicate(pool, 'ALTER TABLE users ADD COLUMN secretaria_id INT NULL')
  await ignoreDuplicate(
    pool,
    'ALTER TABLE users ADD CONSTRAINT fk_users_secretaria FOREIGN KEY (secretaria_id) REFERENCES secretarias(id) ON DELETE SET NULL',
  )

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
