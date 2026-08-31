import crypto from 'node:crypto'

/**
 * A senha do admin supremo original (o usuário definido em ADMIN_USERNAME/ADMIN_PASSWORD
 * no .env) nunca é comparada contra um hash salvo no banco — ela é lida direto do .env
 * a cada login, para nunca ficar "dessincronizada" quando alguém troca o .env no servidor.
 */
export function isBootstrapAdminUsername(username: string) {
  return typeof process.env.ADMIN_USERNAME === 'string' && username === process.env.ADMIN_USERNAME
}

export function verifyBootstrapAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD
  if (typeof expected !== 'string' || !expected) return false

  const a = Buffer.from(password)
  const b = Buffer.from(expected)
  const length = Math.max(a.length, b.length, 1)
  const paddedA = Buffer.alloc(length)
  const paddedB = Buffer.alloc(length)
  a.copy(paddedA)
  b.copy(paddedB)

  return a.length === b.length && crypto.timingSafeEqual(paddedA, paddedB)
}
