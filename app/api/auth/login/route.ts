import bcrypt from 'bcryptjs'
import type { RowDataPacket } from 'mysql2'
import { NextResponse } from 'next/server'
import { createSessionToken, setSessionCookie } from '@/lib/auth'
import { getPool } from '@/lib/db'

interface UserRow extends RowDataPacket {
  id: number
  username: string
  password_hash: string
  role: 'super_admin' | 'admin' | 'user'
}

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return NextResponse.json({ error: 'Usuário e senha são obrigatórios.' }, { status: 400 })
  }

  const pool = getPool()
  const [rows] = await pool.query<UserRow[]>('SELECT id, username, password_hash, role FROM users WHERE username = ? LIMIT 1', [username])
  const user = rows[0]

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 })
  }

  const token = await createSessionToken({ userId: user.id, username: user.username, role: user.role })
  await setSessionCookie(token)

  return NextResponse.json({ ok: true, role: user.role })
}
