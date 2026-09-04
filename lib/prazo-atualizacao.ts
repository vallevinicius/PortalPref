export const PRAZO_PRESETS = [
  { label: 'Diário', dias: 1 },
  { label: 'Semanal', dias: 7 },
  { label: 'Quinzenal', dias: 15 },
  { label: 'Mensal', dias: 30 },
  { label: 'Semestral', dias: 180 },
  { label: 'Anual', dias: 365 },
] as const

export function diasDesde(dataIso: string, hoje: Date = new Date()) {
  const data = new Date(`${dataIso}T00:00:00`)
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const diffMs = hojeSemHora.getTime() - data.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export interface StatusAtualizacao {
  atrasado: boolean
  diasDesdeUltimaAtualizacao: number | null
}

export function calcularStatusAtualizacao(
  ultimaAtualizacao: string | null,
  prazoAtualizacaoDias: number | null,
  hoje: Date = new Date(),
): StatusAtualizacao {
  if (prazoAtualizacaoDias === null) {
    return { atrasado: false, diasDesdeUltimaAtualizacao: null }
  }

  if (!ultimaAtualizacao) {
    return { atrasado: true, diasDesdeUltimaAtualizacao: null }
  }

  const dias = diasDesde(ultimaAtualizacao, hoje)
  return { atrasado: dias > prazoAtualizacaoDias, diasDesdeUltimaAtualizacao: dias }
}
