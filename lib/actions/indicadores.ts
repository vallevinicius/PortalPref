'use server'

import type { RowDataPacket } from 'mysql2'
import { revalidatePath } from 'next/cache'
import { requireSession, UnauthorizedError, type SessionPayload } from '@/lib/auth'
import { getPool } from '@/lib/db'

interface OwnershipRow extends RowDataPacket {
  id: number
  secretaria_id: number
}

async function assertProjetoAccess(projetoId: number, session: SessionPayload) {
  const pool = getPool()
  const [rows] = await pool.query<OwnershipRow[]>('SELECT id, secretaria_id FROM projetos WHERE id = ? LIMIT 1', [projetoId])
  const projeto = rows[0]

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

async function assertIndicadorAccess(indicadorId: number, session: SessionPayload) {
  const pool = getPool()
  const [rows] = await pool.query<OwnershipRow[]>(
    `SELECT indicadores.id AS id, projetos.secretaria_id AS secretaria_id
     FROM indicadores
     JOIN projetos ON projetos.id = indicadores.projeto_id
     WHERE indicadores.id = ?
     LIMIT 1`,
    [indicadorId],
  )
  const indicador = rows[0]

  if (!indicador) {
    throw new UnauthorizedError('Indicador não encontrado.')
  }

  if (session.role === 'super_admin') {
    return indicador
  }

  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }

  if (indicador.secretaria_id !== session.secretariaId) {
    throw new UnauthorizedError('Este indicador não pertence à sua secretaria.')
  }

  return indicador
}

export async function createIndicador(
  projetoId: number,
  titulo: string,
  valor: number,
  unidade: string,
  dataReferencia: string,
) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const projeto = await assertProjetoAccess(projetoId, session)

  const trimmedTitulo = titulo.trim()
  if (!trimmedTitulo || Number.isNaN(valor) || !dataReferencia) {
    throw new Error('Preencha título, valor e data do indicador.')
  }

  const pool = getPool()
  await pool.query(
    'INSERT INTO indicadores (projeto_id, titulo, valor, unidade, data_referencia, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [projetoId, trimmedTitulo, valor, unidade.trim() || null, dataReferencia, session.userId],
  )

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretaria_id}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
}

export async function updateIndicador(
  indicadorId: number,
  titulo: string,
  valor: number,
  unidade: string,
  dataReferencia: string,
) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const indicador = await assertIndicadorAccess(indicadorId, session)

  const trimmedTitulo = titulo.trim()
  if (!trimmedTitulo || Number.isNaN(valor) || !dataReferencia) {
    throw new Error('Preencha título, valor e data do indicador.')
  }

  const pool = getPool()
  await pool.query('UPDATE indicadores SET titulo = ?, valor = ?, unidade = ?, data_referencia = ? WHERE id = ?', [
    trimmedTitulo,
    valor,
    unidade.trim() || null,
    dataReferencia,
    indicadorId,
  ])

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${indicador.secretaria_id}`)
}

export async function deleteIndicador(indicadorId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const indicador = await assertIndicadorAccess(indicadorId, session)

  const pool = getPool()
  await pool.query('DELETE FROM indicadores WHERE id = ?', [indicadorId])

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${indicador.secretaria_id}`)
}
