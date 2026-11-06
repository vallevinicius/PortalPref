export type ModoTotal = 'soma' | 'diferenca' | 'ultimo'

export const MODOS_TOTAL: readonly ModoTotal[] = ['soma', 'diferenca', 'ultimo']

export function isModoTotal(value: unknown): value is ModoTotal {
  return value === 'soma' || value === 'diferenca' || value === 'ultimo'
}
