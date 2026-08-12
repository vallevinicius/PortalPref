import path from 'node:path'
import process from 'node:process'
import mysql from 'mysql2/promise'

process.loadEnvFile(path.resolve(process.cwd(), '.env'))

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })

  const dbName = process.env.DB_NAME
  if (!dbName) {
    throw new Error('DB_NAME não definido no .env')
  }

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  console.log(`Banco "${dbName}" garantido.`)
  await connection.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
