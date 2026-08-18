'use server'

import { revalidatePath } from 'next/cache'
import { requireSession, UnauthorizedError, type SessionPayload } from '@/lib/auth'
import { recordAuditLog } from '@/lib/audit-log'
import { prisma } from '@/lib/prisma'

function parseDataReferencia(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Preencha título, valor e data do indicador.')
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Preencha título, valor e data do indicador.')
  }

  return date
}

async function assertProjetoAccess(projetoId: number, session: SessionPayload) {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    select: { id: true, secretariaId: true },
  })

  if (!projeto) {
    throw new UnauthorizedError('Projeto não encontrado.')
  }

  if (session.role === 'super_admin') {
    return projeto
  }

  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }

  if (projeto.secretariaId !== session.secretariaId) {
    throw new UnauthorizedError('Este projeto não pertence à sua secretaria.')
  }

  return projeto
}

async function assertIndicadorAccess(indicadorId: number, session: SessionPayload) {
  const indicador = await prisma.indicador.findUnique({
    where: { id: indicadorId },
    select: { id: true, projeto: { select: { secretariaId: true } } },
  })

  if (!indicador) {
    throw new UnauthorizedError('Indicador não encontrado.')
  }

  if (session.role === 'super_admin') {
    return indicador
  }

  if (!session.secretariaId) {
    throw new UnauthorizedError('Sua conta não está vinculada a uma secretaria.')
  }

  if (indicador.projeto.secretariaId !== session.secretariaId) {
    throw new UnauthorizedError('Este indicador não pertence à sua secretaria.')
  }

  return indicador
}

function validateIndicador(titulo: string, valor: number, dataReferencia: string) {
  const trimmedTitulo = titulo.trim()
  if (!trimmedTitulo || !Number.isFinite(valor) || !dataReferencia) {
    throw new Error('Preencha título, valor e data do indicador.')
  }

  return {
    titulo: trimmedTitulo,
    dataReferencia: parseDataReferencia(dataReferencia),
  }
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
  const validated = validateIndicador(titulo, valor, dataReferencia)

  const indicador = await prisma.indicador.create({
    data: {
      projetoId,
      titulo: validated.titulo,
      valor,
      unidade: unidade.trim() || null,
      dataReferencia: validated.dataReferencia,
      createdBy: session.userId,
    },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'indicator.create',
    entityType: 'indicator',
    entityId: indicador.id,
    details: { titulo: indicador.titulo, projetoId: indicador.projetoId, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
}

export async function renameIndicadorGrupo(projetoId: number, tituloAtual: string, novoTitulo: string) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const projeto = await assertProjetoAccess(projetoId, session)

  const trimmed = novoTitulo.trim()
  if (!trimmed) {
    throw new Error('Informe um nome para o gráfico.')
  }

  const result = await prisma.indicador.updateMany({
    where: { projetoId, titulo: tituloAtual },
    data: { titulo: trimmed },
  })

  if (result.count === 0) {
    throw new Error('Gráfico não encontrado.')
  }

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'indicator.rename_group',
    entityType: 'indicator',
    details: { tituloAntigo: tituloAtual, tituloNovo: trimmed, projetoId, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
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
  const validated = validateIndicador(titulo, valor, dataReferencia)

  await prisma.indicador.update({
    where: { id: indicadorId },
    data: {
      titulo: validated.titulo,
      valor,
      unidade: unidade.trim() || null,
      dataReferencia: validated.dataReferencia,
    },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'indicator.update',
    entityType: 'indicator',
    entityId: indicadorId,
    details: { titulo: validated.titulo, secretariaId: indicador.projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${indicador.projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${indicadorId}`)
}

export async function deleteIndicador(indicadorId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  const indicador = await assertIndicadorAccess(indicadorId, session)

  await prisma.indicador.delete({ where: { id: indicadorId } })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'indicator.delete',
    entityType: 'indicator',
    entityId: indicadorId,
    details: { secretariaId: indicador.projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${indicador.projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${indicadorId}`)
}
