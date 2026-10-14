'use server'

import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit-log'
import { assertCanEdit, requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { slugify } from '@/lib/slug'

// Em produção o Next mascara a mensagem de erros lançados por server actions
// (o cliente só vê "Minified React error #441"), então falhas esperadas voltam como dado.
export async function createSecretaria(nome: string): Promise<{ error?: string }> {
  const session = await requireSession('super_admin')
  if (session.canEdit === false) {
    return { error: 'Sua conta tem acesso apenas de visualização.' }
  }
  assertCanEdit(session)

  const trimmed = nome.trim()
  if (!trimmed) {
    return { error: 'Informe o nome da secretaria.' }
  }
  const slug = slugify(trimmed)
  if (!slug) {
    return { error: 'O nome da secretaria deve conter letras ou números.' }
  }

  try {
    const secretaria = await prisma.secretaria.create({
      data: {
        nome: trimmed,
        slug,
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
      return { error: 'Já existe uma secretaria com esse nome.' }
    }
    throw err
  }

  revalidatePath('/admin')
  return {}
}
