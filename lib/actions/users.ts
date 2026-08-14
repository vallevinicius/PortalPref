'use server'

import bcrypt from 'bcryptjs'
import type { RowDataPacket } from 'mysql2'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { getPool } from '@/lib/db'
import { generateRandomPassword } from '@/lib/password'

interface UserRow extends RowDataPacket {
  id: number
  role: 'super_admin' | 'secretaria_admin'
}

interface UserPasswordRow extends RowDataPacket {
  password_encrypted: string | null
}

interface UserAuthRow extends RowDataPacket {
  password_hash: string
}

async function verifyOwnPassword(userId: number, confirmPassword: string) {
  const pool = getPool()
  const [rows] = await pool.query<UserAuthRow[]>('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [userId])
  const row = rows[0]
  if (!row || !(await bcrypt.compare(confirmPassword, row.password_hash))) {
    throw new Error('Senha incorreta.')
  }
}

async function recordPasswordView(actorUserId: number, targetUserId: number) {
  const pool = getPool()
  await pool.query('INSERT INTO audit_log (actor_user_id, action, target_user_id) VALUES (?, ?, ?)', [
    actorUserId,
    'view_password',
    targetUserId,
  ])
}

export async function createSecretariaUser(username: string, secretariaId: number) {
  await requireSession('super_admin')

  const trimmed = username.trim()
  if (!trimmed) {
    throw new Error('Informe o usuário de acesso da secretaria.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const passwordEncrypted = encryptSecret(password)

  const pool = getPool()
  try {
    await pool.query(
      "INSERT INTO users (username, password_hash, password_encrypted, role, secretaria_id) VALUES (?, ?, ?, 'secretaria_admin', ?)",
      [trimmed, passwordHash, passwordEncrypted, secretariaId],
    )
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error('Já existe um usuário com esse nome de acesso.')
    }
    throw err
  }

  revalidatePath('/admin')

  return { username: trimmed, password }
}

export async function resetSecretariaUserPassword(userId: number) {
  await requireSession('super_admin')

  const pool = getPool()
  const [rows] = await pool.query<UserRow[]>('SELECT id, role FROM users WHERE id = ? LIMIT 1', [userId])
  const target = rows[0]

  if (!target || target.role !== 'secretaria_admin') {
    throw new Error('Usuário não encontrado ou não é uma conta de secretaria.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const passwordEncrypted = encryptSecret(password)

  await pool.query('UPDATE users SET password_hash = ?, password_encrypted = ? WHERE id = ?', [
    passwordHash,
    passwordEncrypted,
    userId,
  ])

  revalidatePath('/admin')

  return { password }
}

export async function getSecretariaUserPassword(userId: number, confirmPassword: string) {
  const session = await requireSession('super_admin')
  await verifyOwnPassword(session.userId, confirmPassword)

  const pool = getPool()
  const [rows] = await pool.query<(UserRow & UserPasswordRow)[]>(
    'SELECT id, role, password_encrypted FROM users WHERE id = ? LIMIT 1',
    [userId],
  )
  const target = rows[0]

  if (!target || target.role !== 'secretaria_admin') {
    throw new Error('Usuário não encontrado ou não é uma conta de secretaria.')
  }

  if (!target.password_encrypted) {
    throw new Error('Esta senha foi definida antes deste recurso existir. Gere uma nova senha para poder visualizá-la.')
  }

  await recordPasswordView(session.userId, target.id)

  return { password: decryptSecret(target.password_encrypted) }
}

export async function createSuperAdmin(username: string) {
  await requireSession('super_admin')

  const trimmed = username.trim()
  if (!trimmed) {
    throw new Error('Informe o usuário de acesso.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const passwordEncrypted = encryptSecret(password)

  const pool = getPool()
  try {
    await pool.query(
      "INSERT INTO users (username, password_hash, password_encrypted, role, secretaria_id) VALUES (?, ?, ?, 'super_admin', NULL)",
      [trimmed, passwordHash, passwordEncrypted],
    )
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error('Já existe um usuário com esse nome de acesso.')
    }
    throw err
  }

  revalidatePath('/admin')

  return { username: trimmed, password }
}

export async function resetSuperAdminPassword(userId: number) {
  await requireSession('super_admin')

  const pool = getPool()
  const [rows] = await pool.query<UserRow[]>('SELECT id, role FROM users WHERE id = ? LIMIT 1', [userId])
  const target = rows[0]

  if (!target || target.role !== 'super_admin') {
    throw new Error('Usuário não encontrado ou não é uma conta de administrador supremo.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const passwordEncrypted = encryptSecret(password)

  await pool.query('UPDATE users SET password_hash = ?, password_encrypted = ? WHERE id = ?', [
    passwordHash,
    passwordEncrypted,
    userId,
  ])

  revalidatePath('/admin')

  return { password }
}

export async function getSuperAdminPassword(userId: number, confirmPassword: string) {
  const session = await requireSession('super_admin')
  await verifyOwnPassword(session.userId, confirmPassword)

  const pool = getPool()
  const [rows] = await pool.query<(UserRow & UserPasswordRow)[]>(
    'SELECT id, role, password_encrypted FROM users WHERE id = ? LIMIT 1',
    [userId],
  )
  const target = rows[0]

  if (!target || target.role !== 'super_admin') {
    throw new Error('Usuário não encontrado ou não é uma conta de administrador supremo.')
  }

  if (!target.password_encrypted) {
    throw new Error('Esta senha foi definida antes deste recurso existir. Gere uma nova senha para poder visualizá-la.')
  }

  await recordPasswordView(session.userId, target.id)

  return { password: decryptSecret(target.password_encrypted) }
}
