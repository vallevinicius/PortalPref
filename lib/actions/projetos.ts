'use server'

import type { RowDataPacket } from 'mysql2'
import { revalidatePath } from 'next/cache'
import { requireSession, UnauthorizedError } from '@/lib/auth'
import { getPool } from '@/lib/db'

interface ProjetoRow extends RowDataPacket {
  id: number
  secretaria_id: number
}

async function getOwnedProjeto(projetoId: number, secretariaId: number) {
  const pool = getPool()
  const [rows] = await pool.query<ProjetoRow[]>('SELECT id, secretaria_id FROM projetos WHERE id = ? LIMIT 1', [projetoId])
  const projeto = rows[0]
  if (!projeto || projeto.secretaria_id !== secretariaId) {
    throw new UnauthorizedError('Este projeto não pertence à sua secretaria.')
  }
  return projeto
}

export async function createProjeto(nome: string, descricao: string) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  const pool = getPool()
  await pool.query('INSERT INTO projetos (secretaria_id, nome, descricao, created_by) VALUES (?, ?, ?, ?)', [
    session.secretariaId,
    trimmed,
    descricao.trim() || null,
    session.userId,
  ])

  revalidatePath('/admin')
}

export async function updateProjeto(projetoId: number, nome: string, descricao: string) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }
  await getOwnedProjeto(projetoId, session.secretariaId)

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  const pool = getPool()
  await pool.query('UPDATE projetos SET nome = ?, descricao = ? WHERE id = ?', [trimmed, descricao.trim() || null, projetoId])

  revalidatePath('/admin')
}

export async function deleteProjeto(projetoId: number) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }
  await getOwnedProjeto(projetoId, session.secretariaId)

  const pool = getPool()
  await pool.query('DELETE FROM projetos WHERE id = ?', [projetoId])

  revalidatePath('/admin')
}
