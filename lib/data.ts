import type { RowDataPacket } from 'mysql2'
import { getPool } from '@/lib/db'

export interface Secretaria {
  id: number
  nome: string
  slug: string
  projetos_count: number
}

export interface SecretariaAdmin {
  id: number
  username: string
  secretaria_id: number
  secretaria_nome: string
}

export interface SuperAdmin {
  id: number
  username: string
}

export interface Indicador {
  id: number
  titulo: string
  valor: number
  unidade: string | null
  data_referencia: string
}

export interface Projeto {
  id: number
  nome: string
  descricao: string | null
  secretaria_id: number
  secretaria_nome: string
  indicadores: Indicador[]
}

export async function getSecretariaById(id: number): Promise<Secretaria | null> {
  const pool = getPool()
  const [rows] = await pool.query<(Secretaria & RowDataPacket)[]>(
    `SELECT s.id, s.nome, s.slug, COUNT(p.id) AS projetos_count
     FROM secretarias s
     LEFT JOIN projetos p ON p.secretaria_id = s.id
     WHERE s.id = ?
     GROUP BY s.id, s.nome, s.slug`,
    [id],
  )
  const row = rows[0]
  return row ? { ...row, projetos_count: Number(row.projetos_count) } : null
}

export async function getSecretariaAdminBySecretariaId(secretariaId: number): Promise<SecretariaAdmin | null> {
  const pool = getPool()
  const [rows] = await pool.query<(SecretariaAdmin & RowDataPacket)[]>(
    `SELECT u.id, u.username, u.secretaria_id, s.nome AS secretaria_nome
     FROM users u
     JOIN secretarias s ON s.id = u.secretaria_id
     WHERE u.role = 'secretaria_admin' AND u.secretaria_id = ?
     LIMIT 1`,
    [secretariaId],
  )
  return rows[0] ?? null
}

export async function getSecretarias(): Promise<Secretaria[]> {
  const pool = getPool()
  const [rows] = await pool.query<(Secretaria & RowDataPacket)[]>(
    `SELECT s.id, s.nome, s.slug, COUNT(p.id) AS projetos_count
     FROM secretarias s
     LEFT JOIN projetos p ON p.secretaria_id = s.id
     GROUP BY s.id, s.nome, s.slug
     ORDER BY s.nome ASC`,
  )
  return rows.map((row) => ({ ...row, projetos_count: Number(row.projetos_count) }))
}

export async function getSecretariaAdmins(): Promise<SecretariaAdmin[]> {
  const pool = getPool()
  const [rows] = await pool.query<(SecretariaAdmin & RowDataPacket)[]>(
    `SELECT u.id, u.username, u.secretaria_id, s.nome AS secretaria_nome
     FROM users u
     JOIN secretarias s ON s.id = u.secretaria_id
     WHERE u.role = 'secretaria_admin'
     ORDER BY s.nome ASC, u.username ASC`,
  )
  return rows
}

export async function getSuperAdmins(): Promise<SuperAdmin[]> {
  const pool = getPool()
  const [rows] = await pool.query<(SuperAdmin & RowDataPacket)[]>(
    `SELECT id, username FROM users WHERE role = 'super_admin' ORDER BY username ASC`,
  )
  return rows
}

interface ProjetoJoinRow extends RowDataPacket {
  projeto_id: number
  projeto_nome: string
  projeto_descricao: string | null
  secretaria_id: number
  secretaria_nome: string
  indicador_id: number | null
  indicador_titulo: string | null
  indicador_valor: number | null
  indicador_unidade: string | null
  indicador_data_referencia: string | null
}

function groupProjetos(rows: ProjetoJoinRow[]): Projeto[] {
  const byId = new Map<number, Projeto>()

  for (const row of rows) {
    let projeto = byId.get(row.projeto_id)
    if (!projeto) {
      projeto = {
        id: row.projeto_id,
        nome: row.projeto_nome,
        descricao: row.projeto_descricao,
        secretaria_id: row.secretaria_id,
        secretaria_nome: row.secretaria_nome,
        indicadores: [],
      }
      byId.set(row.projeto_id, projeto)
    }
    if (row.indicador_id) {
      projeto.indicadores.push({
        id: row.indicador_id,
        titulo: row.indicador_titulo!,
        valor: Number(row.indicador_valor),
        unidade: row.indicador_unidade,
        data_referencia: row.indicador_data_referencia!,
      })
    }
  }

  return Array.from(byId.values())
}

export async function getProjetoComIndicadores(projetoId: number): Promise<Projeto | null> {
  const pool = getPool()
  const [rows] = await pool.query<ProjetoJoinRow[]>(
    `SELECT
       p.id AS projeto_id, p.nome AS projeto_nome, p.descricao AS projeto_descricao,
       s.id AS secretaria_id, s.nome AS secretaria_nome,
       i.id AS indicador_id, i.titulo AS indicador_titulo, i.valor AS indicador_valor,
       i.unidade AS indicador_unidade, i.data_referencia AS indicador_data_referencia
     FROM projetos p
     JOIN secretarias s ON s.id = p.secretaria_id
     LEFT JOIN indicadores i ON i.projeto_id = p.id
     WHERE p.id = ?
     ORDER BY i.data_referencia ASC`,
    [projetoId],
  )
  return groupProjetos(rows)[0] ?? null
}

export async function getProjetosComIndicadores(secretariaId: number): Promise<Projeto[]> {
  const pool = getPool()
  const [rows] = await pool.query<ProjetoJoinRow[]>(
    `SELECT
       p.id AS projeto_id, p.nome AS projeto_nome, p.descricao AS projeto_descricao,
       s.id AS secretaria_id, s.nome AS secretaria_nome,
       i.id AS indicador_id, i.titulo AS indicador_titulo, i.valor AS indicador_valor,
       i.unidade AS indicador_unidade, i.data_referencia AS indicador_data_referencia
     FROM projetos p
     JOIN secretarias s ON s.id = p.secretaria_id
     LEFT JOIN indicadores i ON i.projeto_id = p.id
     WHERE p.secretaria_id = ?
     ORDER BY p.created_at DESC, i.data_referencia ASC`,
    [secretariaId],
  )
  return groupProjetos(rows)
}
