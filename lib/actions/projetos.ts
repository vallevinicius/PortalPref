'use server'

import type { RowDataPacket } from 'mysql2'
import { revalidatePath } from 'next/cache'
import { requireSession, UnauthorizedError, type SessionPayload } from '@/lib/auth'
import { getPool } from '@/lib/db'

interface ProjetoRow extends RowDataPacket {
  id: number
  secretaria_id: number
}

async function getProjeto(projetoId: number) {
  const pool = getPool()
  const [rows] = await pool.query<ProjetoRow[]>('SELECT id, secretaria_id FROM projetos WHERE id = ? LIMIT 1', [projetoId])
  return rows[0] ?? null
}

async function getAuthorizedProjeto(projetoId: number, session: SessionPayload) {
  const projeto = await getProjeto(projetoId)
  if (!projeto) {
    throw new UnauthorizedError('Projeto não encontrado.')
  }

  if (session.role === 'super_admin') {
    return projeto
  }

  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }

  if (projeto.secretaria_id !== session.secretariaId) {
    throw new UnauthorizedError('Este projeto não pertence à sua secretaria.')
  }

  return projeto
}

export async function createProjeto(nome: string, descricao: string, secretariaId?: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const targetSecretariaId = session.role === 'super_admin' ? secretariaId : session.secretariaId

  if (!targetSecretariaId) {
    throw new UnauthorizedError(
      session.role === 'super_admin'
        ? 'Informe a secretaria do projeto.'
        : 'Sua conta não está vinculada a uma secretaria.',
    )
  }

  if (session.role === 'secretaria_admin' && secretariaId !== undefined && secretariaId !== session.secretariaId) {
    throw new UnauthorizedError('Você só pode criar projetos na sua secretaria.')
  }

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  const pool = getPool()
  await pool.query('INSERT INTO projetos (secretaria_id, nome, descricao, created_by) VALUES (?, ?, ?, ?)', [
    targetSecretariaId,
    trimmed,
    descricao.trim() || null,
    session.userId,
  ])

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${targetSecretariaId}`)
}

export async function updateProjeto(projetoId: number, nome: string, descricao: string) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const projeto = await getAuthorizedProjeto(projetoId, session)

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  const pool = getPool()
  await pool.query('UPDATE projetos SET nome = ?, descricao = ? WHERE id = ?', [trimmed, descricao.trim() || null, projetoId])

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretaria_id}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
}

export async function deleteProjeto(projetoId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const projeto = await getAuthorizedProjeto(projetoId, session)

  const pool = getPool()
  await pool.query('DELETE FROM projetos WHERE id = ?', [projetoId])

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretaria_id}`)
}
