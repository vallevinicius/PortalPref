'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { getPool } from '@/lib/db'
import { slugify } from '@/lib/slug'

export async function createSecretaria(nome: string) {
  await requireSession('super_admin')

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome da secretaria.')
  }

  const pool = getPool()
  await pool.query('INSERT INTO secretarias (nome, slug) VALUES (?, ?)', [trimmed, slugify(trimmed)])

  revalidatePath('/admin')
}
