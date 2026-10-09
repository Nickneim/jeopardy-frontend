import { describe, expect, test } from 'vitest'
import { formatMoney } from './format'

describe('formatMoney', () => {
  test('formats with a dollar sign and thousands separators', () => {
    expect(formatMoney(0)).toBe('$0')
    expect(formatMoney(400)).toBe('$400')
    expect(formatMoney(12000)).toBe('$12,000')
  })

  test('puts the minus sign before the dollar sign', () => {
    expect(formatMoney(-400)).toBe('-$400')
    expect(formatMoney(-1200)).toBe('-$1,200')
  })
})
