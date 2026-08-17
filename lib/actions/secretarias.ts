'use server'

import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit-log'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { slugify } from '@/lib/slug'

export async function createSecretaria(nome: string) {
  const session = await requireSession('super_admin')

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome da secretaria.')
  }

  try {
    const secretaria = await prisma.secretaria.create({
      data: {
        nome: trimmed,
        slug: slugify(trimmed),
      },
    })

    await recordAuditLog({
      actorUserId: session.userId,
      action: 'secretaria.create',
      entityType: 'secretaria',
      entityId: secretaria.id,
      details: { nome: secretaria.nome },
    })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new Error('Já existe uma secretaria com esse nome.')
    }
    throw err
  }

  revalidatePath('/admin')
}
