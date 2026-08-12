'use server'

import type { RowDataPacket } from 'mysql2'
import { revalidatePath } from 'next/cache'
import { requireSession, UnauthorizedError } from '@/lib/auth'
import { getPool } from '@/lib/db'

interface OwnershipRow extends RowDataPacket {
  id: number
  secretaria_id: number
}

async function assertOwnsProjeto(projetoId: number, secretariaId: number) {
  const pool = getPool()
  const [rows] = await pool.query<OwnershipRow[]>('SELECT id, secretaria_id FROM projetos WHERE id = ? LIMIT 1', [projetoId])
  const projeto = rows[0]
  if (!projeto || projeto.secretaria_id !== secretariaId) {
    throw new UnauthorizedError('Este projeto não pertence à sua secretaria.')
  }
}

async function assertOwnsIndicador(indicadorId: number, secretariaId: number) {
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
  if (!indicador || indicador.secretaria_id !== secretariaId) {
    throw new UnauthorizedError('Este indicador não pertence à sua secretaria.')
  }
}

export async function createIndicador(
  projetoId: number,
  titulo: string,
  valor: number,
  unidade: string,
  dataReferencia: string,
) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }
  await assertOwnsProjeto(projetoId, session.secretariaId)

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
}

export async function updateIndicador(
  indicadorId: number,
  titulo: string,
  valor: number,
  unidade: string,
  dataReferencia: string,
) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }
  await assertOwnsIndicador(indicadorId, session.secretariaId)

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
}

export async function deleteIndicador(indicadorId: number) {
  const session = await requireSession('secretaria_admin')
  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }
  await assertOwnsIndicador(indicadorId, session.secretariaId)

  const pool = getPool()
  await pool.query('DELETE FROM indicadores WHERE id = ?', [indicadorId])

  revalidatePath('/admin')
}
