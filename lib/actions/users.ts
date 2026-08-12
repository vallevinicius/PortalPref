'use server'

import bcrypt from 'bcryptjs'
import type { RowDataPacket } from 'mysql2'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { getPool } from '@/lib/db'
import { generateRandomPassword } from '@/lib/password'

interface UserRow extends RowDataPacket {
  id: number
  role: 'super_admin' | 'secretaria_admin'
}

export async function createSecretariaUser(username: string, secretariaId: number) {
  await requireSession('super_admin')

  const trimmed = username.trim()
  if (!trimmed) {
    throw new Error('Informe o usuário de acesso da secretaria.')
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)

  const pool = getPool()
  await pool.query(
    "INSERT INTO users (username, password_hash, role, secretaria_id) VALUES (?, ?, 'secretaria_admin', ?)",
    [trimmed, passwordHash, secretariaId],
  )

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

  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId])

  revalidatePath('/admin')

  return { password }
}
