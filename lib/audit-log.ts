import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const AUDIT_ENTITY_TYPES = ['auth', 'user', 'secretaria', 'project', 'indicator', 'audit_log'] as const
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export type AuditLogDetails = Prisma.InputJsonValue

export type RecordAuditLogInput = {
  actorUserId: number
  action: string
  entityType: AuditEntityType
  entityId?: number | null
  targetUserId?: number | null
  details?: AuditLogDetails
}

export async function recordAuditLog({
  actorUserId,
  action,
  entityType,
  entityId,
  targetUserId,
  details,
}: RecordAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      entityType,
      entityId: entityId ?? null,
      targetUserId: targetUserId ?? null,
      ...(details === undefined ? {} : { details }),
    },
  })
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Login realizado',
  'auth.logout': 'Logout realizado',
  'user.create': 'Usuário criado',
  'user.update': 'Usuário atualizado',
  'user.delete': 'Usuário excluído',
  'user.assign': 'Usuário designado para o projeto',
  'user.unassign': 'Usuário removido do projeto',
  'user.password_reset': 'Senha redefinida',
  'user.password_reset_email': 'E-mail de redefinição de senha enviado',
  'user.password_self_change': 'Senha definida pelo usuário',
  view_password: 'Senha visualizada',
  'secretaria.create': 'Secretaria criada',
  'project.create': 'Projeto criado',
  'project.update': 'Projeto atualizado',
  'project.set_prazo': 'Prazo de atualização configurado',
  'project.delete': 'Projeto excluído',
  'indicator.create': 'Gráfico criado',
  'indicator.add_value': 'Número lançado',
  'indicator.update': 'Número atualizado',
  'indicator.rename_group': 'Gráfico renomeado',
  'indicator.set_scale': 'Escala do gráfico configurada',
  'indicator.remove_scale': 'Escala do gráfico removida',
  'indicator.delete': 'Número excluído',
  'indicator.delete_group': 'Gráfico excluído',
  'audit_log.view': 'Registro de auditoria consultado',
}

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  auth: 'Autenticação',
  user: 'Usuário',
  secretaria: 'Secretaria',
  project: 'Projeto',
  indicator: 'Indicador',
  audit_log: 'Registro de auditoria',
}

export const AUDIT_IGNORED_ACTIONS = ['auth.login', 'auth.logout', 'audit_log.view'] as const


export const AUDIT_ACTION_DESCRIPTIONS: Record<string, string> = {
  'auth.login': 'A pessoa entrou no sistema.',
  'auth.logout': 'A pessoa encerrou a sessão.',
  'user.create': 'Um novo usuário foi cadastrado.',
  'user.update': 'O nome de usuário ou e-mail de um usuário foi atualizado.',
  'user.delete': 'Um usuário foi excluído.',
  'user.assign': 'Um usuário já existente foi designado como responsável de um projeto.',
  'user.unassign': 'Um usuário deixou de ser responsável por um projeto.',
  'user.password_reset': 'A senha de um usuário foi redefinida.',
  'user.password_reset_email': 'Um administrador enviou um e-mail de redefinição de senha para o usuário.',
  'user.password_self_change': 'O próprio usuário definiu uma nova senha, substituindo a senha padrão.',
  view_password: 'Uma senha foi visualizada por um administrador autorizado.',
  'secretaria.create': 'Uma nova secretaria foi cadastrada.',
  'project.create': 'Um novo projeto foi criado.',
  'project.update': 'As informações de um projeto foram alteradas.',
  'project.set_prazo': 'O prazo de atualização de um projeto foi configurado.',
  'project.delete': 'Um projeto foi excluído.',
  'indicator.create': 'Um novo gráfico foi criado.',
  'indicator.add_value': 'Um novo número foi lançado em um gráfico já existente.',
  'indicator.update': 'As informações de um número foram alteradas.',
  'indicator.rename_group': 'Um gráfico foi renomeado.',
  'indicator.set_scale': 'A escala de classificação de um gráfico foi configurada.',
  'indicator.remove_scale': 'A escala de classificação de um gráfico foi removida.',
  'indicator.delete': 'Um número foi excluído de um gráfico.',
  'indicator.delete_group': 'Um gráfico e todos os seus números foram excluídos.',
  'audit_log.view': 'O histórico de atividades foi consultado.',
}

const AUDIT_DETAIL_LABELS: Record<string, string> = {
  username: 'Usuário',
  role: 'Perfil de acesso',
  nome: 'Nome',
  descricao: 'Descrição',
  titulo: 'Título',
  valor: 'Valor',
  unidade: 'Unidade',
  dataReferencia: 'Data de referência',
  secretariaId: 'Secretaria relacionada',
  projetoId: 'Projeto relacionado',
  indicadorId: 'Indicador relacionado',
  targetUserId: 'Usuário afetado',
  page: 'Página consultada',
  pageSize: 'Itens por página',
  action: 'Filtro por ação',
  entityType: 'Filtro por tipo de registro',
  actorUserId: 'Filtro por usuário',
  secretarias: 'Secretarias inseridas',
  users: 'Usuários inseridos',
  projetos: 'Projetos inseridos',
  indicadores: 'Indicadores inseridos',
}

// "valor"/"unidade" ganham sua própria coluna na tela de auditoria (getAuditValor),
// então saem da lista genérica de detalhes para não aparecer duas vezes.
const INTERNAL_DETAIL_KEYS = new Set(['seedKey', 'valor', 'unidade'])

function humanizeDetailKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (value) => value.toUpperCase())
}

function roleLabel(value: unknown) {
  if (value === 'super_admin') return 'Administrador supremo'
  if (value === 'secretaria_admin') return 'Administrador de secretaria'
  if (value === 'projeto_admin') return 'Responsável de projeto'
  return String(value)
}

function formatDetailValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Não informado'
  if (key === 'role') return roleLabel(value)
  if (key === 'entityType' && typeof value === 'string' && value in AUDIT_ENTITY_LABELS) {
    return AUDIT_ENTITY_LABELS[value as AuditEntityType]
  }
  if (key === 'action' && typeof value === 'string') {
    return AUDIT_ACTION_LABELS[value] ?? value
  }
  if (key === 'pageSize' && typeof value === 'number') return `${value} itens`
  if (['secretariaId', 'projetoId', 'indicadorId', 'targetUserId', 'actorUserId'].includes(key) && typeof value === 'number') {
    return `ID ${value}`
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export type AuditDetailEntry = {
  label: string
  value: string
}

export function getAuditDetailEntries(details: unknown): AuditDetailEntry[] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return []

  return Object.entries(details as Record<string, unknown>)
    .filter(([key]) => !INTERNAL_DETAIL_KEYS.has(key))
    .map(([key, value]) => ({
      label: AUDIT_DETAIL_LABELS[key] ?? humanizeDetailKey(key),
      value: formatDetailValue(key, value),
    }))
}

// Extrai e formata o valor/número lançado num indicador, para a coluna dedicada
// da tela de auditoria (ex.: "1.000" ou "1.000 pessoas"). Retorna null quando a
// atividade não tem um valor associado (a maioria dos tipos de ação).
export function getAuditValor(details: unknown): string | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null

  const { valor, unidade } = details as Record<string, unknown>
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null

  const valorFormatado = new Intl.NumberFormat('pt-BR').format(valor)
  return typeof unidade === 'string' && unidade ? `${valorFormatado} ${unidade}` : valorFormatado
}
