import { describe, expect, it } from 'vitest'
import { formatValorIndicador, isTipoValor } from '@/lib/format-valor'

describe('formatValorIndicador', () => {
  it('formata número normal no padrão pt-BR, com ou sem unidade', () => {
    expect(formatValorIndicador(1234.5)).toBe('1.234,5')
    expect(formatValorIndicador(1000, 'numero', 'pessoas')).toBe('1.000 pessoas')
  })

  it('formata dinheiro como moeda brasileira e ignora a unidade', () => {
    expect(formatValorIndicador(1234.5, 'dinheiro')).toMatch(/^R\$\s1\.234,50$/)
    expect(formatValorIndicador(0, 'dinheiro', 'pessoas')).toMatch(/^R\$\s0,00$/)
    expect(formatValorIndicador(-10, 'dinheiro')).toMatch(/^-R\$\s10,00$/)
  })
})

describe('isTipoValor', () => {
  it('aceita apenas numero e dinheiro', () => {
    expect(isTipoValor('numero')).toBe(true)
    expect(isTipoValor('dinheiro')).toBe(true)
    expect(isTipoValor('euro')).toBe(false)
    expect(isTipoValor(undefined)).toBe(false)
  })
})
