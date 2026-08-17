import mysql from 'mysql2/promise'

export interface DatabaseConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

let pool: mysql.Pool | undefined

function decodePart(value: string) {
  return decodeURIComponent(value)
}

export function getDatabaseConfig(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (databaseUrl) {
    let url: URL
    try {
      url = new URL(databaseUrl)
    } catch {
      throw new Error('DATABASE_URL inválida. Use o formato mysql://usuario:senha@host:porta/banco.')
    }

    if (url.protocol !== 'mysql:' && url.protocol !== 'mysql2:') {
      throw new Error('DATABASE_URL deve usar o protocolo mysql://.')
    }

    const database = decodePart(url.pathname.replace(/^\/+/, ''))
    const user = decodePart(url.username)
    const password = decodePart(url.password)
    const port = url.port ? Number(url.port) : 3306

    if (!url.hostname || !user || !database || !Number.isInteger(port) || port <= 0) {
      throw new Error('DATABASE_URL precisa informar usuário, host, porta e banco de dados.')
    }

    return {
      host: url.hostname,
      port,
      user,
      password,
      database,
    }
  }

  const config: DatabaseConfig = {
    host: process.env.DB_HOST?.trim() ?? '',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER?.trim() ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME?.trim() ?? '',
  }

  if (!config.host || !config.user || !config.database || !Number.isInteger(config.port) || config.port <= 0) {
    throw new Error(
      'Banco não configurado. Defina DATABASE_URL no .env, por exemplo: mysql://usuario:senha@localhost:3306/portaldados.',
    )
  }

  return config
}

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...getDatabaseConfig(),
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true,
    })
  }
  return pool
}
