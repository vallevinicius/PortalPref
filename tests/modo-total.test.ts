import { describe, expect, it } from 'vitest'
import { isModoTotal } from '@/lib/modo-total'

describe('isModoTotal', () => {
  it('aceita soma, diferença e último dado', () => {
    expect(isModoTotal('soma')).toBe(true)
    expect(isModoTotal('diferenca')).toBe(true)
    expect(isModoTotal('ultimo')).toBe(true)
  })

  it('rejeita qualquer outro valor', () => {
    expect(isModoTotal('media')).toBe(false)
    expect(isModoTotal(undefined)).toBe(false)
  })
})
