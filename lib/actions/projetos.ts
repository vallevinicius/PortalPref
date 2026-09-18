'use server'

import { revalidatePath } from 'next/cache'
import { assertCanEdit, createSessionToken, requireSession, setSessionCookie, UnauthorizedError, type SessionPayload } from '@/lib/auth'
import { recordAuditLog } from '@/lib/audit-log'
import { prisma } from '@/lib/prisma'

async function getAuthorizedProjeto(projetoId: number, session: SessionPayload) {
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId },
    select: { id: true, nome: true, secretariaId: true },
  })

  if (!projeto) {
    throw new UnauthorizedError('Projeto não encontrado.')
  }

  if (session.role === 'super_admin') {
    return projeto
  }

  if (session.role === 'projeto_admin') {
    if (!session.projetoIds.includes(projetoId)) {
      throw new UnauthorizedError('Você não é responsável por este projeto.')
    }
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

export async function createProjeto(
  nome: string,
  descricao: string,
  responsavelNome: string,
  responsavelTelefone: string,
  prazoAtualizacaoDias: number,
  secretariaId?: number,
) {
  const session = await requireSession('super_admin', 'secretaria_admin', 'projeto_admin')
  assertCanEdit(session)

  let targetSecretariaId: number | null | undefined
  if (session.role === 'super_admin') {
    targetSecretariaId = secretariaId
  } else if (session.role === 'secretaria_admin') {
    targetSecretariaId = session.secretariaId
    if (secretariaId !== undefined && secretariaId !== session.secretariaId) {
      throw new UnauthorizedError('Você só pode criar projetos na sua secretaria.')
    }
  } else {
    // projeto_admin: a secretaria é sempre a mesma dos projetos que ele já é responsável.
    const projetoExistente = session.projetoIds[0]
      ? await prisma.projeto.findUnique({ where: { id: session.projetoIds[0] }, select: { secretariaId: true } })
      : null
    targetSecretariaId = projetoExistente?.secretariaId ?? null
  }

  if (!targetSecretariaId) {
    throw new UnauthorizedError(
      session.role === 'super_admin'
        ? 'Informe a secretaria do projeto.'
        : 'Sua conta não está vinculada a uma secretaria.',
    )
  }

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  const trimmedResponsavelNome = responsavelNome.trim()
  const trimmedResponsavelTelefone = responsavelTelefone.trim()
  if (!trimmedResponsavelNome || !trimmedResponsavelTelefone) {
    throw new Error('Informe o nome completo e o telefone de contato do responsável.')
  }

  if (!Number.isInteger(prazoAtualizacaoDias) || prazoAtualizacaoDias <= 0) {
    throw new Error('Informe de quanto em quanto tempo (em dias) o projeto precisa ser atualizado.')
  }

  const projeto = await prisma.projeto.create({
    data: {
      secretariaId: targetSecretariaId,
      nome: trimmed,
      descricao: descricao.trim() || null,
      responsavelNome: trimmedResponsavelNome,
      responsavelTelefone: trimmedResponsavelTelefone,
      prazoAtualizacaoDias,
      createdBy: session.userId,
      // O responsável de projeto que cria um projeto novo já entra como responsável
      // dele, senão ele criaria um projeto que nem consegue acessar depois.
      ...(session.role === 'projeto_admin' ? { responsaveis: { create: { userId: session.userId } } } : {}),
    },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'project.create',
    entityType: 'project',
    entityId: projeto.id,
    details: { nome: projeto.nome, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${targetSecretariaId}`)

  // Atualiza a sessão do responsável de projeto na hora, senão ele fica sem acesso ao
  // projeto que acabou de criar até fazer login de novo (o token antigo não sabe do projeto novo).
  if (session.role === 'projeto_admin') {
    const token = await createSessionToken({
      ...session,
      projetoIds: [...session.projetoIds, projeto.id],
    })
    await setSessionCookie(token)
  }

  return { id: projeto.id }
}

export async function setPrazoAtualizacao(projetoId: number, prazoAtualizacaoDias: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  assertCanEdit(session)
  const projeto = await getAuthorizedProjeto(projetoId, session)

  if (!Number.isInteger(prazoAtualizacaoDias) || prazoAtualizacaoDias <= 0) {
    throw new Error('Informe um número de dias válido.')
  }

  await prisma.projeto.update({
    where: { id: projetoId },
    data: { prazoAtualizacaoDias },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'project.set_prazo',
    entityType: 'project',
    entityId: projetoId,
    details: { nome: projeto.nome, secretariaId: projeto.secretariaId, prazoAtualizacaoDias },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
}

export async function updateProjeto(
  projetoId: number,
  nome: string,
  descricao: string,
  responsavelNome: string,
  responsavelTelefone: string,
) {
  const session = await requireSession('super_admin', 'secretaria_admin', 'projeto_admin')
  assertCanEdit(session)
  const projeto = await getAuthorizedProjeto(projetoId, session)

  const trimmed = nome.trim()
  if (!trimmed) {
    throw new Error('Informe o nome do projeto.')
  }

  const trimmedResponsavelNome = responsavelNome.trim()
  const trimmedResponsavelTelefone = responsavelTelefone.trim()
  if (!trimmedResponsavelNome || !trimmedResponsavelTelefone) {
    throw new Error('Informe o nome completo e o telefone de contato do responsável.')
  }

  await prisma.projeto.update({
    where: { id: projetoId },
    data: {
      nome: trimmed,
      descricao: descricao.trim() || null,
      responsavelNome: trimmedResponsavelNome,
      responsavelTelefone: trimmedResponsavelTelefone,
    },
  })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'project.update',
    entityType: 'project',
    entityId: projetoId,
    details: { nome: trimmed, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
  revalidatePath(`/admin/projetos/${projetoId}`)
}

export async function deleteProjeto(projetoId: number) {
  const session = await requireSession('super_admin', 'secretaria_admin')
  assertCanEdit(session)
  const projeto = await getAuthorizedProjeto(projetoId, session)

  await prisma.projeto.delete({ where: { id: projetoId } })

  await recordAuditLog({
    actorUserId: session.userId,
    action: 'project.delete',
    entityType: 'project',
    entityId: projetoId,
    details: { nome: projeto.nome, secretariaId: projeto.secretariaId },
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/secretarias/${projeto.secretariaId}`)
}
