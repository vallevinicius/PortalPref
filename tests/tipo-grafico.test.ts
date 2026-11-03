import { describe, expect, it } from 'vitest'
import { isTipoGrafico } from '@/lib/tipo-grafico'

describe('isTipoGrafico', () => {
  it('aceita apenas barras e pizza', () => {
    expect(isTipoGrafico('barras')).toBe(true)
    expect(isTipoGrafico('pizza')).toBe(true)
    expect(isTipoGrafico('radar')).toBe(false)
    expect(isTipoGrafico(null)).toBe(false)
  })
})
