export type TipoGrafico = 'barras' | 'pizza'

export function isTipoGrafico(value: unknown): value is TipoGrafico {
  return value === 'barras' || value === 'pizza'
}

export const CATEGORIA_MAX_LENGTH = 120
